import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/layout/Topbar";
import { PreanaliticaBandeja } from "@/components/preanalitica/PreanaliticaBandeja";

export default async function PreanaliticaPage() {
  const supabase = await createClient();

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
    .eq("estado", "pendiente")
    .order("created_at", { ascending: true });

  return (
    <div>
      <Topbar title="Bandeja Preanalítica" />
      <div className="p-6">
        <PreanaliticaBandeja controles={controles ?? []} />
      </div>
    </div>
  );
}
