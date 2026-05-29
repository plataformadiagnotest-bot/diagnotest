import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ROLES_PERMITIDOS = ["preanalitica", "super_admin"];
const ESTADOS = ["pendiente", "ok", "observado", "rechazado"];

const ESTADO_LABEL: Record<string, string> = {
  pendiente: "Pendiente",
  ok: "Controlado OK",
  observado: "Observado",
  rechazado: "Rechazado",
};

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

  let body: { controlId?: string; estado?: string; control1?: string; control2?: string; etiquetas?: string[]; detalle?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }

  const controlId = body.controlId;
  const estado = body.estado ?? "";
  const detalle = (body.detalle ?? "").trim() || null;
  const control1 = body.control1 ?? null;
  const control2 = body.control2 ?? null;
  const etiquetas = Array.isArray(body.etiquetas) ? body.etiquetas : [];
  if (!controlId) return NextResponse.json({ error: "Falta el control" }, { status: 400 });
  if (!ESTADOS.includes(estado)) return NextResponse.json({ error: "Estado inválido" }, { status: 400 });

  const admin = createAdminClient();

  const { data: prev, error: prevErr } = await admin
    .from("control_preanalitica")
    .select("id, retiro_id, estado")
    .eq("id", controlId)
    .single();
  if (prevErr || !prev) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });

  const { error: updErr } = await admin
    .from("control_preanalitica")
    .update({
      estado,
      control_1: control1,
      control_2: control2,
      etiquetas,
      detalle,
      responsable_id: guard.user.id,
    })
    .eq("id", controlId);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });

  const partes: string[] = [ESTADO_LABEL[estado] ?? estado];
  if (etiquetas.length) partes.push(`etiquetas: ${etiquetas.join(", ")}`);
  if (detalle) partes.push(`obs: ${detalle}`);

  const { error: audErr } = await admin.from("auditoria").insert({
    entidad: "preanalitica",
    entidad_id: prev.retiro_id,
    accion: "Control",
    campo_modificado: "estado",
    valor_anterior: ESTADO_LABEL[prev.estado] ?? prev.estado,
    valor_nuevo: partes.join(" · "),
    usuario_id: guard.user.id,
  });
  if (audErr) return NextResponse.json({ error: audErr.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
