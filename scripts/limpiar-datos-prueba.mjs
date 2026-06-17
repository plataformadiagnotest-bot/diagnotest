// ============================================================
// Limpieza de datos de PRUEBA para arrancar a operar.
// Borra todo lo operativo y CONSERVA los maestros y usuarios:
//   - CONSERVA: profiles (logins), personal, veterinarias, zonas
//   - BORRA:    retiros, control_preanalitica, control_cobranzas,
//               pedidos_retiro, gastos, rendiciones_caja, auditoria
//   - BORRA:    todos los archivos del bucket "comprobantes"
//
// Uso:  node scripts/limpiar-datos-prueba.mjs
// Lee credenciales de .env.local (service role).
// ============================================================
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Parseo simple de .env.local
const env = {};
for (const line of readFileSync(join(__dirname, "..", ".env.local"), "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Faltan credenciales en .env.local"); process.exit(1); }

const sb = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const ALL = "00000000-0000-0000-0000-000000000000"; // filtro que matchea todas las filas

// Orden: primero las que referencian a retiros, luego retiros.
const TABLAS = [
  "auditoria",
  "gastos",
  "pedidos_retiro",
  "rendiciones_caja",
  "control_preanalitica",
  "control_cobranzas",
  "retiros",
];

async function borrarTabla(tabla) {
  const { count: antes } = await sb.from(tabla).select("id", { count: "exact", head: true });
  const { error } = await sb.from(tabla).delete().neq("id", ALL);
  if (error) { console.error(`  ✗ ${tabla}: ${error.message}`); return; }
  console.log(`  ✓ ${tabla}: ${antes ?? "?"} filas borradas`);
}

// Vacía el bucket "comprobantes" recursivamente.
async function vaciarStorage() {
  async function walk(prefix) {
    const { data, error } = await sb.storage.from("comprobantes").list(prefix, { limit: 1000 });
    if (error) { console.error(`  ✗ storage list ${prefix}: ${error.message}`); return []; }
    let archivos = [];
    for (const item of data ?? []) {
      const ruta = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null || item.metadata === null) {
        archivos = archivos.concat(await walk(ruta)); // es carpeta
      } else {
        archivos.push(ruta);
      }
    }
    return archivos;
  }
  const archivos = await walk("");
  if (archivos.length) {
    const { error } = await sb.storage.from("comprobantes").remove(archivos);
    if (error) console.error(`  ✗ storage remove: ${error.message}`);
    else console.log(`  ✓ storage: ${archivos.length} archivo(s) borrado(s)`);
  } else {
    console.log("  ✓ storage: sin archivos");
  }
}

console.log("Limpiando datos de prueba (se conservan profiles, personal, veterinarias, zonas)…");
for (const t of TABLAS) await borrarTabla(t);
await vaciarStorage();
console.log("Listo.");
