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

function toCsvUrl(input: string): string | null {
  const url = input.trim();
  if (/output=csv|format=csv/i.test(url)) return url;
  const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) return null;
  const gidMatch = url.match(/[#&?]gid=(\d+)/);
  return `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv${gidMatch ? `&gid=${gidMatch[1]}` : ""}`;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "", row: string[] = [], inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; }
      else field += c;
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

// ── POST: sincronizar zonas desde el Sheet (LOCALIDAD, ZONA) ─
export async function POST(req: Request) {
  const guard = await requireSuperAdmin();
  if ("error" in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  let body: { sheetUrl?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }); }

  const csvUrl = toCsvUrl(body.sheetUrl ?? "");
  if (!csvUrl) return NextResponse.json({ error: "El link no parece un Google Sheet válido" }, { status: 400 });

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

  const rows = parseCsv(csvText).filter((r) => r.some((c) => c.trim() !== ""));
  if (rows.length < 2) return NextResponse.json({ error: "El Sheet no tiene filas de datos" }, { status: 400 });

  const headers = rows[0].map(norm);
  const colLocalidad = headers.findIndex((h) => ["localidad", "localidades", "barrio", "partido"].includes(h));
  const colZona = headers.findIndex((h) => ["zona", "zona base", "zona_base"].includes(h));
  if (colLocalidad === -1 || colZona === -1) {
    return NextResponse.json({ error: "El Sheet debe tener las columnas 'localidad' y 'zona' en la primera fila" }, { status: 400 });
  }

  // Agrupar localidades por nombre de zona
  const localidadesPorZona = new Map<string, { localidades: Set<string> }>();
  let sinZona = 0;
  for (const r of rows.slice(1)) {
    const localidad = (r[colLocalidad] ?? "").trim();
    const zona = (r[colZona] ?? "").trim();
    if (!localidad) continue;
    if (!zona) { sinZona++; continue; }
    if (!localidadesPorZona.has(zona)) localidadesPorZona.set(zona, { localidades: new Set() });
    localidadesPorZona.get(zona)!.localidades.add(localidad);
  }

  const admin = createAdminClient();
  const { data: existentes } = await admin.from("zonas").select("id, nombre");
  const zonaByName = new Map((existentes ?? []).map((z) => [norm(z.nombre), z.id]));

  const results: { zona: string; localidades: number; estado: "creada" | "actualizada" | "error"; detalle?: string }[] = [];

  for (const [zonaNombre, { localidades }] of Array.from(localidadesPorZona.entries())) {
    const locs = Array.from(localidades).sort();
    const key = norm(zonaNombre);
    const existingId = zonaByName.get(key);
    if (existingId) {
      const { error } = await admin.from("zonas").update({ localidades: locs, activa: true }).eq("id", existingId);
      if (error) { results.push({ zona: zonaNombre, localidades: locs.length, estado: "error", detalle: error.message }); continue; }
      results.push({ zona: zonaNombre, localidades: locs.length, estado: "actualizada" });
    } else {
      const { data: nz, error } = await admin.from("zonas").insert({ nombre: zonaNombre, localidades: locs, activa: true }).select("id").single();
      if (error) { results.push({ zona: zonaNombre, localidades: locs.length, estado: "error", detalle: error.message }); continue; }
      if (nz) zonaByName.set(key, nz.id);
      results.push({ zona: zonaNombre, localidades: locs.length, estado: "creada" });
    }
  }

  const creadas = results.filter((r) => r.estado === "creada").length;
  const actualizadas = results.filter((r) => r.estado === "actualizada").length;
  const errores = results.filter((r) => r.estado === "error").length;
  const totalLocalidades = results.reduce((a, r) => a + (r.estado !== "error" ? r.localidades : 0), 0);

  return NextResponse.json({
    ok: true,
    resumen: { creadas, actualizadas, errores, totalZonas: results.length, totalLocalidades, sinZona },
    results,
  });
}
