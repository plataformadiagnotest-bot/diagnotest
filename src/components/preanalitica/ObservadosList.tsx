"use client";

import { useMemo, useState } from "react";
import { ControlCard } from "@/components/ui/ControlCard";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

// Lista de Observados con buscador por cadete y por veterinaria/código/etiqueta.
// Los dos filtros son acumulativos (se combinan) y filtran en vivo; el texto
// queda siempre visible para no "perder" un filtro al usar el otro.
export function ObservadosList({ controles }: { controles: AnyRecord[] }) {
  const [qCadete, setQCadete] = useState("");
  const [qVete, setQVete] = useState("");

  const filtrados = useMemo(() => {
    const qc = qCadete.trim().toLowerCase();
    const qv = qVete.trim().toLowerCase();
    if (!qc && !qv) return controles;
    return controles.filter((c) => {
      const r = c.retiro ?? {};
      const okCadete = !qc || String(r.personal?.nombre ?? "").toLowerCase().includes(qc);
      const etiquetas = Array.isArray(c.etiquetas) ? c.etiquetas : [];
      const okVete = !qv || [r.veterinaria_texto_original, r.codigo_original, ...etiquetas]
        .some((v: unknown) => String(v ?? "").toLowerCase().includes(qv));
      return okCadete && okVete;
    });
  }, [controles, qCadete, qVete]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[170px] max-w-[260px]">
          <i className="ti ti-user absolute left-3 top-1/2 -translate-y-1/2 text-gy400 text-[14px]" />
          <input
            type="text"
            value={qCadete}
            onChange={(e) => setQCadete(e.target.value)}
            placeholder="Filtrar por cadete…"
            className="w-full pl-8 pr-8 py-1.5 border-2 border-gy200 rounded-[8px] text-[12px] bg-gy50 focus:outline-none focus:border-g500 focus:bg-white"
          />
          {qCadete && (
            <button type="button" onClick={() => setQCadete("")} title="Limpiar"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gy400 hover:text-gy700">
              <i className="ti ti-x text-[13px]" />
            </button>
          )}
        </div>
        <div className="relative flex-1 min-w-[170px] max-w-[260px]">
          <i className="ti ti-building-store absolute left-3 top-1/2 -translate-y-1/2 text-gy400 text-[14px]" />
          <input
            type="text"
            value={qVete}
            onChange={(e) => setQVete(e.target.value)}
            placeholder="Veterinaria, código o etiqueta…"
            className="w-full pl-8 pr-8 py-1.5 border-2 border-gy200 rounded-[8px] text-[12px] bg-gy50 focus:outline-none focus:border-g500 focus:bg-white"
          />
          {qVete && (
            <button type="button" onClick={() => setQVete("")} title="Limpiar"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gy400 hover:text-gy700">
              <i className="ti ti-x text-[13px]" />
            </button>
          )}
        </div>
      </div>

      {(qCadete.trim() || qVete.trim()) && (
        <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
          <span className="text-gy400">Filtrando</span>
          {qCadete.trim() && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-g50 text-g700 border border-g700/30">
              <i className="ti ti-user text-[11px]" />{qCadete.trim()}
            </span>
          )}
          {qCadete.trim() && qVete.trim() && <span className="text-gy400">+</span>}
          {qVete.trim() && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-g50 text-g700 border border-g700/30">
              <i className="ti ti-building-store text-[11px]" />{qVete.trim()}
            </span>
          )}
          <button onClick={() => { setQCadete(""); setQVete(""); }}
            className="ml-1 text-gy500 hover:text-gy800 underline">Limpiar todo</button>
        </div>
      )}

      {!filtrados.length ? (
        <div className="bg-white rounded-[14px] border border-gy200 shadow-sm py-12 text-center text-gy400 text-[13px]">
          {qCadete.trim() || qVete.trim() ? "Sin resultados para la búsqueda" : "Sin registros observados"}
        </div>
      ) : (
        <div className="space-y-3.5">
          {filtrados.map((c) => (
            <ControlCard key={c.id} control={c} tipo="pre" />
          ))}
        </div>
      )}
    </div>
  );
}
