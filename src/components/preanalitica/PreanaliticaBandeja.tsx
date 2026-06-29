"use client";

import { useMemo, useState } from "react";
import { ControlCard } from "@/components/ui/ControlCard";
import { todayISO, daysAgoISO } from "@/lib/utils/dates";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

type Filtro = "fecha" | "personal" | "todos" | "urgentes" | "veterinaria";

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "fecha", label: "Por fecha" },
  { id: "personal", label: "Por personal" },
  { id: "todos", label: "Todos" },
  { id: "urgentes", label: "Urgentes primero" },
  { id: "veterinaria", label: "Por veterinaria" },
];

type Etapa = "c1" | "c2";

const esUrgente = (c: AnyRecord) => c.urgente || c.retiro?.urgente;

// Etapa de cada control, derivada de control_1/control_2 (sin estados nuevos).
//   c1 → todavía no tiene el Control 1 en OK
//   c2 → Control 1 en OK, falta el Control 2
function etapaDe(c: AnyRecord): Etapa {
  return c.control_1 === "ok" ? "c2" : "c1";
}

// Encabezado legible para los grupos por fecha: "Hoy", "Ayer" o la fecha formateada.
// El "hoy/ayer" se compara contra la fecha de Buenos Aires (no la del navegador).
function etiquetaFecha(iso: string): string {
  if (!iso || iso === "Sin fecha") return "Sin fecha";
  if (iso === todayISO()) return "Hoy";
  if (iso === daysAgoISO(1)) return "Ayer";
  const [y, m, d] = iso.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("es-AR", {
    weekday: "long", day: "numeric", month: "long",
  });
}

