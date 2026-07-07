import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Edición de un retiro por el propio cadete (o dirección/jefe), permitida SOLO
// mientras el retiro sigue pendiente en preanalítica y en cobranzas (nadie lo
// procesó todavía). Al cambiar muestras/importe se sincronizan los controles
// igual que el trigger de alta (0 muestras = sin preanalítica; $0 = sin cobranzas).

const ROLES_STAFF = ["jefe_logistica", "dueno", "super_admin"];

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("rol").eq("id", user.id).single();
  const rol = profile?.rol ?? "";

  let body: {
    id?: string;
    veterinaria_id?: string | null;
    veterinaria_texto_original?: string | null;
    codigo_original?: string | null;
    cantidad_muestras?: number;
    importe_declarado?: number;
    metodo_pago?: string | null;
    comentarios?: string | null;
    urgente?: boolean;
    comprobante_url?: string | null;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }
  if (!body.id) return NextResponse.json({ error: "Falta el retiro" }, { status: 400 });

  const admin = createAdminClient();

  const { data: retiro, error: getErr } = await admin
    .from("retiros")
    .select("id, personal_id, anulado, estado, created_by, personal:personal_id(profile_id)")
    .eq("id", body.id)
    .single();
  if (getErr || !retiro) return NextResponse.json({ error: "Retiro no encontrado" }, { status: 404 });

  // Permiso: el dueño del retiro (cadete) o el staff de logística/dirección.
  const esDueño = retiro.created_by === user.id
    || (retiro.personal as { profile_id?: string } | null)?.profile_id === user.id;
  if (!esDueño && !ROLES_STAFF.includes(rol)) {
    return NextResponse.json({ error: "No podés editar este retiro" }, { status: 403 });
  }

  if (retiro.anulado || retiro.estado === "duplicado_sospechoso") {
    return NextResponse.json({ error: "Este retiro no se puede editar" }, { status: 409 });
  }

  // Debe seguir pendiente en ambos circuitos (o sin control).
  const [{ data: pre }, { data: cob }] = await Promise.all([
    admin.from("control_preanalitica").select("id, estado, control_1, control_2, etiquetas").eq("retiro_id", body.id).maybeSingle(),
    admin.from("control_cobranzas").select("id, estado, importe_validado, detalle").eq("retiro_id", body.id).maybeSingle(),
  ]);
  const preEditable = !pre || pre.estado === "pendiente";
  const cobEditable = !cob || cob.estado === "pendiente";
  if (!preEditable || !cobEditable) {
    return NextResponse.json({ error: "El retiro ya está en control y no se puede editar" }, { status: 409 });
  }

  const muestras = Math.max(0, Math.trunc(Number(body.cantidad_muestras ?? 0)) || 0);
  const importe = Math.max(0, Number(body.importe_declarado ?? 0) || 0);

  const cambios: Record<string, unknown> = {
    veterinaria_id: body.veterinaria_id ?? null,
    veterinaria_texto_original: body.veterinaria_texto_original ?? null,
    codigo_original: body.codigo_original ?? null,
    cantidad_muestras: muestras,
    importe_declarado: importe,
    metodo_pago: importe > 0 ? (body.metodo_pago ?? null) : null,
    comentarios: (body.comentarios ?? "").toString().trim() || null,
    urgente: !!body.urgente,
  };
  if (body.comprobante_url) cambios.comprobante_url = body.comprobante_url;

  const { error: updErr } = await admin.from("retiros").update(cambios).eq("id", body.id);
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 400 });

  // ── Sincronizar preanalítica según muestras ──
  if (muestras > 0 && !pre) {
    const { data: respRow } = await admin.from("preanalitica_responsable_activo").select("responsable").eq("stage", "c1").maybeSingle();
    await admin.from("control_preanalitica").insert({ retiro_id: body.id, urgente: !!body.urgente, responsable_1: respRow?.responsable ?? null });
  } else if (muestras === 0 && pre && pre.estado === "pendiente"
    && pre.control_1 == null && pre.control_2 == null && (!pre.etiquetas || pre.etiquetas.length === 0)) {
    await admin.from("control_preanalitica").delete().eq("id", pre.id);
  }

  // ── Sincronizar cobranzas según importe ──
  if (importe > 0) {
    if (!cob) await admin.from("control_cobranzas").insert({ retiro_id: body.id, importe_declarado: importe });
    else await admin.from("control_cobranzas").update({ importe_declarado: importe }).eq("id", cob.id);
  } else if (cob && cob.estado === "pendiente" && cob.importe_validado == null && cob.detalle == null) {
    await admin.from("control_cobranzas").delete().eq("id", cob.id);
  }

  await admin.from("auditoria").insert({
    entidad: "retiro",
    entidad_id: body.id,
    accion: "Edición",
    campo_modificado: "registro",
    valor_anterior: null,
    valor_nuevo: `${cambios.codigo_original ?? ""} ${cambios.veterinaria_texto_original ?? ""} · ${muestras} m · $${importe}`.trim(),
    usuario_id: user.id,
  });

  return NextResponse.json({ ok: true });
}
