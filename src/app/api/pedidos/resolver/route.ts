import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Normaliza un nombre de veterinaria para comparar (minúsculas, sin acentos,
// espacios colapsados) y poder matchear aunque el cadete lo haya escrito a mano.
function normVet(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Fecha operativa (AR) de un timestamptz, en formato YYYY-MM-DD.
function fechaAR(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

// El cadete marca un pedido como resuelto SOLO si el sistema encuentra, entre
// sus retiros, uno que coincida en veterinaria y fecha. Evita resoluciones
// arbitrarias sin que el jefe tenga que validar uno por uno.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  let body: { pedidoId?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }
  const pedidoId = body.pedidoId;
  if (!pedidoId) return NextResponse.json({ error: "Falta el pedido" }, { status: 400 });

  const { data: profile } = await supabase.from("profiles").select("rol").eq("id", user.id).single();
  const rol = profile?.rol ?? "";

  const admin = createAdminClient();

  // Traer el pedido + nombre de la veterinaria.
  const { data: pedido } = await admin
    .from("pedidos_retiro")
    .select("id, estado, personal_asignado_id, veterinaria_id, created_at, veterinaria:veterinaria_id(nombre)")
    .eq("id", pedidoId)
    .single();
  if (!pedido) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });

  // Autorización: el cadete asignado, o jefe/super_admin.
  let autorizado = ["jefe_logistica", "super_admin"].includes(rol);
  if (!autorizado && rol === "personal_logistica") {
    const { data: pers } = await supabase.from("personal").select("id").eq("profile_id", user.id).maybeSingle();
    autorizado = !!pers && pers.id === pedido.personal_asignado_id;
  }
  if (!autorizado) return NextResponse.json({ error: "No podés resolver este pedido" }, { status: 403 });

  if (pedido.estado === "resuelto") return NextResponse.json({ error: "El pedido ya estaba resuelto" }, { status: 400 });
  if (pedido.estado === "cancelado") return NextResponse.json({ error: "El pedido está cancelado" }, { status: 400 });

  const pedidoFecha = fechaAR(pedido.created_at);
  const vetNombre = (pedido.veterinaria as { nombre?: string } | null)?.nombre ?? "";

  // Candidatos: retiros del cadete asignado, no anulados, sin pedido vinculado,
  // de la fecha del pedido o posterior. Se elige el más reciente que coincida.
  const { data: candidatos } = await admin
    .from("retiros")
    .select("id, fecha_operativa, veterinaria_id, veterinaria_texto_original, created_at")
    .eq("personal_id", pedido.personal_asignado_id)
    .is("pedido_id", null)
    .eq("anulado", false)
    .gte("fecha_operativa", pedidoFecha)
    .order("created_at", { ascending: false });

  const vetNorm = normVet(vetNombre);
  const match = (candidatos ?? []).find((r) =>
    (r.veterinaria_id && r.veterinaria_id === pedido.veterinaria_id) ||
    (!!vetNorm && normVet(r.veterinaria_texto_original) === vetNorm)
  );

  if (!match) {
    return NextResponse.json({
      error: `No encontramos un retiro de "${vetNombre || "esa veterinaria"}" a tu nombre para esta fecha. Registrá primero el retiro y después marcá el pedido como resuelto.`,
    }, { status: 409 });
  }

  // Vincular retiro ↔ pedido y marcar resuelto.
  const nowISO = new Date().toISOString();
  const { error: pErr } = await admin
    .from("pedidos_retiro")
    .update({ estado: "resuelto", resuelto_en: nowISO, retiro_id: match.id, updated_at: nowISO })
    .eq("id", pedidoId);
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 });

  await admin.from("retiros").update({ pedido_id: pedidoId }).eq("id", match.id);

  return NextResponse.json({ ok: true, retiroId: match.id });
}
