const BOT_URL = import.meta.env.VITE_WHATSAPP_BOT_URL || "http://localhost:3001";

export interface EstadoBot {
  conectado: boolean;
  usuario: { id: string; name?: string } | null;
  tiene_qr: boolean;
}

export async function getEstadoBot(): Promise<EstadoBot> {
  const res = await fetch(`${BOT_URL}/estado`);
  if (!res.ok) throw new Error("No se pudo consultar el estado del bot");
  return res.json();
}

/** Devuelve la imagen del QR como data URL, o null si ya está conectado / aún no hay QR */
export async function getQrBot(): Promise<string | null> {
  const res = await fetch(`${BOT_URL}/qr`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("No se pudo obtener el QR del bot");
  const data = await res.json();
  return data.qr as string;
}