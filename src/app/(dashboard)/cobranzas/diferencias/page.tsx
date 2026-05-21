import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/layout/Topbar";
import { fmtMoneySign } from "@/lib/utils/format";

export default async function DiferenciasPage() {
  const supabase = await createClient();

  const { data: controles } = await supabase
    .from("control_cobranzas")
    .select("*, retiro:retiro_id(id, veterinaria_texto_original, personal:personal_id(nombre))")
    .eq("estado", "diferencia")
    .order("updated_at", { ascending: false });

  return (
    <div>
      <Topbar title="Cobranzas — Diferencias" />
      <div className="p-6">
        <div className="bg-white rounded-[14px] border border-gy200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="bg-gy50">
                  {["ID", "Personal", "Veterinaria", "Declarado", "Validado", "Diferencia", "Detalle", "Acción"].map((h) => (
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
                      <td className="px-3.5 py-2.5 font-medium">{r?.personal?.nombre ?? "—"}</td>
                      <td className="px-3.5 py-2.5">{r?.veterinaria_texto_original}</td>
                      <td className="px-3.5 py-2.5">{fmtMoneySign(c.importe_declarado)}</td>
                      <td className="px-3.5 py-2.5">{fmtMoneySign(c.importe_validado ?? 0)}</td>
                      <td className={`px-3.5 py-2.5 font-bold ${diff < 0 ? "text-red-600" : "text-g700"}`}>
                        {diff >= 0 ? "+" : ""}{fmtMoneySign(diff)}
                      </td>
                      <td className="px-3.5 py-2.5 text-gy600">{c.detalle ?? "—"}</td>
                      <td className="px-3.5 py-2.5">
                        <button className={`flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-[6px] border ${diff < 0 ? "bg-red-50 text-red-700 border-red-200" : "bg-g50 text-g700 border-g200"}`}>
                          Revisar
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!controles?.length && (
                  <tr><td colSpan={8} className="py-10 text-center text-gy400">Sin diferencias detectadas</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
