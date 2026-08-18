import { dateFnsLocalizer } from "react-big-calendar";
import { format } from "date-fns/format";
import { parse } from "date-fns/parse";
import { startOfWeek } from "date-fns/startOfWeek";
import { getDay } from "date-fns/getDay";
import { es } from "date-fns/locale";

const locales = { es };

export const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { locale: es, weekStartsOn: 1 }),
  getDay,
  locales,
});

export const calendarMessages = {
  allDay: "Todo el día",
  previous: "Atrás",
  next: "Siguiente",
  today: "Hoy",
  month: "Mes",
  week: "Semana",
  day: "Día",
  agenda: "Agenda",
  date: "Fecha",
  time: "Hora",
  event: "Cita",
  noEventsInRange: "No hay citas en este rango.",
  showMore: (total: number) => `+ Ver ${total} más`,
};
