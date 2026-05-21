import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/layout/Topbar";
import { formatDateTime } from "@/lib/utils/dates";

export default async function AuditoriaPage() {
  const supabase = await createClient();

  const { data: registros } = await supabase
    .from("auditoria")
    .select("*, usuario:usuario_id(nombre)")
    .order("fecha_hora", { ascending: false })
    .limit(100);

  return (
    <div>
      <Topbar title="Auditoría Completa"
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
                  {["Fecha/hora", "Entidad", "ID", "Acción", "Campo", "Valor ant.", "Valor nuevo", "Usuario"].map((h) => (
                    <th key={h} className="px-3.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-gy400 border-b border-gy200 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(registros ?? []).map((r) => (
                  <tr key={r.id} className="hover:bg-gy50 border-b border-gy100 last:border-0">
                    <td className="px-3.5 py-2.5 text-gy600 whitespace-nowrap">{formatDateTime(r.fecha_hora)}</td>
                    <td className="px-3.5 py-2.5 font-medium">{r.entidad}</td>
                    <td className="px-3.5 py-2.5 font-mono text-[11px] text-gy400">{r.entidad_id.slice(0, 8)}</td>
                    <td className="px-3.5 py-2.5">{r.accion}</td>
                    <td className="px-3.5 py-2.5 text-gy600">{r.campo_modificado ?? "—"}</td>
                    <td className="px-3.5 py-2.5 text-gy400 max-w-[100px] truncate">{r.valor_anterior ?? "—"}</td>
                    <td className="px-3.5 py-2.5 max-w-[100px] truncate">{r.valor_nuevo ?? "—"}</td>
                    <td className="px-3.5 py-2.5 text-gy600">{(r.usuario as any)?.nombre ?? "—"}</td>
                  </tr>
                ))}
                {!registros?.length && (
                  <tr><td colSpan={8} className="py-10 text-center text-gy400">Sin registros de auditoría</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
