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
  if (/output=csv|format=csv/i.test(url)) return url; // ya es CSV
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

function genPassword(): string {
  const letras = "abcdefghjkmnpqrstuvwxyz"; // sin i,l,o,ñ ambiguas
  const nums = "23456789";
  let p = "";
  for (let i = 0; i < 4; i++) p += letras[Math.floor(Math.random() * letras.length)];
  for (let i = 0; i < 4; i++) p += nums[Math.floor(Math.random() * nums.length)];
  return p;
}

interface ResultRow { nombre: string; email: string; password?: string; estado: "creado" | "existente" | "error"; detalle?: string }

// ── POST: sincronizar cadetes desde el Sheet ────────────────
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
  const colNombre = headers.findIndex((h) => ["nombre", "nombre completo", "apellido y nombre", "cadete"].includes(h));
  const colEmail = headers.findIndex((h) => ["email", "mail", "correo", "e-mail"].includes(h));
  const colZona = headers.findIndex((h) => ["zona", "zona base", "zona_base"].includes(h));
  const colTipo = headers.findIndex((h) => ["tipo"].includes(h));

  if (colNombre === -1 || colEmail === -1) {
    return NextResponse.json({ error: "El Sheet debe tener al menos las columnas 'nombre' y 'email' en la primera fila" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Mapa de zonas por nombre normalizado
  const { data: zonas } = await admin.from("zonas").select("id, nombre");
  const zonaByName = new Map((zonas ?? []).map((z) => [norm(z.nombre), z.id]));

  const results: ResultRow[] = [];

  for (const r of rows.slice(1)) {
    const nombre = (r[colNombre] ?? "").trim();
    const email = (r[colEmail] ?? "").trim().toLowerCase();
    if (!nombre && !email) continue;
    if (!nombre || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      results.push({ nombre: nombre || "(sin nombre)", email: email || "(sin email)", estado: "error", detalle: "Nombre o email inválido" });
      continue;
    }

    const zonaId = colZona !== -1 ? (zonaByName.get(norm(r[colZona] ?? "")) ?? null) : null;
    const tipoRaw = colTipo !== -1 ? norm(r[colTipo] ?? "") : "";
    const tipo = ["fijo", "reemplazo", "ventanilla"].includes(tipoRaw) ? tipoRaw : "fijo";

    // ¿Ya existe?
    const { data: existing } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
    if (existing) {
      // Actualizar su ficha de personal (zona/tipo/nombre) sin tocar la contraseña.
      const { data: ficha } = await admin.from("personal").select("id").eq("profile_id", existing.id).maybeSingle();
      if (ficha) {
        await admin.from("personal").update({ nombre, zona_base_id: zonaId, tipo }).eq("profile_id", existing.id);
      } else {
        await admin.from("personal").insert({ profile_id: existing.id, nombre, zona_base_id: zonaId, tipo, activo: true });
      }
      results.push({ nombre, email, estado: "existente", detalle: "Ya tenía usuario — ficha actualizada" });
      continue;
    }

    // Crear usuario + ficha
    const password = genPassword();
    const { data: created, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { nombre, rol: "personal_logistica" },
    });
    if (error || !created.user) {
      results.push({ nombre, email, estado: "error", detalle: error?.message ?? "No se pudo crear" });
      continue;
    }
    await admin.from("personal").insert({ profile_id: created.user.id, nombre, zona_base_id: zonaId, tipo, activo: true });
    results.push({ nombre, email, password, estado: "creado" });
  }

  const creados = results.filter((r) => r.estado === "creado").length;
  const existentes = results.filter((r) => r.estado === "existente").length;
  const errores = results.filter((r) => r.estado === "error").length;

  return NextResponse.json({ ok: true, resumen: { creados, existentes, errores, total: results.length }, results });
}
