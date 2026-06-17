import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Roles que pueden resolver duplicados sospechosos. Como ambos perfiles
// (logística y preanalítica) actúan sobre la misma fila de retiros, el que
// resuelve primero impacta para todos.
const ROLES_PERMITIDOS = ["jefe_logistica", "preanalitica", "super_admin"];

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("rol").eq("id", user.id).single();
  if (!ROLES_PERMITIDOS.includes(profile?.rol ?? "")) {
    return NextResponse.json({ error: "Sin permisos para resolver duplicados" }, { status: 403 });
  }

  let body: { id?: string; accion?: "confirmar" | "anular" };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }

  const { id, accion } = body;
  if (!id || (accion !== "confirmar" && accion !== "anular")) {
    return NextResponse.json({ error: "Parámetros inválidos" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Solo se puede resolver un retiro que siga marcado como sospechoso:
  // si otro perfil ya lo resolvió, esta llamada no afecta nada.
  const { data: retiro } = await admin
    .from("retiros")
    .select("id, estado, comprobante_url")
    .eq("id", id)
    .single();

  if (!retiro) return NextResponse.json({ error: "Retiro no encontrado" }, { status: 404 });
  if (retiro.estado !== "duplicado_sospechoso") {
    return NextResponse.json({ ok: true, yaResuelto: true });
  }

  // confirmar = es válido (no es duplicado) → vuelve a 'registrado'.
  if (accion === "confirmar") {
    const { error } = await admin.from("retiros").update({ estado: "registrado" }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  // anular = es un duplicado real → se elimina definitivamente (cascada a sus
  // controles) para que desaparezca por completo, no solo marcarlo anulado.
  if (retiro.comprobante_url) {
    const marker = "/comprobantes/";
    const idx = (retiro.comprobante_url as string).indexOf(marker);
    if (idx !== -1) {
      const path = (retiro.comprobante_url as string).slice(idx + marker.length);
      await admin.storage.from("comprobantes").remove([path]).catch(() => {});
    }
  }

  const { error } = await admin.from("retiros").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
