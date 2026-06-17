import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Eliminación manual (definitiva) de un retiro. Solo dirección / super admin.
// Borra el retiro y, por cascada, sus controles de preanalítica y cobranzas.
const ROLES_PERMITIDOS = ["dueno", "super_admin"];

async function requireRol() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado", status: 401 as const };
  const { data: profile } = await supabase.from("profiles").select("rol").eq("id", user.id).single();
  if (!profile || !ROLES_PERMITIDOS.includes(profile.rol)) {
    return { error: "No tenés permiso para eliminar registros", status: 403 as const };
  }
  return { user };
}

export async function POST(req: Request) {
  const guard = await requireRol();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  let body: { id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }
  const id = body.id;
  if (!id) return NextResponse.json({ error: "Falta el retiro" }, { status: 400 });

  const admin = createAdminClient();

  const { data: retiro, error: getErr } = await admin
    .from("retiros")
    .select("id, veterinaria_texto_original, codigo_original, importe_declarado, comprobante_url")
    .eq("id", id)
    .single();
  if (getErr || !retiro) return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });

  // Borrar el comprobante del storage si existía (evita huérfanos).
  if (retiro.comprobante_url) {
    const marker = "/comprobantes/";
    const idx = (retiro.comprobante_url as string).indexOf(marker);
    if (idx !== -1) {
      const path = (retiro.comprobante_url as string).slice(idx + marker.length);
      await admin.storage.from("comprobantes").remove([path]).catch(() => {});
    }
  }

  const { error: delErr } = await admin.from("retiros").delete().eq("id", id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });

  // Auditoría de la eliminación.
  await admin.from("auditoria").insert({
    entidad: "retiro",
    entidad_id: id,
    accion: "Eliminación",
    campo_modificado: "registro",
    valor_anterior: `${retiro.veterinaria_texto_original ?? ""} ${retiro.codigo_original ?? ""} · $${retiro.importe_declarado ?? 0}`.trim(),
    valor_nuevo: "Eliminado definitivamente",
    usuario_id: guard.user.id,
  });

  return NextResponse.json({ ok: true });
}
