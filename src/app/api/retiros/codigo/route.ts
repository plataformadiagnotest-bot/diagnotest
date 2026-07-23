import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidarPreanalitica } from "@/lib/preanalitica/revalidar";

// Roles que pueden corregir el código de veterinaria de un retiro.
const ROLES_PERMITIDOS = ["preanalitica", "cobranzas", "super_admin"];

async function requireRol() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado", status: 401 as const };
  const { data: profile } = await supabase.from("profiles").select("rol").eq("id", user.id).single();
  if (!profile || !ROLES_PERMITIDOS.includes(profile.rol)) {
    return { error: "No tenés permiso para editar el código", status: 403 as const };
  }
  return { user };
}

// ── POST: corregir el código de un retiro y re-vincular la veterinaria ──
export async function POST(req: Request) {
  const guard = await requireRol();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  let body: { retiroId?: string; codigo?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }

  const retiroId = body.retiroId;
  const codigo = (body.codigo ?? "").trim();
  if (!retiroId) return NextResponse.json({ error: "Falta el retiro" }, { status: 400 });

  const admin = createAdminClient();

  // Buscar coincidencia exacta de código (case-insensitive) en el maestro.
  let veterinaria: { id: string; nombre: string; codigo: string } | null = null;
  if (codigo) {
    const { data: vet } = await admin
      .from("veterinarias")
      .select("id, nombre, codigo")
      .ilike("codigo", codigo)
      .maybeSingle();
    veterinaria = vet ?? null;
  }

  // Actualizar el retiro: siempre el código; si hubo coincidencia, también
  // el vínculo y el nombre oficial de la veterinaria.
  const update: Record<string, unknown> = { codigo_original: codigo || null };
  if (veterinaria) {
    update.veterinaria_id = veterinaria.id;
    update.veterinaria_texto_original = veterinaria.nombre;
  }

  const { error } = await admin.from("retiros").update(update).eq("id", retiroId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  revalidarPreanalitica();
  return NextResponse.json({
    ok: true,
    matched: !!veterinaria,
    veterinaria: veterinaria ? { nombre: veterinaria.nombre, codigo: veterinaria.codigo } : null,
  });
}
