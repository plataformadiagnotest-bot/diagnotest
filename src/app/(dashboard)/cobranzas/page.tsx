import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/layout/Topbar";
import { StatCard } from "@/components/ui/StatCard";
import { CobranzasBandeja } from "@/components/cobranzas/CobranzasBandeja";
import { fmtMoneySign } from "@/lib/utils/format";

export default async function CobranzasPage() {
  const supabase = await createClient();

  // !inner + filtros sobre el retiro: no se muestran (ni suman) los duplicados
  // sospechosos ni los anulados; cobranzas solo trabaja retiros válidos.
  const { data: controles } = await supabase
    .from("control_cobranzas")
    .select(`
      *,
      retiro:retiro_id!inner(
        id, importe_declarado, urgente, fecha_operativa, timestamp_carga, comentarios,
        veterinaria_texto_original, codigo_original, comprobante_url, metodo_pago,
        personal:personal_id(nombre),
        control_preanalitica:control_preanalitica(estado, etiquetas, detalle, cancelado, cancelado_motivo, comentario)
      )
    `)
    .eq("estado", "pendiente")
    .eq("retiro.anulado", false)
    .neq("retiro.estado", "duplicado_sospechoso")
    .order("created_at", { ascending: true });

  const totalPendiente = controles?.reduce((s, c) => s + ((c.retiro as any)?.importe_declarado ?? 0), 0) ?? 0;

  return (
    <div>
      <Topbar title="Cobranzas — Pendientes" />
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-3.5">
          <StatCard label="Pendientes" value={controles?.length ?? 0} accent="warn" />
          <StatCard label="Total pendiente" value={fmtMoneySign(totalPendiente)} />
        </div>

        <CobranzasBandeja controles={controles ?? []} />
      </div>
    </div>
  );
}
