import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Marca/desmarca una veterinaria como "fija" (genera pedido de retiro diario).
// Lo maneja logística (Martín) o dirección desde el maestro de veterinarias.
const ROLES_PERMITIDOS = ["jefe_logistica", "dueno", "super_admin"];

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("rol").eq("id", user.id).single();
  if (!ROLES_PERMITIDOS.includes(profile?.rol ?? "")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  let body: { id?: string; es_fija?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }
  if (!body.id) return NextResponse.json({ error: "Falta la veterinaria" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("veterinarias")
    .update({ es_fija: !!body.es_fija })
    .eq("id", body.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
