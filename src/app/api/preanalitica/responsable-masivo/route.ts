import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Aplica un responsable a TODOS los registros que siguen en la bandeja de una
// etapa (Control 1 o Control 2), de una sola vez. Pensado para que preanalítica
// no tenga que cargar quién controló registro por registro: setean los nombres
// una vez y se estampan en todo lo pendiente de esa etapa. Si después cambian
// los nombres y vuelven a aplicar, se re-estampa lo que sigue pendiente (lo ya
// controlado, que salió de la bandeja, queda con su responsable original).
const ROLES_PERMITIDOS = ["preanalitica", "super_admin"];

async function requireRol() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado", status: 401 as const };
  const { data: profile } = await supabase.from("profiles").select("rol").eq("id", user.id).single();
  if (!profile || !ROLES_PERMITIDOS.includes(profile.rol)) {
    return { error: "No tenés permiso para controlar preanalítica", status: 403 as const };
  }
  return { user };
}

export async function POST(req: Request) {
  const guard = await requireRol();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  let body: { stage?: "c1" | "c2"; responsable?: string | null };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }

  const stage = body.stage;
  const responsable = (body.responsable ?? "")?.toString().trim() || null;
  if (stage !== "c1" && stage !== "c2") return NextResponse.json({ error: "Etapa inválida" }, { status: 400 });

  const admin = createAdminClient();

  // Controles que siguen en la bandeja de esa etapa: pendientes, de retiros no
  // anulados ni duplicados. Etapa C1 = todavía sin Control 1 OK; C2 = Control 1
  // ya OK, esperando el segundo.
  let sel = admin
    .from("control_preanalitica")
    .select("id, retiro:retiro_id!inner(anulado, estado)")
    .eq("estado", "pendiente")
    .eq("retiro.anulado", false)
    .neq("retiro.estado", "duplicado_sospechoso");
  sel = stage === "c1" ? sel.is("control_1", null) : sel.eq("control_1", "ok");

  const { data: filas, error: selErr } = await sel;
  if (selErr) return NextResponse.json({ error: selErr.message }, { status: 400 });

  const ids = (filas ?? []).map((f) => f.id);
  if (!ids.length) return NextResponse.json({ ok: true, actualizados: 0 });

  const col = stage === "c1" ? "responsable_1" : "responsable_2";
  const { error: updErr } = await admin
    .from("control_preanalitica")
    .update({ [col]: responsable })
    .in("id", ids);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });

  await admin.from("auditoria").insert({
    entidad: "preanalitica",
    entidad_id: null,
    accion: "Responsable masivo",
    campo_modificado: col,
    valor_anterior: `${ids.length} registros en bandeja (${stage.toUpperCase()})`,
    valor_nuevo: responsable ?? "(vacío)",
    usuario_id: guard.user.id,
  });

  return NextResponse.json({ ok: true, actualizados: ids.length });
}
