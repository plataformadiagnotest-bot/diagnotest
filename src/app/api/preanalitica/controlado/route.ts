import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Acciones sobre un registro ya controlado: cancelar / reactivar / comentar.
// Disponible para preanalítica, super_admin y dirección (dueño).
const ROLES_PERMITIDOS = ["preanalitica", "super_admin", "dueno"];

async function requireRol() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado", status: 401 as const };
  const { data: profile } = await supabase.from("profiles").select("rol").eq("id", user.id).single();
  if (!profile || !ROLES_PERMITIDOS.includes(profile.rol)) {
    return { error: "No tenés permiso para esta acción", status: 403 as const };
  }
  return { user };
}

export async function POST(req: Request) {
  const guard = await requireRol();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  let body: { controlId?: string; accion?: string; motivo?: string; comentario?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }

  const controlId = body.controlId;
  const accion = body.accion ?? "";
  if (!controlId) return NextResponse.json({ error: "Falta el control" }, { status: 400 });
  if (!["cancelar", "reactivar", "comentario"].includes(accion)) {
    return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: prev, error: prevErr } = await admin
    .from("control_preanalitica")
    .select("id, retiro_id, cancelado, comentario")
    .eq("id", controlId)
    .single();
  if (prevErr || !prev) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });

  let update: Record<string, unknown>;
  let auditCampo: string;
  let auditAnt: string;
  let auditNuevo: string;

  if (accion === "cancelar") {
    const motivo = (body.motivo ?? "").trim() || null;
    update = {
      cancelado: true,
      cancelado_motivo: motivo,
      cancelado_por: guard.user.id,
      cancelado_at: new Date().toISOString(),
    };
    auditCampo = "cancelado";
    auditAnt = prev.cancelado ? "Cancelado" : "Activo";
    auditNuevo = motivo ? `Cancelado · ${motivo}` : "Cancelado";
  } else if (accion === "reactivar") {
    update = {
      cancelado: false,
      cancelado_motivo: null,
      cancelado_por: null,
      cancelado_at: null,
    };
    auditCampo = "cancelado";
    auditAnt = "Cancelado";
    auditNuevo = "Reactivado";
  } else {
    const comentario = (body.comentario ?? "").trim() || null;
    update = { comentario };
    auditCampo = "comentario";
    auditAnt = prev.comentario ?? "—";
    auditNuevo = comentario ?? "(vacío)";
  }

  const { error: updErr } = await admin
    .from("control_preanalitica")
    .update(update)
    .eq("id", controlId);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });

  await admin.from("auditoria").insert({
    entidad: "preanalitica",
    entidad_id: prev.retiro_id,
    accion: accion === "comentario" ? "Comentario" : accion === "reactivar" ? "Reactivar" : "Cancelar",
    campo_modificado: auditCampo,
    valor_anterior: auditAnt,
    valor_nuevo: auditNuevo,
    usuario_id: guard.user.id,
  });

  return NextResponse.json({ ok: true });
}
