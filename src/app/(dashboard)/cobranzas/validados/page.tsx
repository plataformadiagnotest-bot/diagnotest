import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Topbar } from "@/components/layout/Topbar";
import { PillStatus } from "@/components/ui/PillStatus";
import { fmtMoneySign } from "@/lib/utils/format";
import { formatDateTime } from "@/lib/utils/dates";

const METODO_PAGO_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  mercado_pago: "Mercado Pago",
  mercadopago: "Mercado Pago",
};

export default async function CobranzasValidadosPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; q?: string }>;
}) {
  const supabase = await createClient();
  const { desde, hasta, q } = await searchParams;

  let query = supabase
    .from("control_cobranzas")
    .select("*, retiro:retiro_id(id, codigo_original, veterinaria_texto_original, metodo_pago, personal:personal_id(nombre))")
    .eq("estado", "adjudicado")
    .order("updated_at", { ascending: false })
    .limit(500);

  if (desde) query = query.gte("updated_at", desde + "T00:00:00Z");
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
      <Topbar title="Cobranzas — Validados"
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
        </form>
      </div>
      <div className="p-6">
        <div className="bg-white rounded-[14px] border border-gy200 shadow-sm overflow-hidden">
          <div className="table-scroll">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="bg-gy50">
                  {["ID", "Fecha", "Personal", "Importe decl.", "Importe valid.", "Diferencia", "Medio", "Observación", "Autorizado por", "Estado"].map((h) => (
                    <th key={h} className="px-3.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-gy400 border-b border-gy200">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(controles ?? []).map((c) => {
                  const r = c.retiro as any;
                  const diff = (c.importe_validado ?? 0) - c.importe_declarado;
                  return (
                    <tr key={c.id} className="hover:bg-gy50 border-b border-gy100 last:border-0">
                      <td className="px-3.5 py-2.5 font-mono text-[11px] text-gy400">{r?.id?.slice(0, 8).toUpperCase()}</td>
                      <td className="px-3.5 py-2.5 text-gy600 whitespace-nowrap">{formatDateTime(c.updated_at)}</td>
                      <td className="px-3.5 py-2.5 font-medium">{r?.personal?.nombre ?? "—"}</td>
                      <td className="px-3.5 py-2.5">{fmtMoneySign(c.importe_declarado)}</td>
                      <td className="px-3.5 py-2.5">{fmtMoneySign(c.importe_validado ?? 0)}</td>
                      <td className={`px-3.5 py-2.5 font-bold ${diff === 0 ? "text-g700" : diff > 0 ? "text-g700" : "text-red-600"}`}>
                        {diff >= 0 ? "+" : ""}{fmtMoneySign(diff)}
                      </td>
                      <td className="px-3.5 py-2.5">{METODO_PAGO_LABEL[r?.metodo_pago as string] ?? "—"}</td>
                      <td className="px-3.5 py-2.5 text-gy600 max-w-[200px] truncate" title={c.detalle ?? ""}>{c.detalle || "—"}</td>
                      <td className="px-3.5 py-2.5 text-gy600">{c.responsable_id ? (nombrePorId.get(c.responsable_id) ?? "—") : "—"}</td>
                      <td className="px-3.5 py-2.5"><PillStatus variant="ok" label="Adjudicado" /></td>
                    </tr>
                  );
                })}
                {!controles?.length && (
                  <tr><td colSpan={10} className="py-10 text-center text-gy400">Sin validaciones en el período</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
