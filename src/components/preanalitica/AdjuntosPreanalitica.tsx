"use client";

import { useState } from "react";

// Ícono "ver adjuntos" para una fila de controlados. Muestra únicamente las
// fotos cargadas por preanalítica (no los tickets de logística).
// - Con adjuntos: ícono en color (verde).
// - Sin adjuntos: ícono en gris clarito.
export function AdjuntosPreanalitica({ fotos }: { fotos: string[] }) {
  const [open, setOpen] = useState(false);
  const lista = (fotos ?? []).filter(Boolean);

  if (lista.length === 0) {
    return (
      <span
        title="Sin adjuntos de preanalítica"
        className="inline-flex items-center justify-center w-7 h-7 rounded-[6px] text-gy200"
      >
        <i className="ti ti-paperclip text-[16px]" />
      </span>
    );
  }

  if (lista.length === 1) {
    return (
      <a
        href={lista[0]}
        target="_blank"
        rel="noopener noreferrer"
        title="Ver adjunto"
        className="inline-flex items-center justify-center w-7 h-7 rounded-[6px] text-g700 bg-g50 border border-g200 hover:bg-g100"
      >
        <i className="ti ti-paperclip text-[16px]" />
      </a>
    );
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        title={`Ver ${lista.length} adjuntos`}
        className="inline-flex items-center justify-center gap-0.5 h-7 px-1.5 rounded-[6px] text-g700 bg-g50 border border-g200 hover:bg-g100"
      >
        <i className="ti ti-paperclip text-[16px]" />
        <span className="text-[10px] font-bold">{lista.length}</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-1 bg-white border border-gy200 rounded-[8px] shadow-lg p-1 min-w-[120px]">
            {lista.map((u, i) => (
              <a
                key={u}
                href={u}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-[6px] text-[11px] text-gy700 hover:bg-gy50"
              >
                <i className="ti ti-photo text-[12px] text-g600" /> Foto {i + 1}
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