export function PreanaliticaBandeja({ controles }: { controles: AnyRecord[] }) {
  const [etapa, setEtapa] = useState<Etapa>("c1");
  const [filtro, setFiltro] = useState<Filtro>("fecha");
  // Texto que se está tipeando (qX) vs. término ya aplicado (aplX). Al apretar
  // Enter el término pasa a "aplicado" y la caja se limpia, lista para el
  // siguiente dato. El filtro corre sobre el término aplicado.
  const [qCadete, setQCadete] = useState("");
  const [aplCadete, setAplCadete] = useState("");
  const [qVete, setQVete] = useState("");
  const [aplVete, setAplVete] = useState("");

  // En la bandeja solo se trabajan los pendientes; los observados tienen su
  // propia pantalla. Se reparten en dos solapas según la etapa del control.
  const pendientes = useMemo(() => controles.filter((c) => c.estado === "pendiente"), [controles]);
  const c1Count = useMemo(() => pendientes.filter((c) => etapaDe(c) === "c1").length, [pendientes]);
  const c2Count = useMemo(() => pendientes.filter((c) => etapaDe(c) === "c2").length, [pendientes]);

  // Dos buscadores independientes: uno por cadete y otro por veterinaria, código
  // o etiqueta. Se pueden combinar (ej.: cadete "Emily" + etiqueta "Sin hielo").
  const filtrados = useMemo(() => {
    const qc = aplCadete.trim().toLowerCase();
    const qv = aplVete.trim().toLowerCase();
    const base = pendientes.filter((c) => etapaDe(c) === etapa);
    if (!qc && !qv) return base;
    return base.filter((c) => {
      const r = c.retiro ?? {};
      const okCadete = !qc || String(r.personal?.nombre ?? "").toLowerCase().includes(qc);
      const etiquetas = Array.isArray(c.etiquetas) ? c.etiquetas : [];
      const okVete = !qv || [r.veterinaria_texto_original, r.codigo_original, ...etiquetas]
        .some((v) => String(v ?? "").toLowerCase().includes(qv));
      return okCadete && okVete;
    });
  }, [pendientes, aplCadete, aplVete, etapa]);

  // Lista plana ordenada (para "Todos" y "Urgentes primero").
  const planos = useMemo(() => {
    const arr = [...filtrados];
    if (filtro === "urgentes") {
      arr.sort((a, b) => Number(esUrgente(b)) - Number(esUrgente(a)));
    }
    return arr;
  }, [filtrados, filtro]);

  // Agrupación (para "Por fecha", "Por personal" y "Por veterinaria").
  const grupos = useMemo(() => {
    if (filtro !== "fecha" && filtro !== "personal" && filtro !== "veterinaria") return null;
    const key = (c: AnyRecord) =>
      filtro === "fecha"
        ? c.retiro?.fecha_operativa ?? "Sin fecha"
        : filtro === "personal"
          ? c.retiro?.personal?.nombre ?? "Sin asignar"
          : c.retiro?.veterinaria_texto_original ?? "Sin veterinaria";
    const map = new Map<string, AnyRecord[]>();
    for (const c of filtrados) {
      const k = key(c);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(c);
    }
    const entries = Array.from(map.entries());
    // Por fecha: más reciente primero. Resto: alfabético.
    if (filtro === "fecha") return entries.sort((a, b) => b[0].localeCompare(a[0]));
    return entries.sort((a, b) => a[0].localeCompare(b[0], "es"));
  }, [filtrados, filtro]);

  return (
    <div className="space-y-4">
      {/* Solapas por etapa: primero Control 1, después Control 2 */}
      <div className="flex gap-2">
        {([
          { id: "c1" as Etapa, label: "Control 1", icon: "ti-clipboard-list", count: c1Count },
          { id: "c2" as Etapa, label: "Control 2", icon: "ti-clipboard-check", count: c2Count },
        ]).map((t) => (
          <button key={t.id} onClick={() => setEtapa(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-[10px] border text-[13px] font-semibold transition-all ${etapa === t.id ? "bg-g800 text-white border-g800 shadow-sm" : "bg-white text-gy600 border-gy200 hover:border-g400 hover:text-g700"}`}>
            <i className={`ti ${t.icon} text-[16px]`} />
            {t.label}
            <span className={`text-[11px] font-bold rounded-full px-2 py-0.5 ${etapa === t.id ? "bg-white/20 text-white" : "bg-gy100 text-gy600"}`}>{t.count}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[170px] max-w-[260px]">
          <i className="ti ti-user absolute left-3 top-1/2 -translate-y-1/2 text-gy400 text-[14px]" />
          <input
            type="text"
            value={qCadete}
            onChange={(e) => setQCadete(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setAplCadete(qCadete); setQCadete(""); } }}
            placeholder="Buscar por cadete…"
            className="w-full pl-8 pr-3 py-1.5 border-2 border-gy200 rounded-[8px] text-[12px] bg-gy50 focus:outline-none focus:border-g500 focus:bg-white"
          />
        </div>
        <div className="relative flex-1 min-w-[170px] max-w-[260px]">
          <i className="ti ti-building-store absolute left-3 top-1/2 -translate-y-1/2 text-gy400 text-[14px]" />
          <input
            type="text"
            value={qVete}
            onChange={(e) => setQVete(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setAplVete(qVete); setQVete(""); } }}
            placeholder="Veterinaria, código o etiqueta…"
            className="w-full pl-8 pr-3 py-1.5 border-2 border-gy200 rounded-[8px] text-[12px] bg-gy50 focus:outline-none focus:border-g500 focus:bg-white"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {FILTROS.map((f) => (
            <button key={f.id} onClick={() => setFiltro(f.id)}
              className={`px-3 py-1.5 rounded-full border text-[11px] transition-all ${filtro === f.id ? "bg-g800 text-white border-g800" : "bg-white text-gy600 border-gy200 hover:border-g400 hover:text-g700"}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chips de los términos aplicados: muestran qué se está filtrando y
          permiten quitarlo. La caja queda limpia para el próximo dato. */}
      {(aplCadete.trim() || aplVete.trim()) && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-gy400">Filtrando:</span>
          {aplCadete.trim() && (
            <button onClick={() => setAplCadete("")}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] bg-g50 text-g700 border border-g700/30 hover:bg-g100">
              <i className="ti ti-user text-[11px]" />{aplCadete}
              <i className="ti ti-x text-[11px]" />
            </button>
          )}
          {aplVete.trim() && (
            <button onClick={() => setAplVete("")}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] bg-g50 text-g700 border border-g700/30 hover:bg-g100">
              <i className="ti ti-building-store text-[11px]" />{aplVete}
              <i className="ti ti-x text-[11px]" />
            </button>
          )}
        </div>
      )}

      {!filtrados.length && (
        <div className="py-12 text-center text-gy400">
          {aplCadete.trim() || aplVete.trim() ? "Sin resultados para la búsqueda" : "Sin retiros pendientes de control"}
        </div>
      )}

      {grupos
        ? grupos.map(([nombre, items]) => (
            <div key={nombre} className="space-y-3.5">
              <div className="flex items-center gap-2 pt-1">
                {filtro === "fecha" && <i className="ti ti-calendar text-[13px] text-g600" />}
                <span className="text-[12px] font-semibold text-gy700 capitalize">
                  {filtro === "fecha" ? etiquetaFecha(nombre) : nombre}
                </span>
                <span className="text-[11px] text-gy400">({items.length})</span>
                <div className="flex-1 h-px bg-gy100" />
              </div>
              {items.map((c) => (
                <ControlCard key={c.id} control={c} tipo="pre" etapa={etapa} />
              ))}
            </div>
          ))
        : (
            <div className="space-y-3.5">
              {planos.map((c: AnyRecord) => (
                <ControlCard key={c.id} control={c} tipo="pre" etapa={etapa} />
              ))}
            </div>
          )}
    </div>
  );
}
