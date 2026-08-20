import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "@/components/ui/button";
import CalendarioPage from "./CalendarioPage";
import EstadoWhatsAppBot from "../components/EstadoWhatsAppBot";
import {
  crearFinanciera,
  crearRemitente,
  crearSede,
  getFinancieras,
  getHistorico,
  getRemitentes,
  getSedes,
  sincronizarRemitentes,
} from "../services/calendarioApi";
import type { Cita, Financiera, Remitente, Sede } from "../types/calendario";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const inputClass =
  "h-9 w-full rounded-md border border-input bg-input/20 px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30";

const thisYear = new Date().getFullYear();
const thisMonth = new Date().getMonth() + 1;
type Tema = "light" | "dark";

export default function Dashboard() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [tema, setTema] = useState<Tema>(() => {
    if (typeof window === "undefined") return "light";
    const guardado = window.localStorage.getItem("dashboard-theme");
    if (guardado === "light" || guardado === "dark") return guardado;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [financieras, setFinancieras] = useState<Financiera[]>([]);
  const [remitentes, setRemitentes] = useState<Remitente[]>([]);
  const [historico, setHistorico] = useState<Cita[]>([]);
  const [modal, setModal] = useState<
    "sede" | "financiera" | "remitente" | "filtro-historico" | "historico" | "lista-remitentes" | "bot-whatsapp" | null
  >(null);
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [nuevaSede, setNuevaSede] = useState({ nombre: "", ciudad: "" });
  const [nuevaFinanciera, setNuevaFinanciera] = useState({ nombre: "", color: "#2563EB" });
  const [nuevoRemitente, setNuevoRemitente] = useState({
    sede: "",
    nombre: "",
    correo: "",
    whatsapp: "",
  });
  const [filtrosHistorico, setFiltrosHistorico] = useState({
    sede: "",
    anio: String(thisYear),
    mes: String(thisMonth),
  });

  const sedesActivas = useMemo(() => sedes.filter((sede) => sede.activa), [sedes]);
  const sedePorId = useMemo(
    () => new Map(sedes.map((sede) => [sede.id, sede.nombre])),
    [sedes]
  );

  async function cargarAdministracion() {
    setCargando(true);
    setError(null);
    try {
      const [sedesData, remitentesData, financierasData] = await Promise.all([
        getSedes(),
        getRemitentes(),
        getFinancieras(),
      ]);
      setSedes(sedesData);
      setRemitentes(remitentesData);
      setFinancieras(financierasData);
      if (!nuevoRemitente.sede && sedesData[0]) {
        setNuevoRemitente((actual) => ({ ...actual, sede: String(sedesData[0].id) }));
      }
      if (!filtrosHistorico.sede && sedesData[0]) {
        setFiltrosHistorico((actual) => ({ ...actual, sede: String(sedesData[0].id) }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la administración");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarAdministracion();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", tema === "dark");
    document.documentElement.style.colorScheme = tema;
    window.localStorage.setItem("dashboard-theme", tema);
  }, [tema]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  async function handleCrearSede(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGuardando(true);
    setError(null);
    setMensaje(null);
    try {
      await crearSede({ ...nuevaSede, activa: true });
      setNuevaSede({ nombre: "", ciudad: "" });
      setModal(null);
      setMensaje("Sede creada correctamente.");
      await cargarAdministracion();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la sede");
    } finally {
      setGuardando(false);
    }
  }

  async function handleCrearFinanciera(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGuardando(true);
    setError(null);
    setMensaje(null);
    try {
      await crearFinanciera({ ...nuevaFinanciera, activa: true });
      setNuevaFinanciera({ nombre: "", color: "#2563EB" });
      setModal(null);
      setMensaje("Financiera creada correctamente.");
      await cargarAdministracion();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la financiera");
    } finally {
      setGuardando(false);
    }
  }

  async function handleCrearRemitente(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGuardando(true);
    setError(null);
    setMensaje(null);
    try {
      await crearRemitente({
        sede: Number(nuevoRemitente.sede),
        nombre: nuevoRemitente.nombre,
        correo: nuevoRemitente.correo,
        whatsapp: nuevoRemitente.whatsapp,
        activo: true,
      });
      setNuevoRemitente((actual) => ({ ...actual, nombre: "", correo: "", whatsapp: "" }));
      setModal(null);
      setMensaje("Remitente creado correctamente.");
      await cargarAdministracion();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el remitente");
    } finally {
      setGuardando(false);
    }
  }

  async function cargarHistorico() {
    setCargando(true);
    setError(null);
    try {
      const citas = await getHistorico({
        sede: filtrosHistorico.sede ? Number(filtrosHistorico.sede) : undefined,
        anio: filtrosHistorico.anio ? Number(filtrosHistorico.anio) : undefined,
        mes: filtrosHistorico.mes ? Number(filtrosHistorico.mes) : undefined,
      });
      setHistorico(citas);
      setModal("historico");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el histórico");
    } finally {
      setCargando(false);
    }
  }

  async function abrirListaRemitentes() {
    setCargando(true);
    setError(null);
    try {
      const remitentesData = await getRemitentes();
      setRemitentes(remitentesData);
      setModal("lista-remitentes");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los remitentes");
    } finally {
      setCargando(false);
    }
  }

  async function handleSincronizarRemitentes(sede: number) {
    setGuardando(true);
    setError(null);
    setMensaje(null);
    try {
      const resultado = await sincronizarRemitentes(sede);
      const remitentesData = await getRemitentes();
      setRemitentes(remitentesData);
      setMensaje(
        `Sincronización de ${resultado.sede}: ${resultado.compartidos_ahora.length} compartidos, ${resultado.fallidos.length} fallidos.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron sincronizar los remitentes");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-transparent text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/75 px-4 py-3 shadow-sm backdrop-blur-xl md:px-8 dark:shadow-black/30">
        <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-primary">Distritec</p>
            <h1 className="text-2xl font-bold tracking-normal text-foreground md:text-3xl">
              Panel de citas
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-md border border-border/80 bg-card/70 p-1 shadow-sm backdrop-blur">
              <Button
                variant={tema === "light" ? "default" : "ghost"}
                onClick={() => setTema("light")}
                className="h-7 px-3"
              >
                Claro
              </Button>
              <Button
                variant={tema === "dark" ? "default" : "ghost"}
                onClick={() => setTema("dark")}
                className="h-7 px-3"
              >
                Oscuro
              </Button>
            </div>
            <Button variant="outline" onClick={() => setModal("sede")} className="h-9 px-3">
              Crear sede
            </Button>
            <Button variant="outline" onClick={() => setModal("financiera")} className="h-9 px-3">
              Crear financiera
            </Button>
            <Button variant="outline" onClick={() => setModal("remitente")} className="h-9 px-3">
              Crear remitente
            </Button>
            <Button variant="outline" onClick={abrirListaRemitentes} disabled={cargando} className="h-9 px-3">
              Ver remitentes
            </Button>
            <Button variant="outline" onClick={() => setModal("bot-whatsapp")} className="h-9 px-3">
              Bot WhatsApp
            </Button>
            <Button
              variant="outline"
              onClick={() => setModal("filtro-historico")}
              disabled={cargando}
              className="h-9 px-3"
            >
              Ver histórico
            </Button>
            <Button variant="outline" onClick={() => navigate("/dashboard")} className="h-9 px-3">
              Inicio
            </Button>
            <Button variant="outline" onClick={handleLogout} className="h-9 px-3">
              Cerrar sesión
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1500px] px-4 py-5 md:px-8 md:py-8">
        {(error || mensaje) && (
          <div
            className={`mb-4 rounded-md border px-3 py-2 text-sm ${
              error
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
            }`}
          >
            {error || mensaje}
          </div>
        )}

        <section className="mb-5 grid gap-3 md:grid-cols-4">
          <Card className="rounded-lg border-border/70 bg-card/80 shadow-sm backdrop-blur-xl dark:shadow-black/20">
            <CardHeader className="pb-1">
              <CardTitle>Sedes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-primary">{sedes.length}</p>
              <p className="text-xs text-muted-foreground">{sedesActivas.length} activas</p>
            </CardContent>
          </Card>
          <Card className="rounded-lg border-border/70 bg-card/80 shadow-sm backdrop-blur-xl dark:shadow-black/20">
            <CardHeader className="pb-1">
              <CardTitle>Remitentes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-primary">{remitentes.length}</p>
              <p className="text-xs text-muted-foreground">
                {remitentes.filter((remitente) => remitente.activo).length} activos
              </p>
            </CardContent>
          </Card>
          <Card className="rounded-lg border-border/70 bg-card/80 shadow-sm backdrop-blur-xl dark:shadow-black/20">
            <CardHeader className="pb-1">
              <CardTitle>Financieras</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold text-primary">{financieras.length}</p>
                <div className="flex -space-x-1">
                  {financieras.slice(0, 5).map((financiera) => (
                    <span
                      key={financiera.id}
                      className="size-4 rounded-full border border-background"
                      style={{ backgroundColor: financiera.color }}
                    />
                  ))}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {financieras.filter((financiera) => financiera.activa).length} activas
              </p>
            </CardContent>
          </Card>
          <Card className="rounded-lg border-border/70 bg-card/80 shadow-sm backdrop-blur-xl dark:shadow-black/20">
            <CardHeader className="pb-1">
              <CardTitle>Histórico</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-primary">{historico.length}</p>
              <p className="text-xs text-muted-foreground">Última consulta cargada</p>
            </CardContent>
          </Card>
        </section>

        <CalendarioPage />
      </main>

      <Dialog open={modal === "sede"} onOpenChange={(open) => setModal(open ? "sede" : null)}>
        <DialogContent>
          <form onSubmit={handleCrearSede} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Crear sede</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nombre</Label>
                <input
                  className={inputClass}
                  value={nuevaSede.nombre}
                  onChange={(event) => setNuevaSede((actual) => ({ ...actual, nombre: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Ciudad</Label>
                <input
                  className={inputClass}
                  value={nuevaSede.ciudad}
                  onChange={(event) => setNuevaSede((actual) => ({ ...actual, ciudad: event.target.value }))}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModal(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={guardando}>
                {guardando ? "Creando..." : "Crear sede"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={modal === "financiera"} onOpenChange={(open) => setModal(open ? "financiera" : null)}>
        <DialogContent>
          <form onSubmit={handleCrearFinanciera} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Crear financiera</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nombre</Label>
                <input
                  className={inputClass}
                  value={nuevaFinanciera.nombre}
                  onChange={(event) =>
                    setNuevaFinanciera((actual) => ({ ...actual, nombre: event.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    className="h-9 w-14 rounded-md border border-input bg-input/20 p-1"
                    value={nuevaFinanciera.color}
                    onChange={(event) =>
                      setNuevaFinanciera((actual) => ({ ...actual, color: event.target.value }))
                    }
                  />
                  <input
                    className={inputClass}
                    value={nuevaFinanciera.color}
                    onChange={(event) =>
                      setNuevaFinanciera((actual) => ({ ...actual, color: event.target.value }))
                    }
                    pattern="^#[0-9A-Fa-f]{6}$"
                    required
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModal(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={guardando}>
                {guardando ? "Creando..." : "Crear financiera"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={modal === "remitente"} onOpenChange={(open) => setModal(open ? "remitente" : null)}>
        <DialogContent>
          <form onSubmit={handleCrearRemitente} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Crear remitente</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Sede</Label>
                <Select
                  value={nuevoRemitente.sede}
                  onValueChange={(value) => setNuevoRemitente((actual) => ({ ...actual, sede: value ?? "" }))}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Selecciona una sede" />
                  </SelectTrigger>
                  <SelectContent>
                    {sedes.map((sede) => (
                      <SelectItem key={sede.id} value={String(sede.id)}>
                        {sede.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Nombre</Label>
                <input
                  className={inputClass}
                  value={nuevoRemitente.nombre}
                  onChange={(event) => setNuevoRemitente((actual) => ({ ...actual, nombre: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Correo</Label>
                <input
                  className={inputClass}
                  type="email"
                  value={nuevoRemitente.correo}
                  onChange={(event) => setNuevoRemitente((actual) => ({ ...actual, correo: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>WhatsApp</Label>
                <input
                  className={inputClass}
                  value={nuevoRemitente.whatsapp}
                  onChange={(event) => setNuevoRemitente((actual) => ({ ...actual, whatsapp: event.target.value }))}
                  placeholder="+573127540816"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModal(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={guardando || !nuevoRemitente.sede}>
                {guardando ? "Creando..." : "Crear remitente"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={modal === "filtro-historico"}
        onOpenChange={(open) => setModal(open ? "filtro-historico" : null)}
      >
        <DialogContent>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              cargarHistorico();
            }}
            className="space-y-4"
          >
            <DialogHeader>
              <DialogTitle>Filtrar histórico</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Sede</Label>
                <Select
                  value={filtrosHistorico.sede}
                  onValueChange={(value) => setFiltrosHistorico((actual) => ({ ...actual, sede: value ?? "" }))}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Selecciona una sede" />
                  </SelectTrigger>
                  <SelectContent>
                    {sedes.map((sede) => (
                      <SelectItem key={sede.id} value={String(sede.id)}>
                        {sede.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Año</Label>
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    value={filtrosHistorico.anio}
                    onChange={(event) =>
                      setFiltrosHistorico((actual) => ({ ...actual, anio: event.target.value }))
                    }
                    placeholder="2026"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Mes</Label>
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    value={filtrosHistorico.mes}
                    onChange={(event) =>
                      setFiltrosHistorico((actual) => ({ ...actual, mes: event.target.value }))
                    }
                    placeholder="8"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setModal(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={cargando}>
                {cargando ? "Consultando..." : "Consultar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={modal === "historico"} onOpenChange={(open) => setModal(open ? "historico" : null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Histórico de citas</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto rounded-md border border-border/70">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="sticky top-0 bg-popover text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Fecha</th>
                  <th className="px-3 py-2 font-medium">Hora</th>
                  <th className="px-3 py-2 font-medium">Sede</th>
                  <th className="px-3 py-2 font-medium">Financiera</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {historico.map((cita) => (
                  <tr key={cita.id} className="border-t border-border/70">
                    <td className="px-3 py-2">{cita.fecha}</td>
                    <td className="px-3 py-2">{cita.hora.slice(0, 5)}</td>
                    <td className="px-3 py-2">{cita.sede_nombre}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: cita.financiera_color || "#2563EB" }}
                        />
                        {cita.financiera_nombre}
                      </span>
                    </td>
                    <td className="px-3 py-2 capitalize">{cita.estado}</td>
                  </tr>
                ))}
                {!historico.length && (
                  <tr>
                    <td className="px-3 py-6 text-center text-muted-foreground" colSpan={5}>
                      No hay citas para los filtros seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModal("filtro-historico")}>
              Cambiar filtros
            </Button>
            <Button variant="outline" onClick={cargarHistorico} disabled={cargando}>
              {cargando ? "Actualizando..." : "Actualizar"}
            </Button>
            <Button onClick={() => setModal(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={modal === "lista-remitentes"}
        onOpenChange={(open) => setModal(open ? "lista-remitentes" : null)}
      >
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Remitentes</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto rounded-md border border-border/70">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="sticky top-0 bg-popover text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Nombre</th>
                  <th className="px-3 py-2 font-medium">Sede</th>
                  <th className="px-3 py-2 font-medium">Correo</th>
                  <th className="px-3 py-2 font-medium">WhatsApp</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                  <th className="px-3 py-2 font-medium">Calendario</th>
                  <th className="px-3 py-2 font-medium">Acción</th>
                </tr>
              </thead>
              <tbody>
                {remitentes.map((remitente) => (
                  <tr key={remitente.id} className="border-t border-border/70 align-middle">
                    <td className="px-3 py-2 font-medium">{remitente.nombre}</td>
                    <td className="px-3 py-2">{sedePorId.get(remitente.sede) || `Sede ${remitente.sede}`}</td>
                    <td className="px-3 py-2">{remitente.correo}</td>
                    <td className="px-3 py-2">{remitente.whatsapp}</td>
                    <td className="px-3 py-2">{remitente.activo ? "Activo" : "Inactivo"}</td>
                    <td className="px-3 py-2">
                      {remitente.calendario_compartido ? (
                        <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700">
                          Compartido
                        </span>
                      ) : (
                        <span className="rounded-md bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-700">
                          Pendiente
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {!remitente.calendario_compartido ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSincronizarRemitentes(remitente.sede)}
                          disabled={guardando}
                        >
                          {guardando ? "Sincronizando..." : "Sincronizar sede"}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {remitente.calendario_compartido_en
                            ? new Date(remitente.calendario_compartido_en).toLocaleString("es-CO")
                            : "Listo"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {!remitentes.length && (
                  <tr>
                    <td className="px-3 py-6 text-center text-muted-foreground" colSpan={7}>
                      No hay remitentes registrados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={abrirListaRemitentes} disabled={cargando}>
              {cargando ? "Actualizando..." : "Actualizar"}
            </Button>
            <Button onClick={() => setModal(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={modal === "bot-whatsapp"} onOpenChange={(open) => setModal(open ? "bot-whatsapp" : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Estado del bot de WhatsApp</DialogTitle>
          </DialogHeader>
          <EstadoWhatsAppBot />
          <DialogFooter>
            <Button onClick={() => setModal(null)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
