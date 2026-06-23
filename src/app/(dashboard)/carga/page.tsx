import { createAdminClient } from "@/lib/supabase/admin";
import { Topbar } from "@/components/layout/Topbar";
import { TablaControladosRO } from "@/components/preanalitica/TablaControladosRO";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

export default async function CargaPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; q?: string }>;
}) {
  const { desde, hasta, q } = await searchParams;
  const admin = createAdminClient();

  // Por defecto, controlados de hoy; el rol carga es de solo lectura.
  const today = new Date().toISOString().split("T")[0];
  const desdeEf = desde || (hasta ? undefined : today);

  let query = admin
    .from("control_preanalitica")
    .select("*, retiro:retiro_id(id, cantidad_muestras, fecha_operativa, veterinaria_texto_original, codigo_original, comprobante_url, personal:personal_id(nombre))")
    .eq("estado", "ok")
    .order("updated_at", { ascending: false })
    .limit(500);

  if (desdeEf) query = query.gte("updated_at", desdeEf + "T00:00:00Z");
  if (hasta) query = query.lte("updated_at", hasta + "T23:59:59Z");

  const { data: rows } = await query;

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
      <Topbar title="Carga — Controlados" />
      <div className="px-6 pt-4">
        <form method="get" className="flex items-end gap-2 flex-wrap">
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-gy400 mb-1">Desde</label>
            <input type="date" name="desde" defaultValue={desde ?? ""}
              className="px-2.5 py-1.5 border-2 border-gy200 rounded-[8px] text-[12px] bg-gy50 focus:outline-none focus:border-g500" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-gy400 mb-1">Hasta</label>
            <input type="date" name="hasta" defaultValue={hasta ?? ""}
              className="px-2.5 py-1.5 border-2 border-gy200 rounded-[8px] text-[12px] bg-gy50 focus:outline-none focus:border-g500" />
          </div>
          <div className="flex-1 min-w-[200px] max-w-[320px]">
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-gy400 mb-1">Buscar (cadete, veterinaria, código)</label>
            <input type="text" name="q" defaultValue={q ?? ""} placeholder="Buscar…"
              className="w-full px-2.5 py-1.5 border-2 border-gy200 rounded-[8px] text-[12px] bg-gy50 focus:outline-none focus:border-g500" />
          </div>
          <button type="submit"
            className="px-3.5 py-1.5 bg-g800 text-white text-[12px] font-medium rounded-[8px] hover:bg-g700">Filtrar</button>
          {(desde || hasta || q) && (
            <a href="/carga"
              className="px-3.5 py-1.5 bg-white border border-gy200 text-gy600 text-[12px] font-medium rounded-[8px] hover:bg-gy50">Limpiar</a>
          )}
        </form>
        <div className="mt-2 text-[11px] text-gy400">
          {desde || hasta ? "Mostrando el período seleccionado" : "Mostrando controlados de hoy"} · {controles.length} registro{controles.length !== 1 ? "s" : ""}
        </div>
      </div>
      <div className="p-6">
        <TablaControladosRO rows={controles} nombrePorId={nombrePorId} emptyText="Sin registros controlados en el período" />
      </div>
    </div>
  );
}
