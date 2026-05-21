import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/layout/Topbar";
import { PillStatus, RoleBadge } from "@/components/ui/PillStatus";

export default async function ConfigPage() {
  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, nombre, email, rol, activo")
    .order("nombre");

  const { data: auditoria } = await supabase
    .from("auditoria")
    .select("*, usuario:usuario_id(nombre)")
    .order("fecha_hora", { ascending: false })
    .limit(10);

  return (
    <div>
      <Topbar title="Configuración" />
      <div className="p-6">
        <div className="grid grid-cols-[1fr_360px] gap-4 items-start">
          <div className="bg-white rounded-[14px] border border-gy200 shadow-sm overflow-hidden">
            <div className="px-4 py-3.5 border-b border-gy100 flex items-center gap-2">
              <i className="ti ti-users text-g600" />
              <span className="text-[14px] font-semibold flex-1">Usuarios y roles</span>
              <button className="flex items-center gap-1.5 px-3 py-1.5 bg-g800 text-white text-[12px] font-medium rounded-[6px] hover:bg-g700">
                <i className="ti ti-plus" /> Nuevo
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[12px]">
                <thead>
                  <tr className="bg-gy50">
                    {["Nombre", "Email", "Rol", "Estado", ""].map((h) => (
                      <th key={h} className="px-3.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-gy400 border-b border-gy200">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(profiles ?? []).map((p) => (
                    <tr key={p.id} className="hover:bg-gy50 border-b border-gy100 last:border-0">
                      <td className="px-3.5 py-2.5 font-medium text-gy900">{p.nombre}</td>
                      <td className="px-3.5 py-2.5 text-gy600 text-[11px]">{p.email}</td>
                      <td className="px-3.5 py-2.5"><RoleBadge rol={p.rol} /></td>
                      <td className="px-3.5 py-2.5"><PillStatus variant={p.activo ? "ok" : "grey"} label={p.activo ? "Activo" : "Inactivo"} /></td>
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

          <div className="space-y-3.5">
            <div className="bg-white rounded-[14px] border border-gy200 shadow-sm overflow-hidden">
              <div className="px-4 py-3.5 border-b border-gy100 flex items-center gap-2">
                <i className="ti ti-shield-check text-g600" />
                <span className="text-[14px] font-semibold">Reglas de integridad</span>
              </div>
              <div className="divide-y divide-gy100">
                {[
                  "Cantidad numérica obligatoria",
                  "Importe cero → alerta automática",
                  "Duplicados: ventana 30 min",
                  "Veterinaria no normalizada → pendiente",
                  "No borrado físico — solo Anulado",
                  "Toda modificación auditada con usuario + timestamp",
                  "Pedidos sin resolver > 2h → reasignación automática",
                  "Gastos sin comprobante → observados automáticamente",
                ].map((r) => (
                  <div key={r} className="flex items-center gap-2 px-4 py-2 text-[11px]">
                    <i className="ti ti-check text-g500 text-[15px] shrink-0" />
                    {r}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-[14px] border border-gy200 shadow-sm overflow-hidden">
              <div className="px-4 py-3.5 border-b border-gy100 flex items-center gap-2">
                <i className="ti ti-history text-g600" />
                <span className="text-[14px] font-semibold">Auditoría reciente</span>
              </div>
              <div className="divide-y divide-gy100">
                {(auditoria ?? []).map((a) => (
                  <div key={a.id} className="px-4 py-2 text-[11px]">
                    <span className="font-mono text-g700">{a.entidad_id.slice(0, 8)}</span>
                    <span className="text-gy400 mx-1.5">{a.entidad}</span>
                    <span className="font-medium">{a.accion}</span>
                    <span className="float-right text-gy400">{(a.usuario as any)?.nombre} · {new Date(a.fecha_hora).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                ))}
                {!auditoria?.length && (
                  <div className="px-4 py-4 text-center text-gy400 text-[11px]">Sin registros de auditoría</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
