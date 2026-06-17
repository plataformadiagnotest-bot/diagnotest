import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Persiste el listado de fotos adjuntas de un control de preanalítica.
// La subida al storage la hace el cliente; acá solo guardamos las URLs.
const ROLES_PERMITIDOS = ["preanalitica", "super_admin"];

async function requireRol() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado", status: 401 as const };
  const { data: profile } = await supabase.from("profiles").select("rol").eq("id", user.id).single();
  if (!profile || !ROLES_PERMITIDOS.includes(profile.rol)) {
    return { error: "No tenés permiso para adjuntar fotos", status: 403 as const };
  }
  return { user };
}

export async function POST(req: Request) {
  const guard = await requireRol();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  let body: { controlId?: string; fotos?: string[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }

  const controlId = body.controlId;
  const fotos = Array.isArray(body.fotos) ? body.fotos.filter((f) => typeof f === "string") : [];
  if (!controlId) return NextResponse.json({ error: "Falta el control" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("control_preanalitica")
    .update({ fotos_urls: fotos })
    .eq("id", controlId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, fotos });
}
