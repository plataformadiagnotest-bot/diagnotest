"use client";

import { useMemo, useState } from "react";
import { ControlCard } from "@/components/ui/ControlCard";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

type Filtro = "fecha" | "personal" | "todos" | "urgentes" | "veterinaria" | "observados";

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "fecha", label: "Por fecha" },
  { id: "personal", label: "Por personal" },
  { id: "todos", label: "Todos" },
  { id: "urgentes", label: "Urgentes primero" },
  { id: "veterinaria", label: "Por veterinaria" },
  { id: "observados", label: "Observados" },
];

const esUrgente = (c: AnyRecord) => c.urgente || c.retiro?.urgente;

// Encabezado legible para los grupos por fecha: "Hoy", "Ayer" o la fecha formateada.
function etiquetaFecha(iso: string): string {
  if (!iso || iso === "Sin fecha") return "Sin fecha";
  const hoy = new Date();
  const ayer = new Date();
  ayer.setDate(hoy.getDate() - 1);
  const f = (d: Date) => d.toISOString().split("T")[0];
  if (iso === f(hoy)) return "Hoy";
  if (iso === f(ayer)) return "Ayer";
  const [y, m, d] = iso.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString("es-AR", {
    weekday: "long", day: "numeric", month: "long",
  });
}

export function PreanaliticaBandeja({ controles }: { controles: AnyRecord[] }) {
  const [filtro, setFiltro] = useState<Filtro>("fecha");
  const [qCadete, setQCadete] = useState("");
  const [qVete, setQVete] = useState("");

  const observadosCount = useMemo(() => controles.filter((c) => c.estado === "observado").length, [controles]);

  // Dos buscadores independientes: uno por cadete y otro por veterinaria/código.
  // Se pueden combinar (ej.: cadete "Emily" + veterinaria que trajo).
  const filtrados = useMemo(() => {
    const qc = qCadete.trim().toLowerCase();
    const qv = qVete.trim().toLowerCase();
    let base = controles;
    if (filtro === "observados") base = base.filter((c) => c.estado === "observado");
    if (!qc && !qv) return base;
    return base.filter((c) => {
      const r = c.retiro ?? {};
      const okCadete = !qc || String(r.personal?.nombre ?? "").toLowerCase().includes(qc);
      const okVete = !qv || [r.veterinaria_texto_original, r.codigo_original]
        .some((v) => String(v ?? "").toLowerCase().includes(qv));
      return okCadete && okVete;
    });
  }, [controles, qCadete, qVete, filtro]);

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
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[170px] max-w-[260px]">
          <i className="ti ti-user absolute left-3 top-1/2 -translate-y-1/2 text-gy400 text-[14px]" />
          <input
            type="text"
            value={qCadete}
            onChange={(e) => setQCadete(e.target.value)}
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
            placeholder="Buscar por veterinaria o código…"
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
          {qCadete.trim() || qVete.trim() ? "Sin resultados para la búsqueda" : "Sin retiros pendientes de control"}
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
