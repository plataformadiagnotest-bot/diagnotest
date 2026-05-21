import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/layout/Topbar";
import { PillStatus } from "@/components/ui/PillStatus";

export default async function ZonasPage() {
  const supabase = await createClient();
  const { data: zonas } = await supabase.from("zonas").select("*").order("nombre");

  return (
    <div>
      <Topbar title="Maestro de Zonas"
        actions={
          <button className="flex items-center gap-1.5 px-3.5 py-2 bg-g800 text-white text-[12px] font-medium rounded-[6px] hover:bg-g700">
            <i className="ti ti-plus" /> Nueva zona
          </button>
        }
      />
      <div className="p-6">
        <div className="bg-white rounded-[14px] border border-gy200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="bg-gy50">
                  {["ID", "Nombre", "Descripción", "Estado", ""].map((h) => (
                    <th key={h} className="px-3.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-gy400 border-b border-gy200">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(zonas ?? []).map((z) => (
                  <tr key={z.id} className="hover:bg-gy50 border-b border-gy100 last:border-0">
                    <td className="px-3.5 py-2.5 font-mono text-[11px] text-gy400">{z.id.slice(0, 8)}</td>
                    <td className="px-3.5 py-2.5 font-medium text-gy900">{z.nombre}</td>
                    <td className="px-3.5 py-2.5 text-gy600">{z.descripcion ?? "—"}</td>
                    <td className="px-3.5 py-2.5"><PillStatus variant={z.activa ? "ok" : "grey"} label={z.activa ? "Activa" : "Inactiva"} /></td>
                    <td className="px-3.5 py-2.5">
                      <button className="px-2 py-1 text-[11px] bg-white border border-gy200 rounded-[6px] hover:bg-gy50">
                        <i className="ti ti-edit text-[13px]" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
