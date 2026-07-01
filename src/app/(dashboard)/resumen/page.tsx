import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/layout/Topbar";
import { StatCard } from "@/components/ui/StatCard";
import { MuestrasPorCadete } from "@/components/caja/MuestrasPorCadete";
import { RecaudadoHoy } from "@/components/caja/RecaudadoHoy";
import { ResumenPendientesEtapa } from "@/components/preanalitica/ResumenPendientesEtapa";
import { todayISO, formatDate, baDayStartUTC } from "@/lib/utils/dates";
import { landingPathForRole } from "@/lib/utils/roles";

// Lectura fresca siempre: las bolsas cargadas a mano tienen que verse apenas se
// guardan (sin esto Next cachea la consulta y muestra valores viejos).
export const dynamic = "force-dynamic";

const ROLES_RESUMEN = ["preanalitica", "dueno", "super_admin"];

export default async function ResumenPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; cadete?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: rolRow } = await supabase.from("profiles").select("rol").eq("id", user.id).single();
  if (!rolRow || !ROLES_RESUMEN.includes(rolRow.rol)) redirect(landingPathForRole(rolRow?.rol));

  const { fecha, cadete } = await searchParams;
  const hoy = todayISO();
  const dia = fecha || hoy;
  const esHoy = dia === hoy;
  const etiqueta = esHoy ? "hoy" : formatDate(dia, "dd/MM/yyyy");

  // Tarjetas de estado (siempre el momento actual, no dependen del día buscado).
  const [{ count: pendientes }, { count: urgentes }, { count: controladosHoy }, { count: observados }] = await Promise.all([
    supabase.from("control_preanalitica")
      .select("id, retiro:retiro_id!inner(anulado, estado)", { count: "exact", head: true })
      .eq("estado", "pendiente").eq("retiro.anulado", false).neq("retiro.estado", "duplicado_sospechoso"),
    supabase.from("control_preanalitica")
      .select("id, retiro:retiro_id!inner(anulado, estado, urgente)", { count: "exact", head: true })
      .eq("estado", "pendiente").eq("retiro.anulado", false).neq("retiro.estado", "duplicado_sospechoso").eq("retiro.urgente", true),
    supabase.from("control_preanalitica")
      .select("id", { count: "exact", head: true }).eq("estado", "ok").gte("updated_at", baDayStartUTC(hoy)),
    supabase.from("control_preanalitica")
      .select("id", { count: "exact", head: true }).in("estado", ["observado", "rechazado"]),
  ]);

  return (
    <div>
      <Topbar title="Resumen" />
      <div className="p-6 space-y-4">
        {/* Estado actual de preanalítica */}
        <div className="grid grid-cols-4 gap-3.5">
          <StatCard label="Pendientes de control" value={pendientes ?? 0} accent="warn" />
          <StatCard label="Urgentes" value={urgentes ?? 0} accent="danger" />
          <StatCard label="Controlados hoy" value={controladosHoy ?? 0} />
          <StatCard label="Observados" value={observados ?? 0} accent="warn" />
        </div>

        <ResumenPendientesEtapa />

        {/* Buscador: trae el resumen (muestras + bolsas + recaudado) de un día,
            con filtro opcional por cadete. Por defecto muestra hoy. */}
        <form method="get" className="flex items-end gap-2 flex-wrap bg-white rounded-[12px] border border-gy200 shadow-sm p-3.5">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-gy400 mb-1">Día</label>
            <input type="date" name="fecha" defaultValue={fecha ?? hoy}
              className="px-2.5 py-1.5 border-2 border-gy200 rounded-[8px] text-[12px] bg-gy50 focus:outline-none focus:border-g500" />
          </div>
          <div className="min-w-[180px]">
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-gy400 mb-1">Cadete</label>
            <input type="text" name="cadete" defaultValue={cadete ?? ""} placeholder="Nombre del cadete…"
              className="w-full px-2.5 py-1.5 border-2 border-gy200 rounded-[8px] text-[12px] bg-gy50 focus:outline-none focus:border-g500" />
          </div>
          <button type="submit"
            className="px-3.5 py-1.5 bg-g800 text-white text-[12px] font-medium rounded-[8px] hover:bg-g700">Buscar</button>
          {(fecha || cadete) && (
            <a href="/resumen" className="px-3 py-1.5 text-[12px] text-gy500 hover:text-gy700">Hoy</a>
          )}
          <div className="flex-1" />
          <span className="text-[11px] text-gy400 self-center">
            {esHoy ? "Mostrando hoy" : `Mostrando ${etiqueta}`}{cadete ? ` · cadete "${cadete}"` : ""}
          </span>
        </form>

        <div className="grid grid-cols-2 gap-3.5">
          <MuestrasPorCadete fecha={dia} filtroNombre={cadete} etiqueta={etiqueta} />
          <RecaudadoHoy fecha={dia} filtroNombre={cadete} etiqueta={etiqueta} />
        </div>
      </div>
    </div>
  );
}
