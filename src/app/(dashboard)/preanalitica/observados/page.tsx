import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/layout/Topbar";
import { PillStatus } from "@/components/ui/PillStatus";

export default async function PreanaliticaObservadosPage() {
  const supabase = await createClient();

  const { data: controles } = await supabase
    .from("control_preanalitica")
    .select("*, retiro:retiro_id(id, veterinaria_texto_original, personal:personal_id(nombre))")
    .in("estado", ["observado", "rechazado"])
    .order("updated_at", { ascending: false });

  return (
    <div>
      <Topbar title="Preanalítica — Observados" />
      <div className="p-6">
        <div className="bg-white rounded-[14px] border border-gy200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="bg-gy50">
                  {["ID", "Personal", "Veterinaria", "Estado", "Detalle", "Acción"].map((h) => (
                    <th key={h} className="px-3.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-gy400 border-b border-gy200">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(controles ?? []).map((c) => {
                  const r = c.retiro as any;
                  return (
                    <tr key={c.id} className="hover:bg-gy50 border-b border-gy100 last:border-0">
                      <td className="px-3.5 py-2.5 font-mono text-[11px] text-gy400">{r?.id?.slice(0, 8).toUpperCase()}</td>
                      <td className="px-3.5 py-2.5 font-medium">{r?.personal?.nombre ?? "—"}</td>
                      <td className="px-3.5 py-2.5">{r?.veterinaria_texto_original}</td>
                      <td className="px-3.5 py-2.5"><PillStatus variant={c.estado === "rechazado" ? "observado" : "observado"} label={c.estado} /></td>
                      <td className="px-3.5 py-2.5 text-gy600">{c.detalle ?? "—"}</td>
                      <td className="px-3.5 py-2.5">
                        <button className="flex items-center gap-1 px-2.5 py-1 text-[11px] bg-g50 text-g700 border border-g200 rounded-[6px]">
                          <i className="ti ti-check text-[13px]" /> Resolver
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {!controles?.length && (
                  <tr><td colSpan={6} className="py-10 text-center text-gy400">Sin registros observados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
