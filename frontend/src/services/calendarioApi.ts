import { getToken } from "./auth";
import type { Sede, Financiera, Cita, Remitente } from "../types/calendario";

const API_URL = "http://127.0.0.1:8000/api/calendario";

function authHeaders(): HeadersInit {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Token ${token}` } : {}),
  };
}

async function parseApiError(res: Response, fallback: string): Promise<Error> {
  const err = await res.json().catch(() => null);
  const detail =
    err?.detail ||
    err?.error ||
    (Array.isArray(err) ? err.join(", ") : null) ||
    (err && typeof err === "object"
      ? Object.entries(err)
          .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`)
          .join(" | ")
      : null);
  return new Error(detail || fallback);
}

export async function getSedes(): Promise<Sede[]> {
  const res = await fetch(`${API_URL}/sedes/`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Error al cargar sedes");
  return res.json();
}

export interface CrearSedePayload {
  nombre: string;
  ciudad: string;
  activa?: boolean;
}

export async function crearSede(payload: CrearSedePayload): Promise<Sede> {
  const res = await fetch(`${API_URL}/sedes/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await parseApiError(res, "Error al crear la sede");
  return res.json();
}

// ⚠️ Asumo que existe /api/calendario/financieras/ — ajusta si el nombre real es distinto
export async function getFinancieras(): Promise<Financiera[]> {
  const res = await fetch(`${API_URL}/financieras/`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Error al cargar financieras");
  return res.json();
}

export interface CrearFinancieraPayload {
  nombre: string;
  color: string;
  activa?: boolean;
}

export async function crearFinanciera(payload: CrearFinancieraPayload): Promise<Financiera> {
  const res = await fetch(`${API_URL}/financieras/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await parseApiError(res, "Error al crear la financiera");
  return res.json();
}

export async function getCitas(sede: number, estado = "pendiente"): Promise<Cita[]> {
  const res = await fetch(`${API_URL}/citas/?sede=${sede}&estado=${estado}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Error al cargar citas");
  return res.json();
}

export interface CrearRemitentePayload {
  sede: number;
  nombre: string;
  correo: string;
  whatsapp: string;
  activo?: boolean;
}

export async function getRemitentes(sede?: number): Promise<Remitente[]> {
  const params = sede ? `?sede=${sede}` : "";
  const res = await fetch(`${API_URL}/remitentes/${params}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Error al cargar remitentes");
  return res.json();
}

export async function crearRemitente(payload: CrearRemitentePayload): Promise<Remitente> {
  const res = await fetch(`${API_URL}/remitentes/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw await parseApiError(res, "Error al crear el remitente");
  return res.json();
}

export async function sincronizarRemitentes(sede: number): Promise<{
  sede: string;
  ya_compartidos_previamente: number;
  compartidos_ahora: string[];
  fallidos: Array<{ correo: string; error: string }>;
}> {
  const res = await fetch(`${API_URL}/sedes/${sede}/sincronizar-remitentes/`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw await parseApiError(res, "Error al sincronizar remitentes");
  return res.json();
}

export async function getHistorico(params: {
  sede?: number;
  anio?: number;
  mes?: number;
  fechaInicio?: string;
  fechaFin?: string;
}): Promise<Cita[]> {
  const search = new URLSearchParams();
  if (params.sede) search.set("sede", String(params.sede));

  if (params.fechaInicio || params.fechaFin) {
    // El rango de fechas tiene prioridad sobre año/mes (así lo espera el backend)
    if (params.fechaInicio) search.set("fecha_inicio", params.fechaInicio);
    if (params.fechaFin) search.set("fecha_fin", params.fechaFin);
  } else {
    if (params.anio) search.set("anio", String(params.anio));
    if (params.mes) search.set("mes", String(params.mes));
  }

  const query = search.toString();
  const res = await fetch(`${API_URL}/historico/${query ? `?${query}` : ""}`, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Error al cargar el histórico");
  return res.json();
}

export interface CrearCitaPayload {
  sede: number;
  financiera: number;
  fecha: string;
  hora: string;
  observaciones?: string;
}

export async function crearCita(payload: CrearCitaPayload): Promise<Cita> {
  const res = await fetch(`${API_URL}/citas/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw await parseApiError(res, "Error al crear la cita");
  }
  return res.json();
}