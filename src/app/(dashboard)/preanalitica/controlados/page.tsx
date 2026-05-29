import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Topbar } from "@/components/layout/Topbar";
import { EtiquetasChips } from "@/components/preanalitica/EtiquetasChips";
import { ControlValor } from "@/components/preanalitica/ControlValor";
import { formatDateTime } from "@/lib/utils/dates";

export default async function PreanaliticaControladosPage() {
  const supabase = await createClient();

  const today = new Date().toISOString().split("T")[0];
  const { data: controles } = await supabase
    .from("control_preanalitica")
    .select("*, retiro:retiro_id(id, cantidad_muestras, fecha_operativa, veterinaria_texto_original, codigo_original, personal:personal_id(nombre))")
    .eq("estado", "ok")
    .gte("updated_at", today + "T00:00:00Z")
    .order("updated_at", { ascending: false });

  // Resolver nombres de los responsables (RLS de profiles no deja leer otros perfiles).
  const respIds = Array.from(new Set((controles ?? []).map((c) => c.responsable_id).filter(Boolean)));
  const nombrePorId = new Map<string, string>();
  if (respIds.length) {
    const { data: profs } = await createAdminClient().from("profiles").select("id, nombre").in("id", respIds);
    for (const p of profs ?? []) nombrePorId.set(p.id, p.nombre);
  }

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
                  {["Código", "Personal", "Veterinaria", "Muestras", "Control 1", "Control 2", "Etiquetas", "Responsable", "Hora"].map((h) => (
                    <th key={h} className="px-3.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-gy400 border-b border-gy200">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(controles ?? []).map((c) => {
                  const r = c.retiro as any;
                  return (
                    <tr key={c.id} className="hover:bg-gy50 border-b border-gy100 last:border-0">
                      <td className="px-3.5 py-2.5 font-mono text-[11px] text-g700">{r?.codigo_original ?? "—"}</td>
                      <td className="px-3.5 py-2.5 font-medium">{r?.personal?.nombre ?? "—"}</td>
                      <td className="px-3.5 py-2.5">{r?.veterinaria_texto_original}</td>
                      <td className="px-3.5 py-2.5 text-center font-semibold">{r?.cantidad_muestras}</td>
                      <td className="px-3.5 py-2.5"><ControlValor valor={c.control_1} /></td>
                      <td className="px-3.5 py-2.5"><ControlValor valor={c.control_2} /></td>
                      <td className="px-3.5 py-2.5"><EtiquetasChips etiquetas={c.etiquetas} /></td>
                      <td className="px-3.5 py-2.5 text-gy600">{c.responsable_id ? (nombrePorId.get(c.responsable_id) ?? "—") : "—"}</td>
                      <td className="px-3.5 py-2.5 text-gy600">{formatDateTime(c.updated_at)}</td>
                    </tr>
                  );
                })}
                {!controles?.length && (
                  <tr><td colSpan={9} className="py-10 text-center text-gy400">Sin registros controlados hoy</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
