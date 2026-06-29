import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/layout/Topbar";
import { StatCard } from "@/components/ui/StatCard";
import { PreanaliticaBandeja } from "@/components/preanalitica/PreanaliticaBandeja";
import { ResumenPendientesEtapa } from "@/components/preanalitica/ResumenPendientesEtapa";
import { RecaudadoHoy } from "@/components/caja/RecaudadoHoy";
import { MuestrasPorCadete } from "@/components/caja/MuestrasPorCadete";
import { todayISO, baDayStartUTC } from "@/lib/utils/dates";

export default async function PreanaliticaPage() {
  const supabase = await createClient();
  const today = todayISO();

  // Todo lo pendiente/observado, sin filtrar por fecha: lo que quedó sin
  // controlar de días anteriores tiene que seguir viéndose. La bandeja lo
  // agrupa por fecha operativa (como si la fecha fuera un cadete más).
  // !inner + filtros sobre el retiro: la bandeja no muestra controles de
  // retiros anulados ni de duplicados sospechosos (esos van a su propia
  // pantalla de revisión, no al control de preanalítica).
  const { data: controles } = await supabase
    .from("control_preanalitica")
    .select(`
      *,
      retiro:retiro_id!inner(
        id, cantidad_muestras, comentarios, urgente, fecha_operativa, timestamp_carga,
        veterinaria_texto_original, codigo_original, comprobante_url, segunda_visita,
        personal:personal_id(nombre),
        veterinaria:veterinaria_id(codigo, nombre)
      )
    `)
    .in("estado", ["pendiente", "observado"])
    .eq("retiro.anulado", false)
    .neq("retiro.estado", "duplicado_sospechoso")
    .order("created_at", { ascending: true });

  // Conteos reales para las tarjetas (head: true → solo trae el count).
  const [{ count: controladosHoy }, { count: observados }] = await Promise.all([
    supabase
      .from("control_preanalitica")
      .select("id", { count: "exact", head: true })
      .eq("estado", "ok")
      .gte("updated_at", baDayStartUTC(today)),
    supabase
      .from("control_preanalitica")
      .select("id", { count: "exact", head: true })
      .in("estado", ["observado", "rechazado"]),
  ]);

  const pendientes = controles?.filter((c) => c.estado === "pendiente").length ?? 0;
  const urgentes = controles?.filter((c) => c.urgente || (c.retiro as { urgente?: boolean } | null)?.urgente).length ?? 0;

  return (
    <div>
      <Topbar title="Bandeja Preanalítica" />
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-4 gap-3.5">
          <StatCard label="Pendientes de control" value={pendientes} accent="warn" />
          <StatCard label="Urgentes" value={urgentes} accent="danger" />
          <StatCard label="Controlados hoy" value={controladosHoy ?? 0} />
          <StatCard label="Observados" value={observados ?? 0} accent="warn" />
        </div>

        <ResumenPendientesEtapa />

        <div className="grid grid-cols-2 gap-3.5">
          <MuestrasPorCadete />
          <RecaudadoHoy />
        </div>

        <PreanaliticaBandeja controles={controles ?? []} />
      </div>
    </div>
  );
}
