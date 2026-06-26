"use client";

import { useMemo, useState } from "react";
import { ControlCard } from "@/components/ui/ControlCard";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

// Lista de Observados con buscador por cadete y por veterinaria/código/etiqueta.
// Igual que la bandeja: al apretar Enter el término se aplica y la caja se
// limpia para el próximo dato; un chip muestra qué se está filtrando.
export function ObservadosList({ controles }: { controles: AnyRecord[] }) {
  const [qCadete, setQCadete] = useState("");
  const [aplCadete, setAplCadete] = useState("");
  const [qVete, setQVete] = useState("");
  const [aplVete, setAplVete] = useState("");

  const filtrados = useMemo(() => {
    const qc = aplCadete.trim().toLowerCase();
    const qv = aplVete.trim().toLowerCase();
    if (!qc && !qv) return controles;
    return controles.filter((c) => {
      const r = c.retiro ?? {};
      const okCadete = !qc || String(r.personal?.nombre ?? "").toLowerCase().includes(qc);
      const etiquetas = Array.isArray(c.etiquetas) ? c.etiquetas : [];
      const okVete = !qv || [r.veterinaria_texto_original, r.codigo_original, ...etiquetas]
        .some((v: unknown) => String(v ?? "").toLowerCase().includes(qv));
      return okCadete && okVete;
    });
  }, [controles, aplCadete, aplVete]);

  return (
    <div className="space-y-4">
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
      </div>

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

      {!filtrados.length ? (
        <div className="bg-white rounded-[14px] border border-gy200 shadow-sm py-12 text-center text-gy400 text-[13px]">
          {aplCadete.trim() || aplVete.trim() ? "Sin resultados para la búsqueda" : "Sin registros observados"}
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
