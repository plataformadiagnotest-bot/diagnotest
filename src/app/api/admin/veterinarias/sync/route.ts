import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// ── Helpers ─────────────────────────────────────────────────
async function requireSuperAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "No autenticado", status: 401 as const };
  const { data: profile } = await supabase.from("profiles").select("rol").eq("id", user.id).single();
  if (profile?.rol !== "super_admin") return { error: "Solo el super administrador puede sincronizar", status: 403 as const };
  return { user };
}

// Convierte un link de Google Sheets a su URL de exportación CSV.
function toCsvUrl(input: string): string | null {
  const url = input.trim();
  if (/output=csv|format=csv/i.test(url)) return url;
  const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) return null;
  const gidMatch = url.match(/[#&?]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : "0";
  return `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv&gid=${gid}`;
}

// Parser CSV mínimo que respeta comillas y comas internas.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "", row: string[] = [], inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* ignorar */ }
      else field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

interface ResultRow { codigo: string; nombre: string; estado: "creado" | "actualizado" | "error"; detalle?: string }

// ── POST: sincronizar veterinarias desde el Sheet ───────────
export async function POST(req: Request) {
  const guard = await requireSuperAdmin();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  let body: { sheetUrl?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }

  const csvUrl = toCsvUrl(body.sheetUrl ?? "");
  if (!csvUrl) return NextResponse.json({ error: "El link no parece un Google Sheet válido" }, { status: 400 });

  // 1) Descargar el CSV
  let csvText: string;
  try {
    const resp = await fetch(csvUrl, { redirect: "follow", cache: "no-store" });
    if (!resp.ok) throw new Error(String(resp.status));
    csvText = await resp.text();
    if (/<html/i.test(csvText)) {
      return NextResponse.json({ error: "No se pudo leer el Sheet. Verificá que esté como 'Cualquiera con el enlace puede ver'." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "No se pudo descargar el Sheet (revisá el link y los permisos)" }, { status: 400 });
  }

  // 2) Parsear y mapear columnas por encabezado
  const rows = parseCsv(csvText).filter((r) => r.some((c) => c.trim() !== ""));
  if (rows.length < 2) return NextResponse.json({ error: "El Sheet no tiene filas de datos" }, { status: 400 });

  const headers = rows[0].map(norm);
  const colCodigo = headers.findIndex((h) => ["codigo", "código", "cod", "code"].includes(h));
  const colNombre = headers.findIndex((h) => ["nombre", "veterinaria", "nombre veterinaria"].includes(h));
  const colDireccion = headers.findIndex((h) => ["direccion", "dirección", "domicilio"].includes(h));
  const colTelefono = headers.findIndex((h) => ["telefono", "teléfono", "tel", "celular", "contacto"].includes(h));
  const colEmail = headers.findIndex((h) => ["email", "e-mail", "mail", "correo"].includes(h));
  const colLocalidad = headers.findIndex((h) => ["localidad", "barrio", "partido"].includes(h));
  const colZona = headers.findIndex((h) => ["zona", "zona base", "zona_base"].includes(h));

  if (colCodigo === -1 || colNombre === -1) {
    return NextResponse.json({ error: "El Sheet debe tener al menos las columnas 'codigo' y 'nombre' en la primera fila" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Zonas: nombre→id, y mapa localidad→zonaId (lo arma el jefe de logística).
  const { data: zonas } = await admin.from("zonas").select("id, nombre, localidades");
  const zonaByName = new Map((zonas ?? []).map((z) => [norm(z.nombre), z.id]));
  const zonaByLocalidad = new Map<string, string>();
  const barriosCABA: string[] = [];
  for (const z of zonas ?? []) {
    const esCABA = norm(z.nombre).startsWith("caba");
    for (const loc of (z.localidades as string[] | null) ?? []) {
      const key = norm(loc);
      if (!key) continue;
      if (!zonaByLocalidad.has(key)) zonaByLocalidad.set(key, z.id);
      if (esCABA) barriosCABA.push(key);
    }
  }
  // Barrios más largos primero, para evitar matches parciales (ej. "flores" dentro de "floresta").
  barriosCABA.sort((a, b) => b.length - a.length);

  // Deduce la zona a partir de la localidad. Si la localidad es "CABA" (genérica),
  // intenta inferir el barrio desde la dirección (solo barrios de CABA).
  function resolverZona(localidad: string, direccion: string): string | null {
    const locN = norm(localidad);
    if (locN && locN !== "caba" && zonaByLocalidad.has(locN)) return zonaByLocalidad.get(locN)!;
    if (locN === "caba" && direccion) {
      const d = " " + norm(direccion).replace(/[.,]/g, " ").replace(/\s+/g, " ") + " ";
      for (const b of barriosCABA) {
        if (d.includes(" " + b + " ")) return zonaByLocalidad.get(b)!;
      }
    }
    return null;
  }

  const results: ResultRow[] = [];
  let conZona = 0;

  for (const r of rows.slice(1)) {
    const codigo = (r[colCodigo] ?? "").trim();
    const nombre = (r[colNombre] ?? "").trim();
    if (!codigo && !nombre) continue;
    if (!codigo || !nombre) {
      results.push({ codigo: codigo || "(sin código)", nombre: nombre || "(sin nombre)", estado: "error", detalle: "Falta código o nombre" });
      continue;
    }

    const direccion = colDireccion !== -1 ? (r[colDireccion] ?? "").trim() || null : null;
    const telefono = colTelefono !== -1 ? (r[colTelefono] ?? "").trim() || null : null;
    const email = colEmail !== -1 ? (r[colEmail] ?? "").trim() || null : null;
    const localidad = colLocalidad !== -1 ? (r[colLocalidad] ?? "").trim() || null : null;

    // Zona: si el Sheet trae columna 'zona' se usa; si no, se deduce de la localidad.
    let zonaId: string | null = null;
    const zonaNombre = colZona !== -1 ? (r[colZona] ?? "").trim() : "";
    if (zonaNombre) {
      const key = norm(zonaNombre);
      if (zonaByName.has(key)) {
        zonaId = zonaByName.get(key) ?? null;
      } else {
        const { data: nz } = await admin.from("zonas").insert({ nombre: zonaNombre, activa: true }).select("id").single();
        if (nz) { zonaId = nz.id; zonaByName.set(key, nz.id); }
      }
    } else {
      zonaId = resolverZona(localidad ?? "", direccion ?? "");
    }
    if (zonaId) conZona++;

    // ¿Ya existe por código? → actualizar; si no, crear.
    const { data: existing } = await admin.from("veterinarias").select("id").eq("codigo", codigo).maybeSingle();
    const payload = { codigo, nombre, direccion, telefono, email, localidad, zona_id: zonaId, activa: true };

    if (existing) {
      const { error } = await admin.from("veterinarias").update(payload).eq("id", existing.id);
      if (error) { results.push({ codigo, nombre, estado: "error", detalle: error.message }); continue; }
      results.push({ codigo, nombre, estado: "actualizado" });
    } else {
      const { error } = await admin.from("veterinarias").insert(payload);
      if (error) { results.push({ codigo, nombre, estado: "error", detalle: error.message }); continue; }
      results.push({ codigo, nombre, estado: "creado" });
    }
  }

  const creados = results.filter((r) => r.estado === "creado").length;
  const actualizados = results.filter((r) => r.estado === "actualizado").length;
  const errores = results.filter((r) => r.estado === "error").length;

  return NextResponse.json({ ok: true, resumen: { creados, actualizados, errores, total: results.length, conZona }, results });
}
