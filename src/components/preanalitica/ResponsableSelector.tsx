"use client";

import { useState } from "react";
import { RESPONSABLES_PREANALITICA, RESPONSABLE_REEMPLAZO } from "@/lib/preanalitica/responsables";

const FIJOS = RESPONSABLES_PREANALITICA as readonly string[];

// Parsea el valor guardado (nombres separados por coma) a una lista.
function parse(value: string | null): string[] {
  return (value ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

// Lista de nombres para marcar quién hizo el control. Permite marcar VARIAS
// personas. "Reemplazo" habilita un campo de texto para sumar un nombre que no
// está en la lista. El valor guardado es la lista de nombres separada por coma.
export function ResponsableSelector({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const seleccionados = parse(value);
  const fijosSel = seleccionados.filter((s) => FIJOS.includes(s));
  const reemplazoGuardado = seleccionados.find((s) => !FIJOS.includes(s)) ?? "";

  const [modoReemplazo, setModoReemplazo] = useState(reemplazoGuardado !== "");
  const [textoReemplazo, setTextoReemplazo] = useState(reemplazoGuardado);

  // Reconstruye el valor a partir de los nombres fijos marcados + el reemplazo.
  const emitir = (fijos: string[], reemplazo: string) => {
    const lista = [...fijos, reemplazo.trim()].filter(Boolean);
    onChange(lista.length ? lista.join(", ") : null);
  };

  const toggleFijo = (nombre: string) => {
    const nuevos = fijosSel.includes(nombre)
      ? fijosSel.filter((x) => x !== nombre)
      : [...fijosSel, nombre];
    emitir(nuevos, modoReemplazo ? textoReemplazo : "");
  };

  const toggleReemplazo = () => {
    const activar = !modoReemplazo;
    setModoReemplazo(activar);
    emitir(fijosSel, activar ? textoReemplazo : "");
  };

  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gy400 mb-1">
        ¿Quién controló? <span className="normal-case tracking-normal text-gy400 font-normal">(podés marcar más de uno)</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {FIJOS.map((nombre) => {
          const on = fijosSel.includes(nombre);
          return (
            <button key={nombre} type="button" onClick={() => toggleFijo(nombre)}
              className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${on ? "bg-g700 text-white border-g700" : "bg-gy50 text-gy600 border-gy200 hover:border-g400 hover:text-g700"}`}>
              {on && <i className="ti ti-check text-[11px] mr-1" />}{nombre}
            </button>
          );
        })}
        <button type="button" onClick={toggleReemplazo}
          className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${modoReemplazo ? "bg-g700 text-white border-g700" : "bg-gy50 text-gy600 border-gy200 hover:border-g400 hover:text-g700"}`}>
          {modoReemplazo && <i className="ti ti-check text-[11px] mr-1" />}{RESPONSABLE_REEMPLAZO}
        </button>
      </div>
      {modoReemplazo && (
        <input type="text" value={textoReemplazo}
          onChange={(e) => { setTextoReemplazo(e.target.value); emitir(fijosSel, e.target.value); }}
          placeholder="Nombre del reemplazo…"
          className="mt-1.5 w-full max-w-[260px] px-2.5 py-1.5 border-2 border-gy200 rounded-[6px] text-[12px] bg-gy50 focus:outline-none focus:border-g500" />
      )}
    </div>
  );
}
