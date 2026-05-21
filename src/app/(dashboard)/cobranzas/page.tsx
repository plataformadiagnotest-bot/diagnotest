import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/layout/Topbar";
import { StatCard } from "@/components/ui/StatCard";
import { ControlCard } from "@/components/ui/ControlCard";
import { fmtMoneySign } from "@/lib/utils/format";

export default async function CobranzasPage() {
  const supabase = await createClient();

  const { data: controles } = await supabase
    .from("control_cobranzas")
    .select(`
      *,
      retiro:retiro_id(
        id, importe_declarado, urgente, fecha_operativa, timestamp_carga,
        veterinaria_texto_original, codigo_original,
        personal:personal_id(nombre)
      )
    `)
    .eq("estado", "pendiente")
    .order("created_at", { ascending: true });

  const totalPendiente = controles?.reduce((s, c) => s + ((c.retiro as any)?.importe_declarado ?? 0), 0) ?? 0;

  return (
    <div>
      <Topbar title="Cobranzas — Pendientes" />
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-4 gap-3.5">
          <StatCard label="Pendientes" value={controles?.length ?? 0} accent="warn" />
          <StatCard label="Total pendiente" value={fmtMoneySign(totalPendiente)} />
          <StatCard label="Diferencias" value={2} accent="danger" />
          <StatCard label="Validado hoy" value="$48.300" />
        </div>

        <div className="flex gap-1.5">
          {["Todos", "Urgentes primero", "Por personal", "Con diferencia"].map((f, i) => (
            <button key={f} className={`px-3 py-1.5 rounded-full border text-[11px] transition-all ${i === 0 ? "bg-g800 text-white border-g800" : "bg-white text-gy600 border-gy200 hover:border-g400 hover:text-g700"}`}>{f}</button>
          ))}
        </div>

        <div className="space-y-3.5">
          {(controles ?? []).map((c) => (
            <ControlCard key={c.id} control={c} tipo="cob" />
          ))}
          {!controles?.length && (
            <div className="py-12 text-center text-gy400">Sin retiros pendientes de validación</div>
          )}
        </div>
      </div>
    </div>
  );
}
