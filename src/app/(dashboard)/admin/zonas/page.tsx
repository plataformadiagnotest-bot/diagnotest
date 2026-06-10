import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/layout/Topbar";
import { PillStatus } from "@/components/ui/PillStatus";
import { ZonasSync } from "@/components/admin/ZonasSync";

export default async function ZonasPage() {
  const supabase = await createClient();
  const { data: zonas } = await supabase.from("zonas").select("*").order("nombre");

  return (
    <div>
      <Topbar title="Maestro de Zonas" actions={<ZonasSync />} />
      <div className="p-6">
        <div className="bg-white rounded-[14px] border border-gy200 shadow-sm overflow-hidden">
          <div className="px-4 py-3.5 border-b border-gy100 flex items-center gap-2">
            <span className="text-[14px] font-semibold flex-1">Zonas registradas</span>
            <PillStatus variant="ok" label={`${zonas?.length ?? 0} zonas`} />
          </div>
          <div className="table-scroll">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="bg-gy50">
                  {["Nombre", "Localidades", "Estado"].map((h) => (
                    <th key={h} className="px-3.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-gy400 border-b border-gy200">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(zonas ?? []).map((z) => {
                  const locs: string[] = z.localidades ?? [];
                  return (
                    <tr key={z.id} className="hover:bg-gy50 border-b border-gy100 last:border-0 align-top">
                      <td className="px-3.5 py-2.5 font-medium text-gy900 whitespace-nowrap">{z.nombre}</td>
                      <td className="px-3.5 py-2.5">
                        {locs.length === 0 ? (
                          <span className="text-gy400">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            <span className="text-[10px] font-semibold text-gy500 mr-1 mt-0.5">{locs.length} ·</span>
                            {locs.map((l) => (
                              <span key={l} className="inline-block px-2 py-0.5 rounded-full text-[10px] bg-gy100 text-gy600">{l}</span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5"><PillStatus variant={z.activa ? "ok" : "grey"} label={z.activa ? "Activa" : "Inactiva"} /></td>
                    </tr>
                  );
                })}
                {!zonas?.length && (
                  <tr><td colSpan={3} className="py-10 text-center text-gy400">Sin zonas — importá desde Google Sheets</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
