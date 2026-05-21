/**
 * DIAGNOTEST — Seed Script
 * Ejecutar con: npx ts-node supabase/seed.ts
 * Requiere SUPABASE_SERVICE_ROLE_KEY en .env.local
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ── Helpers ─────────────────────────────────────────────────
function uuid() {
  return crypto.randomUUID();
}

function toEmailPart(name: string) {
  return name.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9.]/g, ".");
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Data ─────────────────────────────────────────────────────

const ZONAS_DATA = [
  { nombre: "Norte", descripcion: "Zona norte de la ciudad" },
  { nombre: "Sur", descripcion: "Zona sur de la ciudad" },
  { nombre: "Este", descripcion: "Zona este de la ciudad" },
  { nombre: "Oeste", descripcion: "Zona oeste de la ciudad" },
  { nombre: "Centro", descripcion: "Zona central" },
  { nombre: "Palermo", descripcion: "Barrio Palermo y alrededores" },
];

const VETS_DATA = [
  { codigo: "SR-01", nombre: "Clínica San Roque", zona: "Norte", condicion: "Responsable Inscripto" },
  { codigo: "VS-07", nombre: "Veterinaria del Sur", zona: "Sur", condicion: "Monotributista" },
  { codigo: "PC-02", nombre: "Pet Care Center", zona: "Centro", condicion: "Responsable Inscripto" },
  { codigo: "CN-11", nombre: "Clínica Norte", zona: "Norte", condicion: "Monotributista" },
  { codigo: "VP-03", nombre: "VetSalud Palermo", zona: "Palermo", condicion: "Responsable Inscripto" },
  { codigo: "LP-05", nombre: "Clínica La Plata", zona: "Sur", condicion: "Exento" },
  { codigo: "CV-09", nombre: "Centro Veterinario", zona: "Centro", condicion: "Monotributista" },
  { codigo: "CB-04", nombre: "Clínica Belgrano", zona: "Norte", condicion: "Responsable Inscripto" },
];

const PERSONAL_DATA = [
  { nombre: "Agustín Torres", tipo: "fijo", zona: "Norte" },
  { nombre: "Alan Pérez", tipo: "fijo", zona: "Sur" },
  { nombre: "Alejandro Martínez", tipo: "reemplazo", zona: "Este" },
  { nombre: "Andrés López", tipo: "fijo", zona: "Oeste" },
  { nombre: "Ariel Bernal", tipo: "fijo", zona: "Norte" },
  { nombre: "Carlos Díaz", tipo: "ventanilla", zona: "Centro" },
  { nombre: "Emily Romero", tipo: "fijo", zona: "Sur" },
];

const USERS_DATA = [
  ...PERSONAL_DATA.map((p) => ({
    email: `${toEmailPart(p.nombre)}@diagnotest.com`,
    password: "Diagnotest2024!",
    nombre: p.nombre,
    rol: "personal_logistica",
  })),
  { email: "ignacio.peralta@diagnotest.com", password: "Diagnotest2024!", nombre: "Ignacio Peralta", rol: "jefe_logistica" },
  { email: "carlos.gomez@diagnotest.com", password: "Diagnotest2024!", nombre: "Dr. Carlos Gómez", rol: "preanalitica" },
  { email: "laura.mendez@diagnotest.com", password: "Diagnotest2024!", nombre: "Laura Méndez", rol: "cobranzas" },
  { email: "direccion@diagnotest.com", password: "Diagnotest2024!", nombre: "Dir. General", rol: "dueno" },
  { email: "admin@diagnotest.com", password: "Diagnotest2024!", nombre: "Super Admin", rol: "super_admin" },
];

async function cleanup() {
  console.log("🧹 Limpiando datos anteriores...");
  const tables = ["gastos", "pedidos_retiro", "control_cobranzas", "control_preanalitica", "retiros", "personal", "veterinarias", "zonas"];
  for (const t of tables) {
    await (supabase.from(t) as any).delete().neq("id", "00000000-0000-0000-0000-000000000000");
  }
  console.log("   ✓ Tablas limpiadas\n");
}

async function main() {
  console.log("🌱 Iniciando seed de DIAGNOTEST...\n");
  await cleanup();

  // 1. Zonas
  console.log("📍 Creando zonas...");
  const { data: zonas, error: zonasErr } = await supabase
    .from("zonas")
    .insert(ZONAS_DATA.map((z) => ({ id: uuid(), ...z })))
    .select();
  if (zonasErr) { console.error("Error zonas:", zonasErr); return; }
  const zonaMap = Object.fromEntries(zonas!.map((z) => [z.nombre, z.id]));
  console.log(`   ✓ ${zonas!.length} zonas creadas`);

  // 2. Veterinarias
  console.log("🏥 Creando veterinarias...");
  const { data: vets, error: vetsErr } = await supabase
    .from("veterinarias")
    .insert(VETS_DATA.map((v) => ({
      id: uuid(), codigo: v.codigo, nombre: v.nombre,
      zona_id: zonaMap[v.zona], condicion_facturacion: v.condicion, activa: true,
    })))
    .select();
  if (vetsErr) { console.error("Error vets:", vetsErr); return; }
  const vetList = vets!;
  console.log(`   ✓ ${vets!.length} veterinarias creadas`);

  // 3. Crear usuarios en Auth
  console.log("👥 Creando usuarios...");
  const profileIds: Record<string, string> = {};

  for (const u of USERS_DATA) {
    let userId: string | null = null;

    const { data, error } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { nombre: u.nombre, rol: u.rol },
    });

    if (error) {
      // Try to find existing user in auth
      const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      const found = list?.users?.find((x) => x.email === u.email);
      if (found) {
        userId = found.id;
        console.log(`   ~ ${u.email} ya existe en auth, usando ID existente`);
      } else {
        console.log(`   ✗ ${u.email}: ${error.message}`);
        continue;
      }
    } else {
      userId = data.user.id;
      console.log(`   ✓ ${u.email} (${u.rol})`);
    }

    profileIds[u.email] = userId;
    await supabase.from("profiles").upsert({
      id: userId, nombre: u.nombre, email: u.email, rol: u.rol as any, activo: true,
    });
  }

  // 4. Personal
  console.log("\n🚴 Creando registros de personal...");
  const personalRecords: Record<string, string> = {};
  for (const p of PERSONAL_DATA) {
    const email = `${toEmailPart(p.nombre)}@diagnotest.com`;
    const profileId = profileIds[email];
    if (!profileId) continue;

    const { data: per } = await supabase
      .from("personal")
      .insert({ id: uuid(), profile_id: profileId, nombre: p.nombre, zona_base_id: zonaMap[p.zona], tipo: p.tipo, activo: true })
      .select()
      .single();
    if (per) { personalRecords[p.nombre] = per.id; console.log(`   ✓ ${p.nombre}`); }
  }

  // 5. Retiros de prueba (50)
  console.log("\n📋 Creando retiros de prueba...");
  const personalIds = Object.values(personalRecords);
  const adminProfileId = profileIds["admin@diagnotest.com"];

  const retiros: Array<{
    id: string; timestamp_carga: string; fecha_operativa: string;
    personal_id: string; veterinaria_id: string; veterinaria_texto_original: string;
    codigo_original: string; cantidad_muestras: number; importe_declarado: number;
    tipo: string; urgente: boolean; estado: string; sincronizado: boolean;
    created_by: string | undefined; anulado: boolean;
  }> = [];
  for (let i = 0; i < 50; i++) {
    const personalId = pick(personalIds);
    const vet = pick(vetList);
    const daysAgoN = randomInt(0, 30);
    const fechaOp = daysAgo(daysAgoN);

    retiros.push({
      id: uuid(),
      timestamp_carga: new Date(Date.now() - daysAgoN * 86400000 - randomInt(0, 28800000)).toISOString(),
      fecha_operativa: fechaOp,
      personal_id: personalId,
      veterinaria_id: vet.id,
      veterinaria_texto_original: vet.nombre,
      codigo_original: vet.codigo,
      cantidad_muestras: randomInt(1, 12),
      importe_declarado: randomInt(800, 8000),
      tipo: "veterinaria",
      urgente: Math.random() < 0.15,
      estado: "registrado",
      sincronizado: true,
      created_by: adminProfileId,
      anulado: false,
    });
  }

  const { error: retirosErr } = await supabase.from("retiros").insert(retiros);
  if (retirosErr) { console.error("Error retiros:", retirosErr); return; }
  console.log(`   ✓ 50 retiros creados`);

  // 6. Controles preanalítica (20)
  console.log("\n🔬 Creando controles preanalítica...");
  const preProfileId = profileIds["carlos.gomez@diagnotest.com"];
  const retiroIds = retiros.map((r) => r.id);
  const preEstados = ["pendiente", "pendiente", "pendiente", "ok", "ok", "ok", "observado", "rechazado"];

  const preControles = retiroIds.slice(0, 20).map((rid) => ({
    id: uuid(),
    retiro_id: rid,
    estado: pick(preEstados),
    control_1: Math.random() > 0.3 ? pick(["ok", "observar"]) : null,
    control_2: Math.random() > 0.4 ? pick(["ok", "observar"]) : null,
    urgente: Math.random() < 0.1,
    responsable_id: preProfileId,
  }));

  await supabase.from("control_preanalitica").upsert(preControles, { onConflict: "retiro_id" });
  console.log(`   ✓ 20 controles preanalítica actualizados`);

  // 7. Controles cobranzas (15)
  console.log("💰 Actualizando controles cobranzas...");
  const cobProfileId = profileIds["laura.mendez@diagnotest.com"];
  const cobEstados = ["pendiente", "pendiente", "pendiente", "adjudicado", "adjudicado", "diferencia"];

  const cobControles = retiroIds.slice(5, 20).map((rid, i) => {
    const decl = retiros[i + 5].importe_declarado;
    const valid = decl + randomInt(-200, 200);
    return {
      id: uuid(),
      retiro_id: rid,
      estado: pick(cobEstados),
      importe_declarado: decl,
      importe_validado: valid,
      diferencia: valid - decl,
      medio_pago: pick(["efectivo", "transferencia", "mercadopago"]),
      responsable_id: cobProfileId,
    };
  });

  for (const c of cobControles) {
    await supabase.from("control_cobranzas").upsert(c, { onConflict: "retiro_id" });
  }
  console.log(`   ✓ 15 controles cobranzas actualizados`);

  // 8. Pedidos de retiro (10)
  console.log("\n📦 Creando pedidos de retiro...");
  const jefeProfileId = profileIds["ignacio.peralta@diagnotest.com"];
  const estadosPedido = ["asignado", "asignado", "asignado", "vencido", "resuelto", "resuelto", "cancelado"];

  const pedidos = Array.from({ length: 10 }, (_, i) => {
    const est = pick(estadosPedido);
    const createdAt = new Date(Date.now() - randomInt(1, 48) * 3600000);
    return {
      id: uuid(),
      veterinaria_id: pick(vetList).id,
      personal_asignado_id: pick(personalIds),
      creado_por_id: jefeProfileId,
      estado: est,
      urgente: Math.random() < 0.2,
      detalle: pick(["Retiro urgente de hemograma", "Cultivos microbiológicos", "Perfiles bioquímicos", "Retiro adicional por cirugía", null]),
      fecha_limite: new Date(createdAt.getTime() + 7200000).toISOString(),
      resuelto_en: est === "resuelto" ? new Date(createdAt.getTime() + randomInt(1800000, 7200000)).toISOString() : null,
      reasignaciones: est === "vencido" ? randomInt(1, 2) : 0,
      created_at: createdAt.toISOString(),
    };
  });

  await supabase.from("pedidos_retiro").insert(pedidos);
  console.log(`   ✓ 10 pedidos creados`);

  // 9. Gastos (15)
  console.log("\n💸 Creando gastos...");
  const gastoDescs = [
    "Nafta Shell estación Florida", "Peaje autopista Dellepiane",
    "Nafta YPF Av. Rivadavia", "Estacionamiento zona norte",
    "Nafta Axion Palermo", "Recupero gastos semana anterior",
    "Nafta BP zona sur", "Peaje autopista Riccheri",
    "Nafta Shell terminal", "Estacionamiento Belgrano",
  ];

  const gastos = [];
  for (let i = 0; i < 15; i++) {
    const personalId = pick(personalIds);
    const esTipo: "gasto" | "retiro_dinero" = Math.random() < 0.7 ? "gasto" : "retiro_dinero";
    const estado = pick(["pendiente", "pendiente", "pendiente", "autorizado", "observado"]);
    gastos.push({
      id: uuid(),
      personal_id: personalId,
      tipo: esTipo,
      descripcion: pick(gastoDescs),
      monto: randomInt(500, 15000),
      fecha_operativa: daysAgo(randomInt(0, 7)),
      estado,
      comprobante_url: Math.random() > 0.3 ? "https://example.com/comprobante.jpg" : null,
      observacion_jefe: estado === "observado" ? "Sin comprobante adjunto" : null,
    });
  }

  await supabase.from("gastos").insert(gastos);
  console.log(`   ✓ 15 gastos creados`);

  console.log("\n✅ Seed completado exitosamente!");
  console.log("\n📧 Usuarios creados:");
  USERS_DATA.forEach((u) => console.log(`   ${u.email} / ${u.password} (${u.rol})`));
}

main().catch(console.error);
