import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ROLES_VALIDOS = [
  "personal_logistica",
  "jefe_logistica",
  "preanalitica",
  "cobranzas",
  "dueno",
  "super_admin",
] as const;

type Rol = (typeof ROLES_VALIDOS)[number];

// Verifica que quien llama tenga sesión y sea super_admin.
async function requireSuperAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado", status: 401 as const };
  const { data: profile } = await supabase
    .from("profiles")
    .select("rol")
    .eq("id", user.id)
    .single();
  if (profile?.rol !== "super_admin") {
    return { error: "Solo el super administrador puede gestionar usuarios", status: 403 as const };
  }
  return { user };
}

// ── Crear usuario ───────────────────────────────────────────
export async function POST(req: Request) {
  const guard = await requireSuperAdmin();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  let body: { nombre?: string; email?: string; password?: string; rol?: string; zona_base_id?: string | null; tipo?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }

  const nombre = (body.nombre ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const rol = body.rol as Rol;

  if (!nombre) return NextResponse.json({ error: "El nombre es obligatorio" }, { status: 400 });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Ingresá un email con formato válido (ej: nombre@diagnotest.com)" }, { status: 400 });
  }
  if (password.length < 6) return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 });
  if (!ROLES_VALIDOS.includes(rol)) return NextResponse.json({ error: "Rol inválido" }, { status: 400 });

  const admin = createAdminClient();
  // email_confirm: true → queda confirmado sin necesidad de correo real.
  // El trigger on_auth_user_created crea automáticamente el profile con nombre+rol.
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre, rol },
  });

  if (error) {
    const msg = /already.*registered|exists/i.test(error.message)
      ? "Ya existe un usuario con ese email"
      : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // Si es cadete, crear automáticamente su ficha en Personal vinculada al profile.
  if (rol === "personal_logistica" && data.user?.id) {
    const tipo = ["fijo", "reemplazo", "ventanilla"].includes(body.tipo ?? "") ? body.tipo : "fijo";
    await admin.from("personal").insert({
      profile_id: data.user.id,
      nombre,
      zona_base_id: body.zona_base_id || null,
      tipo,
      activo: true,
    });
  }

  return NextResponse.json({ ok: true, id: data.user?.id });
}

// ── Editar usuario (nombre / email / rol / contraseña / activo) ─
export async function PATCH(req: Request) {
  const guard = await requireSuperAdmin();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  let body: { id?: string; nombre?: string; email?: string; password?: string; rol?: string; activo?: boolean; zona_base_id?: string | null; tipo?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }

  const id = body.id;
  if (!id) return NextResponse.json({ error: "Falta el id del usuario" }, { status: 400 });

  const admin = createAdminClient();

  // 1) Cambios en auth.users (email / password / ban segun activo)
  const authUpdate: Record<string, unknown> = {};
  if (typeof body.email === "string") {
    const email = body.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Email con formato inválido" }, { status: 400 });
    }
    authUpdate.email = email;
    authUpdate.email_confirm = true;
  }
  if (typeof body.password === "string" && body.password.length > 0) {
    if (body.password.length < 6) return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 });
    authUpdate.password = body.password;
  }
  if (typeof body.activo === "boolean") {
    // Banear bloquea el login; "none" lo reactiva.
    authUpdate.ban_duration = body.activo ? "none" : "876600h";
  }
  if (Object.keys(authUpdate).length > 0) {
    const { error } = await admin.auth.admin.updateUserById(id, authUpdate);
    if (error) {
      const msg = /already.*registered|exists/i.test(error.message)
        ? "Ese email ya está en uso por otro usuario"
        : error.message;
      return NextResponse.json({ error: msg }, { status: 400 });
    }
  }

  // 2) Cambios en la tabla profiles (nombre / email / rol / activo)
  const profileUpdate: Record<string, unknown> = {};
  if (typeof body.nombre === "string" && body.nombre.trim()) profileUpdate.nombre = body.nombre.trim();
  if (typeof body.email === "string") profileUpdate.email = body.email.trim().toLowerCase();
  if (typeof body.rol === "string") {
    if (!ROLES_VALIDOS.includes(body.rol as Rol)) return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
    profileUpdate.rol = body.rol;
  }
  if (typeof body.activo === "boolean") profileUpdate.activo = body.activo;

  if (Object.keys(profileUpdate).length > 0) {
    const { error } = await admin.from("profiles").update(profileUpdate).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // 3) Sincronizar la ficha de Personal (cadetes): nombre / zona / tipo / activo.
  const personalUpdate: Record<string, unknown> = {};
  if (typeof body.nombre === "string" && body.nombre.trim()) personalUpdate.nombre = body.nombre.trim();
  if (typeof body.zona_base_id !== "undefined") personalUpdate.zona_base_id = body.zona_base_id || null;
  if (typeof body.tipo === "string") personalUpdate.tipo = body.tipo;
  if (typeof body.activo === "boolean") personalUpdate.activo = body.activo;

  if (Object.keys(personalUpdate).length > 0) {
    const { data: existing } = await admin.from("personal").select("id").eq("profile_id", id).maybeSingle();
    if (existing) {
      await admin.from("personal").update(personalUpdate).eq("profile_id", id);
    } else if (body.rol === "personal_logistica") {
      // El usuario recién pasa a ser cadete: crear su ficha.
      const { data: prof } = await admin.from("profiles").select("nombre").eq("id", id).single();
      await admin.from("personal").insert({
        profile_id: id,
        nombre: (personalUpdate.nombre as string) ?? prof?.nombre ?? "Cadete",
        zona_base_id: (personalUpdate.zona_base_id as string | null) ?? null,
        tipo: (personalUpdate.tipo as string) ?? "fijo",
        activo: (personalUpdate.activo as boolean) ?? true,
      });
    }
  }

  return NextResponse.json({ ok: true });
}
