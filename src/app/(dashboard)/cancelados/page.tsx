import { createAdminClient } from "@/lib/supabase/admin";
import { Topbar } from "@/components/layout/Topbar";
import { TablaControladosRO } from "@/components/preanalitica/TablaControladosRO";

// El cliente admin no lee cookies; sin esto Next.js cachea la consulta GET
// y muestra datos viejos. Forzamos render dinámico y datos frescos.
export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

export default async function CanceladosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const admin = createAdminClient();

  // Todo lo cancelado por preanalítica/dirección o anulado por etiqueta.
  const { data: rows } = await admin
    .from("control_preanalitica")
    .select("*, retiro:retiro_id(id, cantidad_muestras, fecha_operativa, veterinaria_texto_original, codigo_original, personal:personal_id(nombre))")
    .or("cancelado.eq.true,etiquetas.cs.{Anula}")
    .order("updated_at", { ascending: false })
    .limit(500);

  const term = (q ?? "").trim().toLowerCase();
  const controles = !term
    ? (rows ?? [])
    : (rows ?? []).filter((c) => {
        const r = c.retiro as AnyRecord;
        return [r?.personal?.nombre, r?.veterinaria_texto_original, r?.codigo_original]
          .some((v) => String(v ?? "").toLowerCase().includes(term));
      });

  const respIds = Array.from(new Set(controles.map((c) => c.responsable_id).filter(Boolean)));
  const nombrePorId = new Map<string, string>();
  if (respIds.length) {
    const { data: profs } = await admin.from("profiles").select("id, nombre").in("id", respIds);
    for (const p of profs ?? []) nombrePorId.set(p.id, p.nombre);
  }

  return (
    <div>
      <Topbar title="Cancelados / Anulados" />
      <div className="px-6 pt-4">
        <form method="get" className="flex items-end gap-2 flex-wrap">
          <div className="flex-1 min-w-[200px] max-w-[320px]">
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-gy400 mb-1">Buscar (cadete, veterinaria, código)</label>
            <input type="text" name="q" defaultValue={q ?? ""} placeholder="Buscar…"
              className="w-full px-2.5 py-1.5 border-2 border-gy200 rounded-[8px] text-[12px] bg-gy50 focus:outline-none focus:border-g500" />
          </div>
          <button type="submit"
            className="px-3.5 py-1.5 bg-g800 text-white text-[12px] font-medium rounded-[8px] hover:bg-g700">Filtrar</button>
          {q && (
            <a href="/cancelados"
              className="px-3.5 py-1.5 bg-white border border-gy200 text-gy600 text-[12px] font-medium rounded-[8px] hover:bg-gy50">Limpiar</a>
          )}
        </form>
        <div className="mt-2 text-[11px] text-gy400">{controles.length} registro{controles.length !== 1 ? "s" : ""} cancelado{controles.length !== 1 ? "s" : ""} / anulado{controles.length !== 1 ? "s" : ""}</div>
      </div>
      <div className="p-6">
        <TablaControladosRO rows={controles} nombrePorId={nombrePorId} emptyText="No hay registros cancelados ni anulados" />
      </div>
    </div>
  );
}
