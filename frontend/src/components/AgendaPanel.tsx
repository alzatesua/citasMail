import type { Cita } from "../types/calendario";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  fechas: string[];
  citas: Cita[];
}

const HORA_INICIO = 7;
const HORA_FIN = 19;

function formatFechaLarga(fechaISO: string): string {
  const [y, m, d] = fechaISO.split("-").map(Number);
  const fecha = new Date(y, m - 1, d);
  return fecha.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
}

function EstadoBadge({ estado }: { estado: Cita["estado"] }) {
  const esConfirmada = estado === "confirmada";
  return (
    <span
      className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        esConfirmada
          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
          : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
      }`}
    >
      {esConfirmada ? "Confirmada" : "Pendiente"}
    </span>
  );
}

export default function AgendaPanel({ fechas, citas }: Props) {
  if (fechas.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          Selecciona un día en el calendario para ver las citas.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-lg border-border/80 shadow-sm">
      <CardHeader className="border-b border-border/70 p-4">
        <CardTitle className="text-lg">Agenda</CardTitle>
        <p className="text-sm text-muted-foreground">Detalle por hora de la selección actual.</p>
      </CardHeader>
      <CardContent className="p-3">
        <ScrollArea className="h-[690px] pr-2">
          <div className="space-y-4">
        {fechas.map((fecha) => {
          const citasDelDia = citas
            .filter((c) => c.fecha === fecha)
            .sort((a, b) => a.hora.localeCompare(b.hora));

          return (
            <Card key={fecha} className="rounded-md border-border/80">
              <CardHeader className="px-3 pb-2 pt-3">
                <CardTitle className="text-base capitalize">{formatFechaLarga(fecha)}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 px-3 pb-3">
                {Array.from({ length: HORA_FIN - HORA_INICIO }, (_, i) => HORA_INICIO + i).map((hora) => {
                  const horaStr = `${String(hora).padStart(2, "0")}:00`;
                  const citaEnHora = citasDelDia.find((c) => c.hora.startsWith(horaStr.slice(0, 2)));
                  return (
                    <div key={hora} className="flex min-h-9 items-center gap-2 border-b border-border/60 py-1.5 last:border-0">
                      <span className="w-12 shrink-0 text-xs font-medium text-muted-foreground">{horaStr}</span>
                      {citaEnHora ? (
                        <div
                          className="min-w-0 flex-1 rounded-md border px-2 py-1.5 text-sm"
                          style={{
                            borderColor: `${citaEnHora.financiera_color || "#2563EB"}55`,
                            backgroundColor: `${citaEnHora.financiera_color || "#2563EB"}18`,
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate font-semibold text-foreground">{citaEnHora.financiera_nombre}</p>
                            <EstadoBadge estado={citaEnHora.estado} />
                          </div>
                          <p className="truncate text-xs text-muted-foreground">{citaEnHora.sede_nombre}</p>
                        </div>
                      ) : (
                        <div className="h-5 flex-1 rounded-md bg-muted/45" />
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}