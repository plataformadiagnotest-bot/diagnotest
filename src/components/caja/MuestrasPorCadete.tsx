import { createClient } from "@/lib/supabase/server";

// Sumatoria de muestras por cadete en el día — para preanalítica, así sabe
// cuántas muestras debería recibir de cada cadete.
export async function MuestrasPorCadete({ fecha }: { fecha?: string }) {
  const supabase = await createClient();
  const dia = fecha || new Date().toISOString().split("T")[0];

  const { data: retiros } = await supabase
    .from("retiros")
    .select("personal_id, cantidad_muestras, personal:personal_id(nombre)")
    .eq("fecha_operativa", dia)
    .eq("anulado", false);

  const map = new Map<string, { nombre: string; total: number }>();
  for (const r of retiros ?? []) {
    const nombre = (r.personal as { nombre?: string } | null)?.nombre ?? "Sin nombre";
    const prev = map.get(r.personal_id) ?? { nombre, total: 0 };
    prev.total += Number(r.cantidad_muestras ?? 0);
    map.set(r.personal_id, prev);
  }
  const filas = Array.from(map.values())
    .filter((f) => f.total > 0)
    .sort((a, b) => b.total - a.total);
  const granTotal = filas.reduce((s, f) => s + f.total, 0);

  return (
    <div className="bg-white rounded-[14px] border border-gy200 shadow-sm overflow-hidden">
      <div className="px-4 py-3.5 border-b border-gy100 flex items-center gap-2">
        <i className="ti ti-test-pipe text-g600" />
        <span className="text-[14px] font-semibold flex-1">Muestras por cadete — hoy</span>
        <span className="text-[11px] text-gy400">Total general:</span>
        <span className="text-[14px] font-bold text-g700">{granTotal}</span>
      </div>
      <div className="divide-y divide-gy100">
        {filas.length === 0 ? (
          <div className="px-4 py-8 text-center text-[12px] text-gy400">Sin muestras registradas hoy</div>
        ) : (
          filas.map((f) => (
            <div key={f.nombre} className="flex items-center px-4 py-2.5">
              <span className="text-[13px] font-medium text-gy800 flex-1">{f.nombre}</span>
              <span className="text-[14px] font-bold text-g700">{f.total}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
