import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/layout/Topbar";
import { PillStatus } from "@/components/ui/PillStatus";
import { VeterinariasSync } from "@/components/admin/VeterinariasSync";
import { VeterinariasTable, type VetRow } from "@/components/admin/VeterinariasTable";

export const dynamic = "force-dynamic";

const MOTIVO_LABEL: Record<string, string> = {
  sin_zona: "Sin zona cargada",
  sin_cadete: "La zona no tiene cadete asignado",
  varios_cadetes: "La zona tiene 2+ cadetes (ambiguo)",
};

export default async function VeterinariasPage() {
  const supabase = await createClient();

  const { count } = await supabase.from("veterinarias").select("*", { count: "exact", head: true });

  // Traer todas las filas paginando de a 1000.
  const PAGE = 1000;
  const vets: VetRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("veterinarias")
      .select("id, codigo, nombre, email, telefono, direccion, localidad, activa, es_fija, zona:zona_id(nombre)")
      .order("nombre")
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    vets.push(...(data as unknown as VetRow[]));
    if (data.length < PAGE) break;
  }

  // Veterinarias fijas que hoy NO pueden generar pedido (sin zona / sin cadete /
  // zona con 2+ cadetes). Es la alerta para que Martín deje la zona resuelta.
  const { data: pendientes } = await supabase
    .from("veterinarias_fijas_estado")
    .select("id, codigo, nombre, zona_nombre, cadetes_en_zona, motivo")
    .neq("motivo", "ok")
    .order("nombre");

  return (
    <div>
      <Topbar title="Maestro de Veterinarias" actions={<VeterinariasSync />} />
      <div className="p-6 space-y-4">
        {(pendientes?.length ?? 0) > 0 && (
          <div className="bg-amber-bg border border-amber/40 rounded-[12px] p-4">
            <div className="flex items-center gap-2 mb-2">
              <i className="ti ti-alert-triangle text-amber-text text-[16px]" />
              <span className="text-[13px] font-semibold text-amber-text">
                {pendientes!.length} veterinaria{pendientes!.length !== 1 ? "s" : ""} fija{pendientes!.length !== 1 ? "s" : ""} sin resolver — hoy no generan pedido
              </span>
            </div>
            <div className="text-[11px] text-amber-text/80 mb-2">
              El pedido automático solo se crea si la zona de la vete tiene exactamente 1 cadete activo. Resolvé la zona (en Admin → Usuarios) o la zona de la veterinaria.
            </div>
            <div className="flex flex-wrap gap-1.5">
              {pendientes!.map((p) => (
                <span key={p.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[8px] bg-white border border-amber/40 text-[11px]">
                  <span className="font-mono text-g700">{p.codigo}</span>
                  <span className="text-gy700">{p.nombre}</span>
                  <span className="text-gy400">·</span>
                  <span className="text-amber-text">{MOTIVO_LABEL[p.motivo as string] ?? p.motivo}{p.zona_nombre ? ` (${p.zona_nombre})` : ""}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-[14px] font-semibold flex-1">Veterinarias registradas</span>
          <PillStatus variant="ok" label={`${count ?? vets.length} registradas`} />
        </div>

        <VeterinariasTable vets={vets} />
      </div>
    </div>
  );
}
