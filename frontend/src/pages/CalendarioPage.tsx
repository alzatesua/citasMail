import { useState, useEffect, useCallback } from "react";
import { Calendar, Views } from "react-big-calendar";
import type { SlotInfo } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { localizer, calendarMessages } from "../lib/calendarLocalizer";
import { getCitas } from "../services/calendarioApi";
import type { Cita } from "../types/calendario";
import AgendaPanel from "../components/AgendaPanel";
import CitaModal from "../components/CitaModal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import "./calendar-shadcn.css";

const SEDE_ACTIVA = 1;

interface CalendarEvent {
  title: string;
  start: Date;
  end: Date;
  resource: Cita;
}

function citaToDate(cita: Cita): Date {
  const [h, m] = cita.hora.split(":").map(Number);
  const [y, mo, d] = cita.fecha.split("-").map(Number);
  return new Date(y, mo - 1, d, h, m);
}

function toLocalDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function CalendarioPage() {
  const [citas, setCitas] = useState<Cita[]>([]);
  const [fechasSeleccionadas, setFechasSeleccionadas] = useState<string[]>([]);
  const [fechaCalendario, setFechaCalendario] = useState(new Date());
  const [modalAbierto, setModalAbierto] = useState(false);
  const [fechaParaModal, setFechaParaModal] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargarCitas = useCallback(() => {
    setCargando(true);
    setError(null);
    Promise.all([getCitas(SEDE_ACTIVA, "pendiente"), getCitas(SEDE_ACTIVA, "confirmada")])
      .then(([pendientes, confirmadas]) => setCitas([...pendientes, ...confirmadas]))
      .catch((err) => {
        console.error(err);
        setError(err instanceof Error ? err.message : "No se pudieron cargar las citas");
      })
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    cargarCitas();
  }, [cargarCitas]);

  const eventos: CalendarEvent[] = citas.map((cita) => {
    const inicio = citaToDate(cita);
    const fin = new Date(inicio.getTime() + 30 * 60000);
    const etiquetaEstado = cita.estado === "confirmada" ? "Confirmada" : "Pendiente";
    return {
      title: `${cita.financiera_nombre} - ${etiquetaEstado}`,
      start: inicio,
      end: fin,
      resource: cita,
    };
  });

  function handleSelectSlot(slotInfo: SlotInfo) {
    const dias: string[] = [];
    const cursor = new Date(slotInfo.start);
    const fin = new Date(slotInfo.end);
    while (cursor < fin) {
      dias.push(toLocalDateInputValue(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    setFechasSeleccionadas(dias.length > 0 ? dias : [toLocalDateInputValue(slotInfo.start)]);
  }

  function abrirModal() {
    setFechaParaModal(fechasSeleccionadas[0] || toLocalDateInputValue(new Date()));
    setModalAbierto(true);
  }

  const hoy = toLocalDateInputValue(new Date());
  const citasHoy = citas.filter((cita) => cita.fecha === hoy).length;
  const citasPendientes = citas.filter((cita) => cita.estado === "pendiente").length;
  const financierasActivas = new Set(citas.map((cita) => cita.financiera)).size;
  const primeraSeleccion = fechasSeleccionadas[0] || hoy;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="rounded-lg border-border/70 bg-card/80 shadow-sm backdrop-blur-xl dark:shadow-black/20">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground">Citas pendientes</p>
              <p className="mt-1 text-2xl font-bold text-primary">{citasPendientes}</p>
            </CardContent>
          </Card>
          <Card className="rounded-lg border-border/70 bg-card/80 shadow-sm backdrop-blur-xl dark:shadow-black/20">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground">Citas de hoy</p>
              <p className="mt-1 text-2xl font-bold text-primary">{citasHoy}</p>
            </CardContent>
          </Card>
          <Card className="rounded-lg border-border/70 bg-card/80 shadow-sm backdrop-blur-xl dark:shadow-black/20">
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground">Financieras</p>
              <p className="mt-1 text-2xl font-bold text-primary">{financierasActivas}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-lg border-border/70 bg-card/85 shadow-sm backdrop-blur-xl dark:shadow-black/25">
          <CardHeader className="flex flex-col gap-3 border-b border-border/70 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg">Calendario de citas</CardTitle>
              <p className="text-sm text-muted-foreground">
                Selecciona un día o rango para revisar la agenda.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={cargarCitas} disabled={cargando} className="h-9 px-3">
                {cargando ? "Actualizando..." : "Actualizar"}
              </Button>
              <Button onClick={abrirModal} className="h-9 px-3">
                Crear cita
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-3 md:p-4">
            {error && (
              <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
        <Calendar
          localizer={localizer}
          culture="es"
          messages={calendarMessages}
          events={eventos}
          date={fechaCalendario}
          onNavigate={(date) => setFechaCalendario(date)}
          defaultView={Views.MONTH}
          views={[Views.MONTH]}
          selectable
          onSelectSlot={handleSelectSlot}
          onSelectEvent={(event) => setFechasSeleccionadas([(event as CalendarEvent).resource.fecha])}
          eventPropGetter={(event) => {
            const cita = (event as CalendarEvent).resource;
            const color = cita.financiera_color || "#2563EB";
            const esPendiente = cita.estado === "pendiente";
            return {
              style: {
                background: color,
                boxShadow: `0 8px 20px ${color}40`,
                opacity: esPendiente ? 0.7 : 1,
                border: esPendiente ? `2px dashed ${color}` : "2px solid transparent",
              },
            };
          }}
          style={{ height: 620 }}
        />
          </CardContent>
        </Card>
      </section>

      <aside className="min-w-0">
        <AgendaPanel fechas={fechasSeleccionadas.length ? fechasSeleccionadas : [primeraSeleccion]} citas={citas} />
      </aside>

      <CitaModal
        open={modalAbierto}
        fechaInicial={fechaParaModal}
        onClose={() => setModalAbierto(false)}
        onCreada={cargarCitas}
      />
    </div>
  );
}