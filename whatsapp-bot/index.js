const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const qrcodeTerminal = require('qrcode-terminal');
const qrcode = require('qrcode');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;
const DJANGO_WEBHOOK_URL = process.env.DJANGO_WEBHOOK_URL;
const DJANGO_TOKEN = process.env.WHATSAPP_BOT_WEBHOOK_TOKEN;
const BOT_API_TOKEN = process.env.BOT_API_TOKEN;

// Pausa entre cada envío individual, en milisegundos. Se le suma un jitter aleatorio
// para que no salgan todos a intervalos exactos (menos parecido a un bot).
const DELAY_MIN_MS = Number(process.env.DELAY_MIN_MS || 3000);
const DELAY_MAX_MS = Number(process.env.DELAY_MAX_MS || 6000);

let sock;
let qrActual = null;

// Recuerda a qué cita_id se le envió el último mensaje a cada teléfono,
// así el remitente puede responder solo "CONFIRMADO" sin escribir el ID.
const ultimoEnvioPorTelefono = new Map();

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function delayAleatorio() {
  const ms = DELAY_MIN_MS + Math.random() * (DELAY_MAX_MS - DELAY_MIN_MS);
  return sleep(ms);
}

/** Convierte un teléfono tipo "+573127540816" o "3127540816" al JID de WhatsApp */
function telefonoAJid(telefono) {
  const soloDigitos = telefono.replace(/\D/g, '');
  return `${soloDigitos}@s.whatsapp.net`;
}

async function iniciarBot() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info');

  sock = makeWASocket({ auth: state });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n📱 Escanea este QR con WhatsApp (Dispositivos vinculados):\n');
      qrcodeTerminal.generate(qr, { small: true });
      qrActual = await qrcode.toDataURL(qr);
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error instanceof Boom)
        ? lastDisconnect.error.output?.statusCode
        : null;
      const debeReconectar = statusCode !== DisconnectReason.loggedOut;
      console.log('Conexión cerrada.', debeReconectar ? 'Reconectando...' : 'Sesión cerrada, borra ./auth_info y vuelve a escanear.');
      if (debeReconectar) iniciarBot();
    } else if (connection === 'open') {
      console.log('✅ Bot conectado a WhatsApp');
      qrActual = null;
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    console.log('🔔 messages.upsert, cantidad:', messages.length);
    for (const msg of messages) {
      console.log('🔔 key:', JSON.stringify(msg.key), 'tiene message:', !!msg.message);
      if (!msg.message || msg.key.fromMe) continue;

      const jid = msg.key.remoteJid;
      if (!jid || jid.endsWith('@g.us')) continue;

      // Usa el número de teléfono real si está disponible (mensajes que llegan como @lid lo traen en senderPn)
      const jidParaBuscar = msg.key.senderPn || jid;

      const texto = extraerTexto(msg);
      console.log('🔔 texto:', texto, '| jidParaBuscar:', jidParaBuscar);
      if (!texto) continue;

      const citaId = resolverCitaId(jidParaBuscar, texto);
      console.log('🔔 citaId resuelto:', citaId, '| mapa actual:', JSON.stringify([...ultimoEnvioPorTelefono]));
      if (!citaId) continue;

      const ok = await notificarConfirmacionADjango(citaId);
      const respuesta = ok
        ? `✅ Cita *${citaId}* confirmada. ¡Gracias!`
        : `⚠️ No pude registrar la confirmación de la cita ${citaId}. Intenta de nuevo o avisa al equipo.`;

      try {
        await sock.sendMessage(jidParaBuscar, { text: respuesta });
        console.log('✅ Respuesta enviada correctamente a', jidParaBuscar);
      } catch (err) {
        console.error('❌ Error enviando respuesta:', err.message);
      }

      if (ok) ultimoEnvioPorTelefono.delete(jidParaBuscar);
    }
  });
}

function extraerTexto(msg) {
  return (
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text ||
    null
  );
}

/** Determina a qué cita se refiere la respuesta: por ID explícito, o por el último envío a ese número */
function resolverCitaId(jid, texto) {
  const limpio = texto.trim();

  const conId = limpio.match(/^confirmar\s+(\d+)$/i);
  if (conId) return conId[1];

  const soloConfirmado = /^confirmad[oa]$/i.test(limpio);
  if (soloConfirmado) return ultimoEnvioPorTelefono.get(jid) || null;

  return null;
}

async function notificarConfirmacionADjango(citaId) {
  try {
    await axios.post(
      DJANGO_WEBHOOK_URL,
      { boton_id: `confirmar_cita_${citaId}` },
      { headers: { 'X-Whatsapp-Bot-Token': DJANGO_TOKEN } }
    );
    return true;
  } catch (err) {
    console.error('Error notificando a Django:', err.response?.data || err.message);
    return false;
  }
}

// Django llama a este endpoint cuando se crea una cita nueva.
// Envía el mensaje a cada teléfono en 'telefonos', uno por uno, con pausa entre cada uno.
app.post('/enviar-confirmacion-individual', async (req, res) => {
  if (req.headers['x-api-key'] !== BOT_API_TOKEN) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const { telefonos, cita_id, mensaje } = req.body;
  if (!Array.isArray(telefonos) || telefonos.length === 0 || !cita_id || !mensaje) {
    return res.status(400).json({ error: 'telefonos (array), cita_id y mensaje son obligatorios' });
  }

  if (!sock) {
    return res.status(503).json({ error: 'El bot aún no está conectado a WhatsApp' });
  }

  // Respondemos de inmediato y seguimos enviando en segundo plano,
  // para no dejar a Django/Celery esperando varios segundos por request.
  res.json({ ok: true, enviando_a: telefonos.length });

  const resultados = { enviados: [], fallidos: [] };

  for (let i = 0; i < telefonos.length; i++) {
    const telefono = telefonos[i];
    const jid = telefonoAJid(telefono);

    try {
      await sock.sendMessage(jid, {
        text:
          `${mensaje}\n\n` +
          `Para confirmar que ya la revisaste, responde en este chat:\n` +
          `*CONFIRMADO*`,
      });
      ultimoEnvioPorTelefono.set(jid, String(cita_id));
      resultados.enviados.push(telefono);
    } catch (err) {
      console.error(`Error enviando a ${telefono}:`, err.message);
      resultados.fallidos.push(telefono);
    }

    if (i < telefonos.length - 1) {
      await delayAleatorio();
    }
  }

  console.log(`Cita ${cita_id}: enviados ${resultados.enviados.length}, fallidos ${resultados.fallidos.length}`);
});

app.get('/estado', (req, res) => {
  res.json({
    conectado: !!sock?.user,
    usuario: sock?.user || null,
    tiene_qr: !!qrActual,
  });
});

app.get('/qr', (req, res) => {
  if (!qrActual) {
    return res.status(404).json({ error: 'No hay QR disponible (ya conectado o aún generando)' });
  }
  res.json({ qr: qrActual });
});

app.listen(PORT, () => console.log(`🚀 API del bot escuchando en puerto ${PORT}`));

iniciarBot();