import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import type { Sede, Financiera } from "../types/calendario";
import { getSedes, getFinancieras, crearCita } from "../services/calendarioApi";
import { useToast } from "../context/ToastContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  open: boolean;
  fechaInicial: string;
  onClose: () => void;
  onCreada: () => void;
}

export default function CitaModal({ open, fechaInicial, onClose, onCreada }: Props) {
  const { showToast } = useToast();
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [financieras, setFinancieras] = useState<Financiera[]>([]);
  const [sede, setSede] = useState<string>("");
  const [financiera, setFinanciera] = useState<string>("");
  const [fecha, setFecha] = useState(fechaInicial);
  const [hora, setHora] = useState("11:00");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFecha(fechaInicial);
    setError(null);
    getSedes().then(setSedes).catch(() => setError("No se pudieron cargar las sedes"));
    getFinancieras().then(setFinancieras).catch(() => setError("No se pudieron cargar las financieras"));
  }, [open, fechaInicial]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!sede || !financiera) {
      setError("Selecciona sede y financiera");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const cita = await crearCita({ sede: Number(sede), financiera: Number(financiera), fecha, hora });
      onCreada();
      onClose();
      showToast(
        `Cita agendada: ${cita.sede_nombre} · ${cita.financiera_nombre} · ${cita.fecha} ${cita.hora.slice(0, 5)} `,
        "success"
      );
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : "Error al agendar la cita";
      setError(mensaje);
      showToast(mensaje, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Agendar cita</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="space-y-2">
            <Label>Sede</Label>
            <Select value={sede} onValueChange={(value) => setSede(value ?? "")}>
              <SelectTrigger className="h-9 w-full px-3 text-sm">
                <SelectValue placeholder="Selecciona una sede" />
              </SelectTrigger>
              <SelectContent>
                {sedes.map((s) => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.nombre} ({s.ciudad})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Financiera</Label>
            <Select value={financiera} onValueChange={(value) => setFinanciera(value ?? "")}>
              <SelectTrigger className="h-9 w-full px-3 text-sm">
                <SelectValue placeholder="Selecciona una financiera" />
              </SelectTrigger>
              <SelectContent>
                {financieras.map((f) => (
                  <SelectItem key={f.id} value={String(f.id)}>
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: f.color }}
                    />
                    {f.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Fecha</Label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            />
          </div>

          <div className="space-y-2">
            <Label>Hora</Label>
            <input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              required
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Agendando..." : "Agendar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}