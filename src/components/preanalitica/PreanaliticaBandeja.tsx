"use client";

import { useMemo, useState } from "react";
import { ControlCard } from "@/components/ui/ControlCard";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

type Filtro = "personal" | "todos" | "urgentes" | "veterinaria" | "observados";

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "personal", label: "Por personal" },
  { id: "todos", label: "Todos" },
  { id: "urgentes", label: "Urgentes primero" },
  { id: "veterinaria", label: "Por veterinaria" },
  { id: "observados", label: "Observados" },
];

const esUrgente = (c: AnyRecord) => c.urgente || c.retiro?.urgente;

export function PreanaliticaBandeja({ controles }: { controles: AnyRecord[] }) {
  const [filtro, setFiltro] = useState<Filtro>("personal");
  const [busqueda, setBusqueda] = useState("");

  const observadosCount = useMemo(() => controles.filter((c) => c.estado === "observado").length, [controles]);

  // Filtra por texto en cadete / veterinaria / código (y por estado observado).
  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    let base = controles;
    if (filtro === "observados") base = base.filter((c) => c.estado === "observado");
    if (!q) return base;
    return base.filter((c) => {
      const r = c.retiro ?? {};
      return [r.personal?.nombre, r.veterinaria_texto_original, r.codigo_original]
        .some((v) => String(v ?? "").toLowerCase().includes(q));
    });
  }, [controles, busqueda, filtro]);

  // Lista plana ordenada (para "Todos" y "Urgentes primero").
  const planos = useMemo(() => {
    const arr = [...filtrados];
    if (filtro === "urgentes") {
      arr.sort((a, b) => Number(esUrgente(b)) - Number(esUrgente(a)));
    }
    return arr;
  }, [filtrados, filtro]);

  // Agrupación (para "Por personal" y "Por veterinaria").
  const grupos = useMemo(() => {
    if (filtro !== "personal" && filtro !== "veterinaria") return null;
    const key = (c: AnyRecord) =>
      filtro === "personal"
        ? c.retiro?.personal?.nombre ?? "Sin asignar"
        : c.retiro?.veterinaria_texto_original ?? "Sin veterinaria";
    const map = new Map<string, AnyRecord[]>();
    for (const c of filtrados) {
      const k = key(c);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(c);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], "es"));
  }, [filtrados, filtro]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-[360px]">
          <i className="ti ti-search absolute left-3 top-1/2 -translate-y-1/2 text-gy400 text-[14px]" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por cadete, veterinaria o código…"
            className="w-full pl-8 pr-3 py-1.5 border-2 border-gy200 rounded-[8px] text-[12px] bg-gy50 focus:outline-none focus:border-g500 focus:bg-white"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {FILTROS.map((f) => (
            <button key={f.id} onClick={() => setFiltro(f.id)}
              className={`px-3 py-1.5 rounded-full border text-[11px] transition-all ${filtro === f.id ? "bg-g800 text-white border-g800" : "bg-white text-gy600 border-gy200 hover:border-g400 hover:text-g700"}`}>
              {f.label}
              {f.id === "observados" && observadosCount > 0 && (
                <span className={`ml-1.5 text-[9px] font-bold rounded-full px-1.5 py-0.5 ${filtro === f.id ? "bg-white/20 text-white" : "bg-amber-bg text-amber-text"}`}>{observadosCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {!filtrados.length && (
        <div className="py-12 text-center text-gy400">
          {busqueda.trim() ? "Sin resultados para la búsqueda" : "Sin retiros pendientes de control"}
        </div>
      )}

      {grupos
        ? grupos.map(([nombre, items]) => (
            <div key={nombre} className="space-y-3.5">
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[12px] font-semibold text-gy700">{nombre}</span>
                <span className="text-[11px] text-gy400">({items.length})</span>
                <div className="flex-1 h-px bg-gy100" />
              </div>
              {items.map((c) => (
                <ControlCard key={c.id} control={c} tipo="pre" />
              ))}
            </div>
          ))
        : (
            <div className="space-y-3.5">
              {planos.map((c: AnyRecord) => (
                <ControlCard key={c.id} control={c} tipo="pre" />
              ))}
            </div>
          )}
    </div>
  );
}
