import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/layout/Topbar";
import { PreanaliticaBandeja } from "@/components/preanalitica/PreanaliticaBandeja";
import { MuestrasPorCadete } from "@/components/caja/MuestrasPorCadete";

// Lectura fresca en cada render: al controlar una tarjeta se hace router.refresh()
// y, sin esto, Next puede devolver la consulta cacheada/vacía y las solapas de
// Control 1/2 aparecen en 0 hasta recargar a mano.
export const dynamic = "force-dynamic";

export default async function PreanaliticaPage() {
  const supabase = await createClient();

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

  // Responsable activo por etapa (para precargar la barra de "quién controla"
  // aunque la bandeja esté vacía). Defensivo por si la tabla aún no existe.
  const { data: respActivo } = await supabase
    .from("preanalitica_responsable_activo")
    .select("stage, responsable");
  const respC1 = respActivo?.find((r) => r.stage === "c1")?.responsable ?? null;
  const respC2 = respActivo?.find((r) => r.stage === "c2")?.responsable ?? null;

  return (
    <div>
      <Topbar title="Bandeja Preanalítica" />
      <div className="p-6 space-y-4">
        {/* Muestras + Bolsas por cadete: preanalítica controla acá las bolsas que
            recibe de cada cadete al llegar (V1/V2 editables). */}
        <MuestrasPorCadete />

        <PreanaliticaBandeja controles={controles ?? []} respActivoC1={respC1} respActivoC2={respC2} />
      </div>
    </div>
  );
}
