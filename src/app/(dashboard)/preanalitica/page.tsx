import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/layout/Topbar";
import { StatCard } from "@/components/ui/StatCard";
import { PillStatus } from "@/components/ui/PillStatus";
import { ControlCard } from "@/components/ui/ControlCard";

export default async function PreanaliticaPage() {
  const supabase = await createClient();

  const { data: controles } = await supabase
    .from("control_preanalitica")
    .select(`
      *,
      retiro:retiro_id(
        id, cantidad_muestras, comentarios, urgente, fecha_operativa, timestamp_carga,
        veterinaria_texto_original, codigo_original,
        personal:personal_id(nombre)
      )
    `)
    .eq("estado", "pendiente")
    .order("created_at", { ascending: true });

  const urgentes = controles?.filter((c) => c.urgente || (c.retiro as any)?.urgente) ?? [];

  return (
    <div>
      <Topbar title="Bandeja Preanalítica" />
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-4 gap-3.5">
          <StatCard label="Pendientes" value={controles?.length ?? 0} accent="warn" />
          <StatCard label="Urgentes" value={urgentes.length} accent="danger" />
          <StatCard label="Controlados hoy" value={34} />
          <StatCard label="Observados" value={3} accent="warn" />
        </div>

        <div className="flex gap-1.5">
          {["Todos", "Urgentes primero", "Por personal", "Por veterinaria"].map((f, i) => (
            <button key={f} className={`px-3 py-1.5 rounded-full border text-[11px] transition-all ${i === 0 ? "bg-g800 text-white border-g800" : "bg-white text-gy600 border-gy200 hover:border-g400 hover:text-g700"}`}>{f}</button>
          ))}
        </div>

        <div className="space-y-3.5">
          {(controles ?? []).map((c) => (
            <ControlCard key={c.id} control={c} tipo="pre" />
          ))}
          {!controles?.length && (
            <div className="py-12 text-center text-gy400">Sin retiros pendientes de control</div>
          )}
        </div>
      </div>
    </div>
  );
}
