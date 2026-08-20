import { useEffect, useRef, useState } from "react";
import { getEstadoBot, getQrBot, type EstadoBot } from "../services/whatsappBotApi";

export default function EstadoWhatsAppBot() {
  const [estado, setEstado] = useState<EstadoBot | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);

  async function consultar() {
    try {
      const estadoData = await getEstadoBot();
      setEstado(estadoData);
      setError(null);

      if (!estadoData.conectado && estadoData.tiene_qr) {
        const qrData = await getQrBot();
        setQr(qrData);
      } else {
        setQr(null);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo conectar con el bot de WhatsApp"
      );
      setEstado(null);
      setQr(null);
    }
  }

  useEffect(() => {
    consultar();
    intervalRef.current = window.setInterval(consultar, 4000); // revisa cada 4s
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, []);

  if (error) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
        {error}. Verifica que el servicio del bot esté corriendo (
        <code className="text-xs">npm start</code> dentro de <code className="text-xs">whatsapp-bot/</code>).
      </div>
    );
  }

  if (!estado) {
    return <p className="text-sm text-muted-foreground">Consultando estado del bot...</p>;
  }

  if (estado.conectado) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-emerald-500" />
          <p className="text-sm font-medium text-emerald-700">Bot conectado</p>
        </div>
        {estado.usuario?.name && (
          <p className="text-xs text-muted-foreground">Sesión activa: {estado.usuario.name}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="size-2.5 rounded-full bg-amber-500" />
        <p className="text-sm font-medium text-amber-700">Bot desconectado</p>
      </div>
      {qr ? (
        <div className="flex flex-col items-center gap-2">
          <img
            src={qr}
            alt="Código QR de WhatsApp"
            className="h-56 w-56 rounded-md border border-border/70 bg-white p-2"
          />
          <p className="text-center text-xs text-muted-foreground">
            Escanea con WhatsApp → Dispositivos vinculados
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Esperando código QR...</p>
      )}
    </div>
  );
}