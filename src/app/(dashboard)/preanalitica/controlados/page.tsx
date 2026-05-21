import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/layout/Topbar";
import { PillStatus } from "@/components/ui/PillStatus";
import { formatDateTime } from "@/lib/utils/dates";

export default async function PreanaliticaControladosPage() {
  const supabase = await createClient();

  const today = new Date().toISOString().split("T")[0];
  const { data: controles } = await supabase
    .from("control_preanalitica")
    .select("*, retiro:retiro_id(id, cantidad_muestras, fecha_operativa, veterinaria_texto_original, personal:personal_id(nombre))")
    .eq("estado", "ok")
    .gte("updated_at", today + "T00:00:00Z")
    .order("updated_at", { ascending: false });

  return (
    <div>
      <Topbar title="Preanalítica — Controlados"
        actions={
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium bg-white border border-gy200 rounded-[6px] hover:bg-gy50">
            <i className="ti ti-download text-[13px]" /> Exportar
          </button>
        }
      />
      <div className="p-6">
        <div className="bg-white rounded-[14px] border border-gy200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="bg-gy50">
                  {["ID", "Personal", "Veterinaria", "Muestras", "Control 1", "Control 2", "Responsable", "Hora"].map((h) => (
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
                      <td className="px-3.5 py-2.5 text-center font-semibold">{r?.cantidad_muestras}</td>
                      <td className="px-3.5 py-2.5"><PillStatus variant={c.control_1 === "ok" ? "ok" : "pendiente"} label={c.control_1 ?? "—"} /></td>
                      <td className="px-3.5 py-2.5"><PillStatus variant={c.control_2 === "ok" ? "ok" : "pendiente"} label={c.control_2 ?? "—"} /></td>
                      <td className="px-3.5 py-2.5 text-gy600">Responsable</td>
                      <td className="px-3.5 py-2.5 text-gy600">{formatDateTime(c.updated_at)}</td>
                    </tr>
                  );
                })}
                {!controles?.length && (
                  <tr><td colSpan={8} className="py-10 text-center text-gy400">Sin registros controlados hoy</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
