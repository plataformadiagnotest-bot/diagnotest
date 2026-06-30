import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Carga manual de las bolsas que preanalítica recibe de cada cadete en el día.
// Dos valores (V1/V2) por los dos recorridos posibles. Upsert por (cadete, día).
const ROLES_PERMITIDOS = ["preanalitica", "super_admin", "dueno"];

async function requireRol() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado", status: 401 as const };
  const { data: profile } = await supabase.from("profiles").select("rol").eq("id", user.id).single();
  if (!profile || !ROLES_PERMITIDOS.includes(profile.rol)) {
    return { error: "No tenés permiso para cargar bolsas", status: 403 as const };
  }
  return { user };
}

// Normaliza el valor de una bolsa: vacío → null; si no, entero >= 0.
function parseBolsa(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Math.trunc(Number(v));
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

export async function POST(req: Request) {
  const guard = await requireRol();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  let body: { personalId?: string; fecha?: string; bolsasV1?: unknown; bolsasV2?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }

  const personalId = body.personalId;
  const fecha = body.fecha;
  if (!personalId) return NextResponse.json({ error: "Falta el cadete" }, { status: 400 });
  if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin
    .from("bolsas_recibidas")
    .upsert(
      {
        personal_id: personalId,
        fecha,
        bolsas_v1: parseBolsa(body.bolsasV1),
        bolsas_v2: parseBolsa(body.bolsasV2),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "personal_id,fecha" }
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
