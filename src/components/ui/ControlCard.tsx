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

// Medio de pago lo define logística al cargar el retiro; cobranzas solo lo ve.
const METODO_PAGO_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  mercado_pago: "Mercado Pago",
  mercadopago: "Mercado Pago",
};

export function ControlCard({ control, tipo }: Props) {
  const router = useRouter();
  const retiro = control.retiro as AnyRecord;
  const personal = retiro?.personal as AnyRecord;
  const isUrgente = control.urgente || retiro?.urgente;

  const [ctrl1, setCtrl1] = useState(control.control_1 ?? "");
  const [ctrl2, setCtrl2] = useState(control.control_2 ?? "");
  const [estado, setEstado] = useState(control.estado ?? "pendiente");
  const [detalle, setDetalle] = useState(control.detalle ?? "");
  const [etiquetas, setEtiquetas] = useState<string[]>(control.etiquetas ?? []);
  const [importeValidado, setImporteValidado] = useState(control.importe_validado ?? retiro?.importe_declarado ?? "");
  const [saving, setSaving] = useState(false);

  // Datos de preanalítica (control 1:1 vía retiro) — solo lectura para cobranzas.
  const pre = (Array.isArray(retiro?.control_preanalitica) ? retiro?.control_preanalitica[0] : retiro?.control_preanalitica) as AnyRecord | undefined;
  const preEtiquetas: string[] = pre?.etiquetas ?? [];
  const preDetalle: string = pre?.detalle ?? "";

  // Código de veterinaria editable (preanalítica / cobranzas / super admin).
  const [codigo, setCodigo] = useState(retiro?.codigo_original ?? "");
  const [vetNombre, setVetNombre] = useState(retiro?.veterinaria_texto_original ?? "");
  const [match, setMatch] = useState<null | boolean>(null);
  const [savingCodigo, setSavingCodigo] = useState(false);

  const toggleEtiqueta = (e: string) =>
    setEtiquetas((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]));

  async function guardarCodigo() {
    const nuevo = codigo.trim();
    if (nuevo === (retiro?.codigo_original ?? "").trim()) return; // sin cambios
    setSavingCodigo(true);
    const res = await fetch("/api/retiros/codigo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ retiroId: retiro?.id, codigo: nuevo }),
    });
    const json = await res.json();
    setSavingCodigo(false);
    if (!res.ok) { toast("error", json.error ?? "No se pudo guardar el código"); return; }
    setMatch(json.matched);
    if (json.matched && json.veterinaria) {
      setVetNombre(json.veterinaria.nombre);
      toast("success", `Código vinculado a ${json.veterinaria.nombre}`);
    } else {
      toast("success", "Código guardado (sin coincidencia en el maestro)");
    }
  }

  async function save(newEstado: string) {
    setSaving(true);
    const supabase = createClient();
    const table = tipo === "pre" ? "control_preanalitica" : "control_cobranzas";
    const updateData: Record<string, unknown> = {
      estado: newEstado,
      detalle: detalle || null,
    };

    if (tipo === "pre") {
      updateData.control_1 = ctrl1;
      updateData.control_2 = ctrl2;
      updateData.etiquetas = etiquetas;
    } else {
      updateData.importe_validado = parseFloat(String(importeValidado)) || 0;
      updateData.diferencia = (parseFloat(String(importeValidado)) || 0) - (Number(retiro?.importe_declarado) || 0);
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
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] uppercase tracking-wide text-gy400 font-semibold">Código</span>
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            onBlur={guardarCodigo}
            disabled={savingCodigo}
            placeholder="—"
            className="w-24 px-2 py-1 font-mono text-[12px] font-medium text-gy700 bg-white border border-gy200 rounded-[6px] focus:outline-none focus:border-g500 disabled:opacity-50"
          />
        </div>
        <span className="text-[14px] font-semibold text-gy900 flex-1">{vetNombre || "—"}</span>
        {match === true && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-g700 bg-g50 border border-g200 rounded-full px-2 py-0.5">
            <i className="ti ti-check" /> Vinculada
          </span>
        )}
        {match === false && (
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-text bg-amber-bg border border-amber/40 rounded-full px-2 py-0.5">
            <i className="ti ti-alert-triangle" /> Sin coincidencia
          </span>
        )}
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

        {/* Controls preanalítica: control 1 / control 2 / estado */}
        {tipo === "pre" && (
          <div className="grid grid-cols-3 gap-2.5 mb-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gy400 mb-1">Control 1</div>
              <select className="w-full px-2.5 py-1.5 border-2 border-gy200 rounded-[6px] text-[12px] bg-gy50 focus:outline-none focus:border-g500"
                value={ctrl1} onChange={(e) => setCtrl1(e.target.value)}>
                <option value="">— Seleccionar —</option>
                <option value="ok">OK</option>
                <option value="observar">Observar</option>
                <option value="rechazar">Rechazar</option>
              </select>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gy400 mb-1">Control 2</div>
              <select className="w-full px-2.5 py-1.5 border-2 border-gy200 rounded-[6px] text-[12px] bg-gy50 focus:outline-none focus:border-g500"
                value={ctrl2} onChange={(e) => setCtrl2(e.target.value)}>
                <option value="">— Seleccionar —</option>
                <option value="ok">OK</option>
                <option value="observar">Observar</option>
                <option value="rechazar">Rechazar</option>
              </select>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gy400 mb-1">Estado</div>
              <select className="w-full px-2.5 py-1.5 border-2 border-gy200 rounded-[6px] text-[12px] bg-gy50 focus:outline-none focus:border-g500"
                value={estado} onChange={(e) => setEstado(e.target.value)}>
                <option value="pendiente">Pendiente</option>
                <option value="ok">Controlado OK</option>
                <option value="observado">Observado</option>
                <option value="rechazado">Rechazado</option>
              </select>
            </div>
          </div>
        )}

        {/* Controls (solo cobranzas) */}
        {tipo === "cob" && (
          <>
            {(preEtiquetas.length > 0 || preDetalle) && (
              <div className="mb-3 rounded-[8px] border border-gy200 bg-gy50 px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <i className="ti ti-clipboard-check text-[13px] text-g600" />
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-gy500">Aclaraciones de preanalítica</span>
                </div>
                {preEtiquetas.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                    {preEtiquetas.map((e) => (
                      <span key={e} className="px-2 py-0.5 rounded-full text-[11px] bg-white text-g700 border border-g200">{e}</span>
                    ))}
                  </div>
                )}
                {preDetalle && <div className="text-[12px] text-gy700">{preDetalle}</div>}
              </div>
            )}

            <div className="grid grid-cols-3 gap-2.5 mb-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-gy400 mb-1">Importe validado</div>
                <input type="number" step="0.01"
                  className="w-full px-2.5 py-1.5 border-2 border-gy200 rounded-[6px] text-[12px] bg-gy50 focus:outline-none focus:border-g500"
                  value={importeValidado} onChange={(e) => setImporteValidado(e.target.value)} />
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-gy400 mb-1">Medio de pago</div>
                <div className="w-full px-2.5 py-1.5 border-2 border-gy100 rounded-[6px] text-[12px] bg-gy50 text-gy600 capitalize">
                  {METODO_PAGO_LABEL[retiro?.metodo_pago as string] ?? "—"}
                </div>
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
          </>
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
