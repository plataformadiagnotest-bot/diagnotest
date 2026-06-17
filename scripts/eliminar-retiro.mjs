// Borra un retiro puntual por prefijo de id (los primeros 8 chars que se ven en la UI).
// Uso: node scripts/eliminar-retiro.mjs 36f86247
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = {};
for (const line of readFileSync(join(__dirname, "..", ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const prefijo = (process.argv[2] || "").toLowerCase();
if (!prefijo) { console.error("Pasá el prefijo del id, ej: node scripts/eliminar-retiro.mjs 36f86247"); process.exit(1); }

const { data: retiros, error } = await sb
  .from("retiros")
  .select("id, veterinaria_texto_original, importe_declarado, comprobante_url");
if (error) { console.error(error.message); process.exit(1); }

const match = (retiros ?? []).filter((r) => r.id.toLowerCase().startsWith(prefijo));
if (!match.length) { console.log(`No se encontró ningún retiro con id que empiece en "${prefijo}".`); process.exit(0); }
if (match.length > 1) { console.log(`Más de un retiro coincide con "${prefijo}":`, match.map((r) => r.id)); process.exit(1); }

const r = match[0];
console.log(`Borrando retiro ${r.id} — ${r.veterinaria_texto_original} — $${r.importe_declarado}`);

// Comprobante en storage (si tiene)
if (r.comprobante_url && r.comprobante_url.includes("/comprobantes/")) {
  const ruta = r.comprobante_url.split("/comprobantes/")[1];
  if (ruta) {
    const { error: se } = await sb.storage.from("comprobantes").remove([ruta]);
    if (se) console.error(`  ✗ storage: ${se.message}`); else console.log("  ✓ comprobante borrado");
  }
}

// Hard delete (cascade borra control_preanalitica y control_cobranzas)
const { error: de } = await sb.from("retiros").delete().eq("id", r.id);
if (de) { console.error(`  ✗ ${de.message}`); process.exit(1); }
console.log("  ✓ retiro eliminado (controles borrados por cascade)");
