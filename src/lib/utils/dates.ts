import { formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";

// Toda la app trabaja en horario de Buenos Aires (UTC-3, sin horario de verano).
// Los timestamps se guardan en UTC; acá se convierten a BA para mostrarlos, y
// el "hoy" se calcula como el día calendario de BA (no el de UTC, que cambia de
// día a las 21:00 hora argentina).
const TZ = "America/Argentina/Buenos_Aires";

const isDateOnly = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

// Descompone un timestamp en sus partes ya convertidas a horario de Buenos Aires.
function partsBA(date: string | Date) {
  const d = typeof date === "string" ? parseISO(date) : date;
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const o: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) o[p.type] = p.value;
  if (o.hour === "24") o.hour = "00"; // en-GB usa 24 a medianoche
  return o;
}

export function formatDate(date: string | Date, fmt = "dd/MM/yyyy") {
  // Fecha sola (ej. fecha_operativa): es un día calendario, no se convierte de
  // zona (si no, "2026-06-27" se mostraría como 26 en BA).
  if (isDateOnly(date)) {
    const [y, m, d] = date.split("-");
    return fmt.replace("yyyy", y).replace("MM", m).replace("dd", d);
  }
  const p = partsBA(date);
  return fmt.replace("yyyy", p.year).replace("MM", p.month).replace("dd", p.day);
}

export function formatDateTime(date: string | Date) {
  if (isDateOnly(date)) return `${date.slice(8, 10)}/${date.slice(5, 7)} 00:00`;
  const p = partsBA(date);
  return `${p.day}/${p.month} ${p.hour}:${p.minute}`;
}

export function formatTime(date: string | Date) {
  if (isDateOnly(date)) return "00:00";
  const p = partsBA(date);
  return `${p.hour}:${p.minute}`;
}

export function timeAgo(date: string | Date) {
  // Relativo a "ahora": es independiente de la zona (compara dos instantes).
  const d = typeof date === "string" ? parseISO(date) : date;
  return formatDistanceToNow(d, { addSuffix: true, locale: es });
}

// Día calendario (yyyy-mm-dd) en horario de Buenos Aires de un instante dado.
export function dateISOInBA(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
}

// "Hoy" en Buenos Aires (yyyy-mm-dd).
export function todayISO() {
  return dateISOInBA(new Date());
}

// "Hace n días" en Buenos Aires (yyyy-mm-dd). Argentina es UTC-3 fijo, así que
// restar n*24h y tomar el día de BA es exacto (no hay horario de verano).
export function daysAgoISO(n: number): string {
  return dateISOInBA(new Date(Date.now() - n * 86400000));
}

// Suma n días a un yyyy-mm-dd de forma calendaria (mediodía UTC: inmune a zona).
function addDaysISO(dateISO: string, n: number): string {
  const d = new Date(`${dateISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Para filtrar columnas de timestamp por "día de Buenos Aires": el día BA
// arranca a las 00:00 BA = 03:00 UTC (UTC-3 fijo). Devuelven el instante UTC
// del comienzo del día y del comienzo del día siguiente (fin exclusivo).
export function baDayStartUTC(dateISO: string): string {
  return `${dateISO}T03:00:00.000Z`;
}
export function baDayEndUTC(dateISO: string): string {
  return `${addDaysISO(dateISO, 1)}T03:00:00.000Z`;
}

export function nowISO() {
  return new Date().toISOString();
}
