import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/layout/Topbar";
import { ControlCard } from "@/components/ui/ControlCard";

export default async function PreanaliticaObservadosPage() {
  const supabase = await createClient();

  // Mismos campos que la bandeja para que la tarjeta sea totalmente editable:
  // se puede ajustar controles, etiquetas, detalle, fotos y muestras, y luego
  // marcar "Controlado OK" (o volver a observar).
  const { data: controles } = await supabase
    .from("control_preanalitica")
    .select(`
      *,
      retiro:retiro_id(
        id, cantidad_muestras, comentarios, urgente, fecha_operativa, timestamp_carga,
        veterinaria_texto_original, codigo_original, comprobante_url,
        personal:personal_id(nombre)
      )
    `)
    .in("estado", ["observado", "rechazado"])
    .order("updated_at", { ascending: false });

  return (
    <div>
      <Topbar title="Preanalítica — Observados" />
      <div className="p-6 space-y-4">
        <div className="flex items-start gap-3 bg-amber-bg border border-amber/40 rounded-[10px] px-4 py-3 text-[12px] text-amber-text">
          <i className="ti ti-info-circle text-[16px] mt-0.5 shrink-0" />
          <div>
            Ajustá lo que haga falta (controles, etiquetas, detalle, fotos o muestras) y luego marcá <strong>Controlado OK</strong>. Al resolverlo sale de esta lista.
          </div>
        </div>

        {!controles?.length ? (
          <div className="bg-white rounded-[14px] border border-gy200 shadow-sm py-12 text-center text-gy400 text-[13px]">
            Sin registros observados
          </div>
        ) : (
          <div className="space-y-3.5">
            {controles.map((c) => (
              <ControlCard key={c.id} control={c} tipo="pre" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
