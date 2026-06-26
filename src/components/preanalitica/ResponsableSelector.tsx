"use client";

import { useState } from "react";
import { RESPONSABLES_PREANALITICA, RESPONSABLE_REEMPLAZO, esReemplazo } from "@/lib/preanalitica/responsables";

// Lista de nombres para marcar quién hizo el control. Selección única.
// "Reemplazo" habilita un campo de texto para escribir un nombre que no está
// en la lista. El valor que se guarda es el nombre (string) o null.
export function ResponsableSelector({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  // Si el valor guardado no está en la lista fija, es un "Reemplazo".
  const guardadoEsReemplazo = esReemplazo(value);
  const [modoReemplazo, setModoReemplazo] = useState(guardadoEsReemplazo);
  const [textoReemplazo, setTextoReemplazo] = useState(guardadoEsReemplazo ? (value ?? "") : "");

  const seleccionar = (nombre: string) => {
    if (value === nombre) { onChange(null); return; } // destildar
    setModoReemplazo(false);
    onChange(nombre);
  };

  const activarReemplazo = () => {
    setModoReemplazo(true);
    onChange(textoReemplazo.trim() || null);
  };

  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gy400 mb-1">¿Quién controló?</div>
      <div className="flex flex-wrap gap-1.5">
        {RESPONSABLES_PREANALITICA.map((nombre) => {
          const on = !modoReemplazo && value === nombre;
          return (
            <button key={nombre} type="button" onClick={() => seleccionar(nombre)}
              className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${on ? "bg-g700 text-white border-g700" : "bg-gy50 text-gy600 border-gy200 hover:border-g400 hover:text-g700"}`}>
              {on && <i className="ti ti-check text-[11px] mr-1" />}{nombre}
            </button>
          );
        })}
        <button type="button" onClick={activarReemplazo}
          className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${modoReemplazo ? "bg-g700 text-white border-g700" : "bg-gy50 text-gy600 border-gy200 hover:border-g400 hover:text-g700"}`}>
          {modoReemplazo && <i className="ti ti-check text-[11px] mr-1" />}{RESPONSABLE_REEMPLAZO}
        </button>
      </div>
      {modoReemplazo && (
        <input type="text" value={textoReemplazo}
          onChange={(e) => { setTextoReemplazo(e.target.value); onChange(e.target.value.trim() || null); }}
          placeholder="Nombre del reemplazo…"
          className="mt-1.5 w-full max-w-[260px] px-2.5 py-1.5 border-2 border-gy200 rounded-[6px] text-[12px] bg-gy50 focus:outline-none focus:border-g500" />
      )}
    </div>
  );
}
