import { createClient } from "@/lib/supabase/server";
import { todayISO } from "@/lib/utils/dates";
import { MuestrasBolsasTabla, type FilaMuestras } from "@/components/caja/MuestrasBolsasTabla";

// Sumatoria de muestras por cadete en el día (automática) + carga manual de las
// bolsas recibidas (V1/V2) que preanalítica controla al recibir al cadete.
export async function MuestrasPorCadete({ fecha }: { fecha?: string }) {
  const supabase = await createClient();
  const dia = fecha || todayISO();

  const [{ data: retiros }, { data: bolsas }] = await Promise.all([
    supabase
      .from("retiros")
      .select("personal_id, cantidad_muestras, personal:personal_id(nombre)")
      .eq("fecha_operativa", dia)
      .eq("anulado", false)
      .neq("estado", "duplicado_sospechoso" as never),
    supabase
      .from("bolsas_recibidas")
      .select("personal_id, bolsas_v1, bolsas_v2")
      .eq("fecha", dia),
  ]);

  const bolsasPorCadete = new Map<string, { v1: number | null; v2: number | null }>();
  for (const b of bolsas ?? []) bolsasPorCadete.set(b.personal_id, { v1: b.bolsas_v1, v2: b.bolsas_v2 });

  const map = new Map<string, { personalId: string; nombre: string; total: number }>();
  for (const r of retiros ?? []) {
    const nombre = (r.personal as { nombre?: string } | null)?.nombre ?? "Sin nombre";
    const prev = map.get(r.personal_id) ?? { personalId: r.personal_id, nombre, total: 0 };
    prev.total += Number(r.cantidad_muestras ?? 0);
    map.set(r.personal_id, prev);
  }

  const filas: FilaMuestras[] = Array.from(map.values())
    .filter((f) => f.total > 0)
    .sort((a, b) => b.total - a.total)
    .map((f) => ({
      personalId: f.personalId,
      nombre: f.nombre,
      total: f.total,
      v1: bolsasPorCadete.get(f.personalId)?.v1 ?? null,
      v2: bolsasPorCadete.get(f.personalId)?.v2 ?? null,
    }));
  const granTotal = filas.reduce((s, f) => s + f.total, 0);

  return <MuestrasBolsasTabla filas={filas} granTotal={granTotal} dia={dia} />;
}
