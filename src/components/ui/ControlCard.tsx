"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/ToastNotification";
import { PillStatus } from "@/components/ui/PillStatus";
import { fmtMoneySign } from "@/lib/utils/format";
import { formatDateTime } from "@/lib/utils/dates";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

interface Props {
  control: AnyRecord;
  tipo: "pre" | "cob";
}

// Etiquetas que preanalítica puede marcar al controlar una muestra.
const ETIQUETAS_PRE = [
  "Tiene citología",
  "Tiene AMF",
  "Tiene cross match",
  "Tiene VITEK",
  "Tiene histopatología",
  "Tiene progesterona",
  "Urgente",
  "Es del mismo paciente",
  "Plata en bolsa",
  "Es de otro código",
  "DT de domicilio",
  "Autovacuna",
  "Hemocultivo",
  "Anula",
  "Sin orden",
  "Muestra volcada",
] as const;

export function ControlCard({ control, tipo }: Props) {
  const router = useRouter();
  const retiro = control.retiro as AnyRecord;
  const personal = retiro?.personal as AnyRecord;
  const isUrgente = control.urgente || retiro?.urgente;

  const [estado, setEstado] = useState(control.estado ?? "pendiente");
  const [detalle, setDetalle] = useState(control.detalle ?? "");
  const [etiquetas, setEtiquetas] = useState<string[]>(control.etiquetas ?? []);
  const [importeValidado, setImporteValidado] = useState(control.importe_validado ?? retiro?.importe_declarado ?? "");
  const [medioPago, setMedioPago] = useState(control.medio_pago ?? "efectivo");
  const [saving, setSaving] = useState(false);

  const toggleEtiqueta = (e: string) =>
    setEtiquetas((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]));

  async function save(newEstado: string) {
    setSaving(true);
    const supabase = createClient();
    const table = tipo === "pre" ? "control_preanalitica" : "control_cobranzas";
    const updateData: Record<string, unknown> = {
      estado: newEstado,
      detalle: detalle || null,
    };

    if (tipo === "pre") {
      updateData.etiquetas = etiquetas;
    } else {
      updateData.importe_validado = parseFloat(String(importeValidado)) || 0;
      updateData.diferencia = (parseFloat(String(importeValidado)) || 0) - (Number(retiro?.importe_declarado) || 0);
      updateData.medio_pago = medioPago;
    }

    const { error } = await supabase.from(table).update(updateData).eq("id", control.id);
    if (error) { toast("error", "Error al guardar"); setSaving(false); return; }
    toast("success", tipo === "pre" ? "Control guardado ✓" : "Cobranza guardada ✓");
    router.refresh();
    setSaving(false);
  }

  return (
    <div className={`bg-white rounded-[14px] border border-gy200 shadow-sm overflow-hidden hover:shadow-md transition-shadow ${isUrgente ? "border-l-4 border-l-red-500" : ""}`}>
      {/* Header */}
      <div className="px-4 py-3 bg-gy50 border-b border-gy100 flex items-center gap-2.5 flex-wrap">
        <span className="font-mono text-[12px] font-medium text-gy600">{retiro?.id?.slice(0, 8).toUpperCase()}</span>
        <span className="text-[14px] font-semibold text-gy900 flex-1">{retiro?.veterinaria_texto_original ?? "—"}</span>
        {retiro?.codigo_original && <span className="font-mono text-[11px] text-gy400">{retiro.codigo_original}</span>}
        <span className="text-[11px] text-gy400">{personal?.nombre ?? "—"} · {retiro?.fecha_operativa ? formatDateTime(retiro.timestamp_carga) : ""}</span>
        {retiro?.comprobante_url && (
          <a href={retiro.comprobante_url} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-g700 hover:text-g800 hover:underline">
            <i className="ti ti-photo text-[13px]" /> Ver ticket
          </a>
        )}
        {isUrgente && <PillStatus variant="urgente" />}
      </div>

      {/* Body */}
      <div className="px-4 py-4">
        <div className="flex gap-5 mb-4 flex-wrap">
          <div>
            <div className="text-[9px] uppercase tracking-wide text-gy400 font-semibold mb-0.5">
              {tipo === "pre" ? "Muestras" : "Importe decl."}
            </div>
            <div className="text-[22px] font-bold text-g700">
              {tipo === "pre" ? retiro?.cantidad_muestras : fmtMoneySign(retiro?.importe_declarado ?? 0)}
            </div>
          </div>
          {retiro?.comentarios && (
            <div className="flex-1">
              <div className="text-[9px] uppercase tracking-wide text-gy400 font-semibold mb-0.5">Comentarios</div>
              <div className="text-[12px] text-gy600">{retiro.comentarios}</div>
            </div>
          )}
        </div>

        {/* Controls (solo cobranzas) */}
        {tipo === "cob" && (
          <div className="grid grid-cols-3 gap-2.5 mb-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gy400 mb-1">Importe validado</div>
              <input type="number" step="0.01"
                className="w-full px-2.5 py-1.5 border-2 border-gy200 rounded-[6px] text-[12px] bg-gy50 focus:outline-none focus:border-g500"
                value={importeValidado} onChange={(e) => setImporteValidado(e.target.value)} />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gy400 mb-1">Medio de pago</div>
              <select className="w-full px-2.5 py-1.5 border-2 border-gy200 rounded-[6px] text-[12px] bg-gy50 focus:outline-none focus:border-g500"
                value={medioPago} onChange={(e) => setMedioPago(e.target.value)}>
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="mercadopago">Mercado Pago</option>
              </select>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gy400 mb-1">Estado</div>
              <select className="w-full px-2.5 py-1.5 border-2 border-gy200 rounded-[6px] text-[12px] bg-gy50 focus:outline-none focus:border-g500"
                value={estado} onChange={(e) => setEstado(e.target.value)}>
                <option value="pendiente">Pendiente</option>
                <option value="adjudicado">Adjudicado</option>
                <option value="diferencia">Diferencia</option>
                <option value="no_corresponde">No corresponde</option>
              </select>
            </div>
          </div>
        )}

        {tipo === "pre" && (
          <div className="mb-3">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-gy400 mb-1.5">Etiquetas</div>
            <div className="flex flex-wrap gap-1.5">
              {ETIQUETAS_PRE.map((e) => {
                const on = etiquetas.includes(e);
                return (
                  <button key={e} type="button" onClick={() => toggleEtiqueta(e)}
                    className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${on ? "bg-g700 text-white border-g700" : "bg-gy50 text-gy600 border-gy200 hover:border-g400 hover:text-g700"}`}>
                    {on && <i className="ti ti-check text-[11px] mr-1" />}{e}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mb-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-gy400 mb-1">Detalle / Observación</div>
          <input type="text"
            className="w-full px-2.5 py-1.5 border-2 border-gy200 rounded-[6px] text-[12px] bg-gy50 focus:outline-none focus:border-g500"
            placeholder={tipo === "pre" ? "Describir si hay observación..." : "Observaciones de cobranza..."}
            value={detalle} onChange={(e) => setDetalle(e.target.value)} />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => save(tipo === "pre" ? "ok" : "adjudicado")} disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium bg-g50 text-g700 border border-g200 rounded-[6px] hover:bg-g100 disabled:opacity-50">
            <i className="ti ti-check text-[13px]" />
            {tipo === "pre" ? "Controlado OK" : "Adjudicado OK"}
          </button>
          <button onClick={() => save("observado")} disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium bg-amber-bg text-amber-text border border-amber/40 rounded-[6px] hover:bg-amber/10 disabled:opacity-50">
            <i className="ti ti-eye text-[13px]" /> Observar
          </button>
          <button onClick={() => save(tipo === "pre" ? "rechazado" : "diferencia")} disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium bg-red-50 text-red-700 border border-red-200 rounded-[6px] hover:bg-red-100 disabled:opacity-50">
            <i className="ti ti-x text-[13px]" />
            {tipo === "pre" ? "Rechazar" : "Diferencia"}
          </button>
          <span className="ml-auto text-[10px] text-gy400">
            {new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>
    </div>
  );
}
