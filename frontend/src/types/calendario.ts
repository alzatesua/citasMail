export interface Sede {
  id: number;
  nombre: string;
  ciudad: string;
  activa: boolean;
}

export interface Remitente {
  id: number;
  sede: number;
  nombre: string;
  correo: string;
  whatsapp: string;
  activo: boolean;
  creado_en: string;
  calendario_compartido: boolean;
  calendario_compartido_en: string | null;
}

export interface Financiera {
  id: number;
  nombre: string;
  codigo: string;
  color: string;
  activa: boolean;
}

export interface Cita {
  id: number;
  sede: number;
  sede_nombre: string;
  financiera: number;
  financiera_nombre: string;
  financiera_color: string;
  fecha: string;
  hora: string;
  estado: string;
  observaciones: string;
  creado_por: number;
  creado_en: string;
  actualizado_en: string;
}
