"use client";

import { useState } from "react";
import { toast } from "@/components/ui/ToastNotification";

export type FilaMuestras = {
  personalId: string;
  nombre: string;
  total: number;
  v1: number | null;
  v2: number | null;
};

// Fila editable: muestras (automático) + Bolsas V1/V2 (carga manual). Guarda en
// el blur de cada input (manda ambos valores actuales de la fila).
function Fila({ fila, dia }: { fila: FilaMuestras; dia: string }) {
  const [v1, setV1] = useState<string>(fila.v1 == null ? "" : String(fila.v1));
  const [v2, setV2] = useState<string>(fila.v2 == null ? "" : String(fila.v2));
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState(false);

  async function guardar() {
    setGuardando(true);
    setOk(false);
    const res = await fetch("/api/preanalitica/bolsas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personalId: fila.personalId, fecha: dia, bolsasV1: v1, bolsasV2: v2 }),
    });
    setGuardando(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      toast("error", j.error ?? "No se pudo guardar");
      return;
    }
    setOk(true);
    setTimeout(() => setOk(false), 1500);
  }

  const inputCls =
    "w-14 px-1.5 py-1 text-center text-[13px] border-2 border-gy200 rounded-[6px] bg-gy50 focus:outline-none focus:border-g500 focus:bg-white";

  return (
    <tr className="border-b border-gy100 last:border-0 hover:bg-gy50">
      <td className="px-4 py-2 text-[13px] font-medium text-gy800">
        {fila.nombre}
        {guardando && <span className="ml-1.5 inline-block w-2.5 h-2.5 border-2 border-gy300 border-t-g600 rounded-full animate-spin align-middle" />}
        {ok && <i className="ti ti-check ml-1.5 text-g600 text-[12px] align-middle" />}
      </td>
      <td className="px-4 py-2 text-center text-[14px] font-bold text-g700">{fila.total}</td>
      <td className="px-2 py-2 text-center">
        <input type="number" min={0} inputMode="numeric" value={v1} placeholder="—"
          onChange={(e) => setV1(e.target.value)} onBlur={guardar} className={inputCls} />
      </td>
      <td className="px-2 py-2 text-center">
        <input type="number" min={0} inputMode="numeric" value={v2} placeholder="—"
          onChange={(e) => setV2(e.target.value)} onBlur={guardar} className={inputCls} />
      </td>
    </tr>
  );
}

export function MuestrasBolsasTabla({
  filas,
  granTotal,
  dia,
}: {
  filas: FilaMuestras[];
  granTotal: number;
  dia: string;
}) {
  return (
    <div className="bg-white rounded-[14px] border border-gy200 shadow-sm overflow-hidden">
      <div className="px-4 py-3.5 border-b border-gy100 flex items-center gap-2">
        <i className="ti ti-test-pipe text-g600" />
        <span className="text-[14px] font-semibold flex-1">Muestras por cadete — hoy</span>
        <span className="text-[11px] text-gy400">Total general:</span>
        <span className="text-[14px] font-bold text-g700">{granTotal}</span>
      </div>
      {filas.length === 0 ? (
        <div className="px-4 py-8 text-center text-[12px] text-gy400">Sin muestras registradas hoy</div>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gy50">
              <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-gy400 border-b border-gy200">Cadete</th>
              <th className="px-4 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-gy400 border-b border-gy200">Muestras</th>
              <th className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-gy400 border-b border-gy200">Bolsas V1</th>
              <th className="px-2 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-gy400 border-b border-gy200">Bolsas V2</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <Fila key={f.personalId} fila={f} dia={dia} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
