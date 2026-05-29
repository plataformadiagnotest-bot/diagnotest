"use client";

import { useMemo, useState } from "react";
import { ControlCard } from "@/components/ui/ControlCard";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

type Filtro = "personal" | "todos" | "urgentes" | "veterinaria";

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "personal", label: "Por personal" },
  { id: "todos", label: "Todos" },
  { id: "urgentes", label: "Urgentes primero" },
  { id: "veterinaria", label: "Por veterinaria" },
];

const esUrgente = (c: AnyRecord) => c.urgente || c.retiro?.urgente;

export function PreanaliticaBandeja({ controles }: { controles: AnyRecord[] }) {
  const [filtro, setFiltro] = useState<Filtro>("personal");

  // Lista plana ordenada (para "Todos" y "Urgentes primero").
  const planos = useMemo(() => {
    const arr = [...controles];
    if (filtro === "urgentes") {
      arr.sort((a, b) => Number(esUrgente(b)) - Number(esUrgente(a)));
    }
    return arr;
  }, [controles, filtro]);

  // Agrupación (para "Por personal" y "Por veterinaria").
  const grupos = useMemo(() => {
    if (filtro !== "personal" && filtro !== "veterinaria") return null;
    const key = (c: AnyRecord) =>
      filtro === "personal"
        ? c.retiro?.personal?.nombre ?? "Sin asignar"
        : c.retiro?.veterinaria_texto_original ?? "Sin veterinaria";
    const map = new Map<string, AnyRecord[]>();
    for (const c of controles) {
      const k = key(c);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(c);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], "es"));
  }, [controles, filtro]);

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 flex-wrap">
        {FILTROS.map((f) => (
          <button key={f.id} onClick={() => setFiltro(f.id)}
            className={`px-3 py-1.5 rounded-full border text-[11px] transition-all ${filtro === f.id ? "bg-g800 text-white border-g800" : "bg-white text-gy600 border-gy200 hover:border-g400 hover:text-g700"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {!controles.length && (
        <div className="py-12 text-center text-gy400">Sin retiros pendientes de control</div>
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
