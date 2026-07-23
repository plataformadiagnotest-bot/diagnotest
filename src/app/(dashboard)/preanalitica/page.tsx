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
  const SELECT = `
      *,
      retiro:retiro_id!inner(
        id, cantidad_muestras, comentarios, urgente, fecha_operativa, timestamp_carga,
        veterinaria_texto_original, codigo_original, comprobante_url, segunda_visita,
        personal:personal_id(nombre),
        veterinaria:veterinaria_id(codigo, nombre)
      )
    `;
  const lista = () => supabase
    .from("control_preanalitica").select(SELECT)
    .in("estado", ["pendiente", "observado"])
    .eq("retiro.anulado", false)
    .neq("retiro.estado", "duplicado_sospechoso")
    .order("created_at", { ascending: true });
  const conteo = () => supabase
    .from("control_preanalitica")
    .select("id, retiro:retiro_id!inner(anulado, estado)", { count: "exact", head: true })
    .in("estado", ["pendiente", "observado"])
    .eq("retiro.anulado", false)
    .neq("retiro.estado", "duplicado_sospechoso");

  // Robustez: bajo carga la consulta puede fallar o volver corta y, si mostramos
  // eso como "0 pendientes", preanalítica cree que terminó. Reintentamos y
  // cruzamos con un conteo liviano; solo aceptamos el resultado si no hubo error
  // y la cantidad traída coincide con el conteo (o el conteo no está disponible).
  let controles: Record<string, unknown>[] = [];
  for (let intento = 0; intento < 3; intento++) {
    const [{ data, error }, { count }] = await Promise.all([lista(), conteo()]);
    controles = (data ?? []) as Record<string, unknown>[];
    if (!error && (count == null || controles.length >= count)) break;
    if (intento < 2) await new Promise((r) => setTimeout(r, 200));
  }

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
