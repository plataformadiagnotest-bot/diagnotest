"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/ToastNotification";
import { fmtMoneySign } from "@/lib/utils/format";

interface Props {
  controlId: string;
  declarado: number;
  validado: number;
  detalle: string | null;
  veterinaria: string | null;
  personal: string | null;
}

export function RevisarDiferencia({ controlId, declarado, validado, detalle, veterinaria, personal }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [importe, setImporte] = useState(String(validado ?? declarado ?? ""));
  const [obs, setObs] = useState(detalle ?? "");
  const [saving, setSaving] = useState(false);

  const valNum = parseFloat(importe) || 0;
  const diff = valNum - (declarado ?? 0);
  const diffInicial = (validado ?? 0) - (declarado ?? 0);

  async function resolver(nuevoEstado: "adjudicado" | "no_corresponde" | "diferencia") {
    setSaving(true);
    const res = await fetch("/api/cobranzas/validar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        controlId,
        estado: nuevoEstado,
        importeValidado: valNum,
        detalle: obs || null,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { toast("error", json.error ?? "No se pudo guardar"); return; }
    toast("success",
      nuevoEstado === "adjudicado" ? "Diferencia adjudicada ✓"
        : nuevoEstado === "no_corresponde" ? "Marcada como no corresponde"
          : "Cambios guardados");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className={`flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-[6px] border ${diffInicial < 0 ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100" : "bg-g50 text-g700 border-g200 hover:bg-g100"}`}>
        Revisar
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-[16px] shadow-xl w-full max-w-[460px] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gy100 flex items-center gap-2">
              <i className="ti ti-scale text-g600" />
              <span className="text-[15px] font-semibold flex-1">Revisar diferencia</span>
              <button onClick={() => setOpen(false)} className="text-gy400 hover:text-gy600"><i className="ti ti-x text-[18px]" /></button>
            </div>

            <div className="px-5 py-4 space-y-3.5">
              <div className="text-[12px] text-gy600">
                <span className="font-semibold text-gy900">{veterinaria ?? "—"}</span>
                {personal && <> · {personal}</>}
              </div>

              <div className="flex gap-4">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-gy400 font-semibold mb-0.5">Declarado</div>
                  <div className="text-[18px] font-bold text-gy900">{fmtMoneySign(declarado ?? 0)}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-gy400 font-semibold mb-0.5">Diferencia</div>
                  <div className={`text-[18px] font-bold ${diff < 0 ? "text-red-600" : diff > 0 ? "text-g700" : "text-gy500"}`}>
                    {diff >= 0 ? "+" : ""}{fmtMoneySign(diff)}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gy600 mb-1.5">Importe validado</label>
                <input type="number" step="0.01" value={importe} onChange={(e) => setImporte(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gy200 rounded-[8px] text-[13px] bg-gy50 focus:outline-none focus:border-g500 focus:bg-white" />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gy600 mb-1.5">Observación</label>
                <input type="text" value={obs} onChange={(e) => setObs(e.target.value)}
                  placeholder="Motivo o resolución de la diferencia…"
                  className="w-full px-3 py-2 border-2 border-gy200 rounded-[8px] text-[13px] bg-gy50 focus:outline-none focus:border-g500 focus:bg-white" />
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button onClick={() => resolver("adjudicado")} disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium bg-g800 text-white rounded-[8px] hover:bg-g700 disabled:opacity-50">
                  <i className="ti ti-check" /> Adjudicar
                </button>
                <button onClick={() => resolver("no_corresponde")} disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium bg-white border border-gy200 text-gy700 rounded-[8px] hover:bg-gy50 disabled:opacity-50">
                  <i className="ti ti-ban" /> No corresponde
                </button>
                <button onClick={() => resolver("diferencia")} disabled={saving}
                  className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium bg-white border border-gy200 text-gy700 rounded-[8px] hover:bg-gy50 disabled:opacity-50">
                  <i className="ti ti-device-floppy" /> Guardar cambios
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
