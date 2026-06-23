import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Topbar } from "@/components/layout/Topbar";
import { EtiquetasChips } from "@/components/preanalitica/EtiquetasChips";
import { ControlValor } from "@/components/preanalitica/ControlValor";
import { ControladoAcciones } from "@/components/preanalitica/ControladoAcciones";
import { formatDateTime } from "@/lib/utils/dates";
import { esCanceladoOAnulado, etiquetaRojo } from "@/lib/utils/preanalitica";

export default async function PreanaliticaControladosPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; q?: string }>;
}) {
  const supabase = await createClient();
  const { desde, hasta, q } = await searchParams;

  // Sin filtro de fechas, por defecto se muestran los controlados de hoy.
  const today = new Date().toISOString().split("T")[0];
  const desdeEf = desde || (hasta ? undefined : today);

  let query = supabase
    .from("control_preanalitica")
    .select("*, retiro:retiro_id(id, cantidad_muestras, fecha_operativa, veterinaria_texto_original, codigo_original, personal:personal_id(nombre))")
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
        const r = c.retiro as any;
        return [r?.personal?.nombre, r?.veterinaria_texto_original, r?.codigo_original]
          .some((v) => String(v ?? "").toLowerCase().includes(term));
      });

  // Resolver nombres de los responsables (RLS de profiles no deja leer otros perfiles).
  const respIds = Array.from(new Set(controles.map((c) => c.responsable_id).filter(Boolean)));
  const nombrePorId = new Map<string, string>();
  if (respIds.length) {
    const { data: profs } = await createAdminClient().from("profiles").select("id, nombre").in("id", respIds);
    for (const p of profs ?? []) nombrePorId.set(p.id, p.nombre);
  }

  return (
    <div>
      <Topbar title="Preanalítica — Controlados"
        actions={
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium bg-white border border-gy200 rounded-[6px] hover:bg-gy50">
            <i className="ti ti-download text-[13px]" /> Exportar
          </button>
        }
      />
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
            <a href="/preanalitica/controlados"
              className="px-3.5 py-1.5 bg-white border border-gy200 text-gy600 text-[12px] font-medium rounded-[8px] hover:bg-gy50">Limpiar</a>
          )}
        </form>
        <div className="mt-2 text-[11px] text-gy400">
          {desde || hasta ? "Mostrando el período seleccionado" : "Mostrando controlados de hoy"} · {controles.length} registro{controles.length !== 1 ? "s" : ""}
        </div>
      </div>
      <div className="p-6">
        <div className="bg-white rounded-[14px] border border-gy200 shadow-sm overflow-hidden">
          <div className="table-scroll">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="bg-gy50">
                  {["Código", "Personal", "Veterinaria", "Muestras", "Control 1", "Control 2", "Etiquetas", "Comentario", "Responsable", "Hora", "Acciones"].map((h) => (
                    <th key={h} className="px-3.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-gy400 border-b border-gy200">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {controles.map((c) => {
                  const r = c.retiro as any;
                  const rojo = esCanceladoOAnulado(c);
                  const tag = etiquetaRojo(c);
                  return (
                    <tr key={c.id} className={`border-b border-gy100 last:border-0 ${rojo ? "bg-red-50 hover:bg-red-100/70" : "hover:bg-gy50"}`}>
                      <td className="px-3.5 py-2.5 font-mono text-[11px] text-g700">
                        {tag && <span className="mr-1.5 inline-block px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-red-600 text-white align-middle">{tag.toUpperCase()}</span>}
                        {r?.codigo_original ?? "—"}
                      </td>
                      <td className="px-3.5 py-2.5 font-medium">{r?.personal?.nombre ?? "—"}</td>
                      <td className="px-3.5 py-2.5">{r?.veterinaria_texto_original}</td>
                      <td className="px-3.5 py-2.5 text-center font-semibold">{r?.cantidad_muestras}</td>
                      <td className="px-3.5 py-2.5"><ControlValor valor={c.control_1} /></td>
                      <td className="px-3.5 py-2.5"><ControlValor valor={c.control_2} /></td>
                      <td className="px-3.5 py-2.5"><EtiquetasChips etiquetas={c.etiquetas} /></td>
                      <td className="px-3.5 py-2.5 text-gy600 max-w-[200px]">
                        {c.comentario ? <span className="text-[11px]">{c.comentario}</span> : <span className="text-gy300">—</span>}
                        {rojo && c.cancelado && c.cancelado_motivo && (
                          <div className="text-[10px] text-red-600 mt-0.5">Motivo: {c.cancelado_motivo}</div>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 text-gy600">{c.responsable_id ? (nombrePorId.get(c.responsable_id) ?? "—") : "—"}</td>
                      <td className="px-3.5 py-2.5 text-gy600 whitespace-nowrap">{formatDateTime(c.updated_at)}</td>
                      <td className="px-3.5 py-2.5">
                        <ControladoAcciones controlId={c.id} cancelado={!!c.cancelado} comentario={c.comentario ?? null} />
                      </td>
                    </tr>
                  );
                })}
                {!controles.length && (
                  <tr><td colSpan={11} className="py-10 text-center text-gy400">Sin registros controlados en el período</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
