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
    .select("id, estado, veterinaria_texto_original, codigo_original")
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

  // anular = es un duplicado real → se ANULA (no se borra): queda anulado=true,
  // así no suma a muestras ni a los totales y sale de las bandejas, pero el
  // registro se conserva para auditoría. Logística/preanalítica no borran datos.
  const { error } = await admin
    .from("retiros")
    .update({ anulado: true, estado: "anulado" })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await admin.from("auditoria").insert({
    entidad: "retiro",
    entidad_id: id,
    accion: "Anulación",
    campo_modificado: "estado",
    valor_anterior: "Duplicado sospechoso",
    valor_nuevo: `Anulado (duplicado) · ${retiro.codigo_original ?? ""} ${retiro.veterinaria_texto_original ?? ""}`.trim(),
    usuario_id: user.id,
  });

  return NextResponse.json({ ok: true });
}
