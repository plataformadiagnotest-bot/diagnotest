import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidarPreanalitica } from "@/lib/preanalitica/revalidar";

// Roles que pueden corregir la cantidad de muestras de un retiro.
const ROLES_PERMITIDOS = ["preanalitica", "super_admin"];

async function requireRol() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado", status: 401 as const };
  const { data: profile } = await supabase.from("profiles").select("rol").eq("id", user.id).single();
  if (!profile || !ROLES_PERMITIDOS.includes(profile.rol)) {
    return { error: "No tenés permiso para editar las muestras", status: 403 as const };
  }
  return { user };
}

// ── POST: corregir la cantidad de muestras de un retiro (con auditoría) ──
export async function POST(req: Request) {
  const guard = await requireRol();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  let body: { retiroId?: string; cantidad?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }

  const retiroId = body.retiroId;
  const cantidad = Number(body.cantidad);
  if (!retiroId) return NextResponse.json({ error: "Falta el retiro" }, { status: 400 });
  if (!Number.isInteger(cantidad) || cantidad < 0) {
    return NextResponse.json({ error: "Cantidad inválida" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: prev, error: prevErr } = await admin
    .from("retiros")
    .select("id, cantidad_muestras")
    .eq("id", retiroId)
    .single();
  if (prevErr || !prev) return NextResponse.json({ error: "Retiro no encontrado" }, { status: 404 });

  if (prev.cantidad_muestras === cantidad) return NextResponse.json({ ok: true, sinCambios: true });

  const { error: updErr } = await admin
    .from("retiros")
    .update({ cantidad_muestras: cantidad })
    .eq("id", retiroId);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });

  const { error: audErr } = await admin.from("auditoria").insert({
    entidad: "retiro",
    entidad_id: retiroId,
    accion: "Corrección de muestras",
    campo_modificado: "cantidad_muestras",
    valor_anterior: String(prev.cantidad_muestras ?? "—"),
    valor_nuevo: String(cantidad),
    usuario_id: guard.user.id,
  });
  if (audErr) return NextResponse.json({ error: audErr.message }, { status: 400 });

  revalidarPreanalitica();
  return NextResponse.json({ ok: true });
}
