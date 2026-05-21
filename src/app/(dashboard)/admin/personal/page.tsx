import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/layout/Topbar";
import { PillStatus } from "@/components/ui/PillStatus";

export default async function PersonalPage() {
  const supabase = await createClient();

  const { data: personal } = await supabase
    .from("personal")
    .select("*, zona:zona_base_id(nombre), profile:profile_id(nombre, email)")
    .order("nombre");

  return (
    <div>
      <Topbar
        title="Maestro de Personal"
        actions={
          <button className="flex items-center gap-1.5 px-3.5 py-2 bg-g800 text-white text-[12px] font-medium rounded-[6px] hover:bg-g700">
            <i className="ti ti-plus" /> Nuevo personal
          </button>
        }
      />
      <div className="p-6">
        <div className="bg-white rounded-[14px] border border-gy200 shadow-sm overflow-hidden">
          <div className="px-4 py-3.5 border-b border-gy100 flex items-center gap-2">
            <span className="text-[14px] font-semibold flex-1">Personal de logística registrado</span>
            <PillStatus variant="ok" label={`${personal?.length ?? 0} activos`} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="bg-gy50">
                  {["ID", "Nombre", "Zona", "Tipo", "Email", "Estado", ""].map((h) => (
                    <th key={h} className="px-3.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-gy400 border-b border-gy200">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(personal ?? []).map((p) => (
                  <tr key={p.id} className="hover:bg-gy50 border-b border-gy100 last:border-0">
                    <td className="px-3.5 py-2.5 font-mono text-[11px] text-gy400">{p.id.slice(0, 8)}</td>
                    <td className="px-3.5 py-2.5 font-medium text-gy900">{p.nombre}</td>
                    <td className="px-3.5 py-2.5">{(p.zona as any)?.nombre ?? "—"}</td>
                    <td className="px-3.5 py-2.5 capitalize">{p.tipo}</td>
                    <td className="px-3.5 py-2.5 text-gy600">{(p.profile as any)?.email ?? "—"}</td>
                    <td className="px-3.5 py-2.5"><PillStatus variant={p.activo ? "ok" : "grey"} label={p.activo ? "Activo" : "Inactivo"} /></td>
                    <td className="px-3.5 py-2.5">
                      <button className="px-2 py-1 text-[11px] bg-white border border-gy200 rounded-[6px] hover:bg-gy50 flex items-center gap-1">
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
