import { createClient } from "@/lib/supabase/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

// Etiqueta corta "29/6" a partir de un ISO yyyy-mm-dd (sin desfasaje de zona).
function etiquetaDia(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(d)}/${Number(m)}`;
}

// Resumen de pendientes de control por día (hoy + 3 días para atrás), separado
// en Control 1 y Control 2. La etapa se deriva de control_1 (igual que la
// bandeja): si Control 1 ya está OK, el pendiente está esperando Control 2.
export async function ResumenPendientesEtapa() {
  const supabase = await createClient();

  const dias: string[] = [];
  for (let i = 0; i < 4; i++) {
    dias.push(new Date(Date.now() - i * 86400000).toISOString().split("T")[0]);
  }
  const desde = dias[dias.length - 1];

  // Mismos filtros que la bandeja: no cuentan anulados ni duplicados sospechosos.
  const { data } = await supabase
    .from("control_preanalitica")
    .select("control_1, retiro:retiro_id!inner(fecha_operativa, anulado, estado)")
    .eq("estado", "pendiente")
    .eq("retiro.anulado", false)
    .neq("retiro.estado", "duplicado_sospechoso")
    .gte("retiro.fecha_operativa", desde);

  const porDia = new Map<string, { c1: number; c2: number }>();
  for (const d of dias) porDia.set(d, { c1: 0, c2: 0 });
  for (const c of (data ?? []) as AnyRecord[]) {
    const f = c.retiro?.fecha_operativa;
    const fila = porDia.get(f);
    if (!fila) continue;
    if (c.control_1 === "ok") fila.c2 += 1;
    else fila.c1 += 1;
  }

  return (
    <div className="bg-white rounded-[14px] border border-gy200 shadow-sm overflow-hidden">
      <div className="px-4 py-3.5 border-b border-gy100 flex items-center gap-2">
        <i className="ti ti-clipboard-list text-g600" />
        <span className="text-[14px] font-semibold flex-1">Pendientes de control — últimos 4 días</span>
      </div>
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="bg-gy50">
            <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-gy400 border-b border-gy200">Día</th>
            <th className="px-4 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-gy400 border-b border-gy200">Pendientes Control 1</th>
            <th className="px-4 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-gy400 border-b border-gy200">Pendientes Control 2</th>
            <th className="px-4 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-gy400 border-b border-gy200">Total pendientes</th>
          </tr>
        </thead>
        <tbody>
          {dias.map((d, i) => {
            const f = porDia.get(d)!;
            const total = f.c1 + f.c2;
            return (
              <tr key={d} className="border-b border-gy100 last:border-0 hover:bg-gy50">
                <td className="px-4 py-2.5 font-semibold text-gy800">
                  {etiquetaDia(d)}{i === 0 && <span className="ml-1.5 text-[10px] font-normal text-gy400">(hoy)</span>}
                </td>
                <td className="px-4 py-2.5 text-center font-bold text-amber-text">{f.c1}</td>
                <td className="px-4 py-2.5 text-center font-bold text-amber-text">{f.c2}</td>
                <td className="px-4 py-2.5 text-center font-bold text-g700">{total}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
