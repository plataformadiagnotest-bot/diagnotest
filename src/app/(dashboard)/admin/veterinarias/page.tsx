import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/layout/Topbar";
import { PillStatus } from "@/components/ui/PillStatus";
import { VeterinariasSync } from "@/components/admin/VeterinariasSync";

export default async function VeterinariasPage() {
  const supabase = await createClient();

  const { data: vets } = await supabase
    .from("veterinarias")
    .select("*, zona:zona_id(nombre)")
    .order("nombre");

  return (
    <div>
      <Topbar
        title="Maestro de Veterinarias"
        actions={<VeterinariasSync />}
      />
      <div className="p-6">
        <div className="bg-white rounded-[14px] border border-gy200 shadow-sm overflow-hidden">
          <div className="px-4 py-3.5 border-b border-gy100 flex items-center gap-2">
            <span className="text-[14px] font-semibold flex-1">Veterinarias registradas</span>
            <PillStatus variant="ok" label={`${vets?.length ?? 0} registradas`} />
          </div>
          <div className="table-scroll">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="bg-gy50">
                  {["Código", "Nombre", "Email", "Teléfono", "Dirección", "Localidad", "Zona", "Estado", ""].map((h) => (
                    <th key={h} className="px-3.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-gy400 border-b border-gy200">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(vets ?? []).map((v) => (
                  <tr key={v.id} className="hover:bg-gy50 border-b border-gy100 last:border-0">
                    <td className="px-3.5 py-2.5 font-mono text-g700">{v.codigo}</td>
                    <td className="px-3.5 py-2.5 font-medium text-gy900">{v.nombre}</td>
                    <td className="px-3.5 py-2.5 text-gy600">{v.email ?? "—"}</td>
                    <td className="px-3.5 py-2.5 text-gy600">{v.telefono ?? "—"}</td>
                    <td className="px-3.5 py-2.5 text-gy600">{v.direccion ?? "—"}</td>
                    <td className="px-3.5 py-2.5 text-gy600">{v.localidad ?? "—"}</td>
                    <td className="px-3.5 py-2.5">{(v.zona as { nombre?: string } | null)?.nombre ?? "—"}</td>
                    <td className="px-3.5 py-2.5"><PillStatus variant={v.activa ? "ok" : "grey"} label={v.activa ? "Activa" : "Inactiva"} /></td>
                    <td className="px-3.5 py-2.5">
                      <button className="px-2 py-1 text-[11px] bg-white border border-gy200 rounded-[6px] hover:bg-gy50 flex items-center gap-1">
                        <i className="ti ti-edit text-[13px]" />
                      </button>
                    </td>
                  </tr>
                ))}
                {!vets?.length && (
                  <tr><td colSpan={9} className="py-10 text-center text-gy400">Sin veterinarias — importá desde Google Sheets</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
