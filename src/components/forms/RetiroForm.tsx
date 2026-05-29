"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useOffline } from "@/lib/hooks/useOffline";
import { saveRetiroOffline, addToSyncQueue } from "@/lib/offline/indexeddb";
import { toast } from "@/components/ui/ToastNotification";
import { todayISO, nowISO } from "@/lib/utils/dates";
import type { TipoRetiro, MetodoPago } from "@/types";

interface VetOption { id: string; codigo: string; nombre: string; zona_id: string | null }
interface PersonalOption { id: string; nombre: string; tipo: string }

interface Props {
  personalId?: string;
  pedidoId?: string;
  prefill?: {
    veterinaria_id?: string;
    veterinaria_texto?: string;
    urgente?: boolean;
    detalle?: string;
  };
  onSaved?: () => void;
}

export function RetiroForm({ personalId, pedidoId, prefill, onSaved }: Props) {
  const router = useRouter();
  const { isOffline } = useOffline();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const supabase = createClient();

  const [veterinarias, setVeterinarias] = useState<VetOption[]>([]);
  const [personal, setPersonal] = useState<PersonalOption[]>([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    personal_id: personalId ?? "",
    veterinaria_id: prefill?.veterinaria_id ?? "",
    veterinaria_texto_original: prefill?.veterinaria_texto ?? "",
    codigo_original: "",
    fecha_operativa: todayISO(),
    cantidad_muestras: "",
    importe_declarado: "",
    metodo_pago: "" as MetodoPago | "",
    comentarios: "",
    tipo: "veterinaria" as TipoRetiro,
    urgente: prefill?.urgente ?? false,
  });

  useEffect(() => {
    async function load() {
      const [{ data: vets }, { data: pers }] = await Promise.all([
        supabase.from("veterinarias").select("id, codigo, nombre, zona_id").eq("activa", true).order("nombre"),
        supabase.from("personal").select("id, nombre, tipo").eq("activo", true).order("nombre"),
      ]);
      setVeterinarias(vets ?? []);
      setPersonal(pers ?? []);
    }
    load();
  }, []);

  function set(field: string, value: unknown) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.metodo_pago) { toast("error", "Seleccioná el tipo de pago"); return; }
    setLoading(true);

    const id = crypto.randomUUID();
    const retiro = {
      id,
      timestamp_carga: nowISO(),
      fecha_operativa: form.fecha_operativa,
      personal_id: form.personal_id,
      veterinaria_id: form.veterinaria_id || null,
      veterinaria_texto_original: form.veterinaria_texto_original,
      codigo_original: form.codigo_original || null,
      cantidad_muestras: parseInt(form.cantidad_muestras) || 0,
      importe_declarado: parseFloat(form.importe_declarado) || 0,
      metodo_pago: form.metodo_pago as MetodoPago,
      comentarios: form.comentarios || null,
      tipo: form.tipo,
      urgente: form.urgente,
      estado: "registrado" as const,
      latitud: null,
      longitud: null,
      sincronizado: false,
      pedido_id: pedidoId ?? null,
      anulado: false,
      created_by: form.personal_id,
    };

    if (isOffline) {
      await saveRetiroOffline({ ...retiro, _offline: true });
      await addToSyncQueue({
        id: crypto.randomUUID(),
        action: "create",
        table: "retiros",
        data: retiro,
        timestamp: Date.now(),
      });
      toast("warning", "Retiro guardado offline — se sincronizará al reconectarse");
      onSaved?.();
      router.push("/retiros");
      return;
    }

    const { error } = await supabase.from("retiros").insert(retiro);

    if (error) {
      toast("error", "Error al guardar: " + error.message);
      setLoading(false);
      return;
    }

    if (pedidoId) {
      await supabase.from("pedidos_retiro").update({ estado: "resuelto", resuelto_en: nowISO(), retiro_id: id }).eq("id", pedidoId);
    }

    toast("success", "Retiro guardado correctamente ✓");
    onSaved?.();
    router.push("/retiros");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Identificación */}
      <section>
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-g700 mb-3 pb-2 border-b border-g100">
          <i className="ti ti-user" /> Identificación
        </div>
        <div className="grid grid-cols-2 gap-3.5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-gy600">Personal de logística</label>
            <select
              className="px-3 py-2 border-2 border-gy200 rounded-[6px] text-[13px] bg-gy50 focus:outline-none focus:border-g500"
              value={form.personal_id}
              onChange={(e) => set("personal_id", e.target.value)}
              required
            >
              <option value="">— Seleccionar —</option>
              {personal.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-gy600">Tipo de retiro</label>
            <div className="flex gap-2 flex-wrap">
              {(["veterinaria", "ventanilla", "reemplazo", "otro"] as TipoRetiro[]).map((t) => (
                <button key={t} type="button"
                  className={`px-3.5 py-1.5 rounded-[6px] border-2 text-[12px] capitalize transition-all ${form.tipo === t ? "bg-g800 text-white border-g800" : "bg-white text-gy600 border-gy200"}`}
                  onClick={() => set("tipo", t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Veterinaria */}
      <section>
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-g700 mb-3 pb-2 border-b border-g100">
          <i className="ti ti-building-hospital" /> Veterinaria / Cliente
        </div>
        <div className="grid grid-cols-2 gap-3.5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-gy600">Nombre o búsqueda</label>
            <input
              list="vets-list"
              className="px-3 py-2 border-2 border-gy200 rounded-[6px] text-[13px] bg-gy50 focus:outline-none focus:border-g500"
              placeholder="Buscar por nombre..."
              value={form.veterinaria_texto_original}
              onChange={(e) => {
                set("veterinaria_texto_original", e.target.value);
                const match = veterinarias.find((v) => v.nombre === e.target.value);
                if (match) { set("veterinaria_id", match.id); set("codigo_original", match.codigo); }
              }}
            />
            <datalist id="vets-list">
              {veterinarias.map((v) => <option key={v.id} value={v.nombre} />)}
            </datalist>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-gy600">Código</label>
            <input
              className="px-3 py-2 border-2 border-gy200 rounded-[6px] text-[13px] bg-gy50 focus:outline-none focus:border-g500 font-mono"
              placeholder="Ej: SR-01"
              value={form.codigo_original}
              onChange={(e) => set("codigo_original", e.target.value)}
            />
          </div>
        </div>
      </section>

      {/* Detalle */}
      <section>
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-g700 mb-3 pb-2 border-b border-g100">
          <i className="ti ti-flask" /> Detalle de muestras
        </div>
        <div className="grid grid-cols-3 gap-3.5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-gy600">Fecha operativa</label>
            <input type="date" className="px-3 py-2 border-2 border-gy200 rounded-[6px] text-[13px] bg-gy50 focus:outline-none focus:border-g500"
              value={form.fecha_operativa} onChange={(e) => set("fecha_operativa", e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-gy600">Cantidad de muestras</label>
            <input type="number" min="0" className="px-3 py-2 border-2 border-gy200 rounded-[6px] text-[13px] bg-gy50 focus:outline-none focus:border-g500"
              placeholder="0" value={form.cantidad_muestras} onChange={(e) => set("cantidad_muestras", e.target.value)} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-gy600">Importe ($)</label>
            <input type="number" min="0" step="0.01" className="px-3 py-2 border-2 border-gy200 rounded-[6px] text-[13px] bg-gy50 focus:outline-none focus:border-g500"
              placeholder="0.00" value={form.importe_declarado} onChange={(e) => set("importe_declarado", e.target.value)} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5 mt-3.5">
          <label className="text-[11px] font-semibold text-gy600">Tipo de pago <span className="text-red-500">*</span></label>
          <div className="flex gap-2 flex-wrap">
            {([["efectivo", "Efectivo"], ["transferencia", "Transferencia"], ["mercado_pago", "Mercado Pago"]] as [MetodoPago, string][]).map(([val, label]) => (
              <button key={val} type="button"
                className={`px-3.5 py-1.5 rounded-[6px] border-2 text-[12px] transition-all ${form.metodo_pago === val ? "bg-g800 text-white border-g800" : "bg-white text-gy600 border-gy200"}`}
                onClick={() => set("metodo_pago", val)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5 mt-3.5">
          <label className="text-[11px] font-semibold text-gy600">Comentarios</label>
          <textarea className="px-3 py-2 border-2 border-gy200 rounded-[6px] text-[13px] bg-gy50 focus:outline-none focus:border-g500 resize-y min-h-[72px]"
            placeholder="Observaciones adicionales..." value={form.comentarios} onChange={(e) => set("comentarios", e.target.value)} />
        </div>
      </section>

      {/* Urgente */}
      <section>
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-g700 mb-3 pb-2 border-b border-g100">
          <i className="ti ti-flag" /> Marcadores
        </div>
        <button type="button"
          onClick={() => set("urgente", !form.urgente)}
          className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-[6px] border-2 transition-all ${form.urgente ? "border-red-400 bg-red-50" : "border-dashed border-gy300"}`}
        >
          <div className={`w-2.5 h-2.5 rounded-full transition-colors ${form.urgente ? "bg-red-500" : "bg-gy300"}`} />
          <span className={`text-[12px] font-semibold ${form.urgente ? "text-red-600" : "text-gy600"}`}>
            {form.urgente ? "Urgente: SÍ" : "Urgente: No"}
          </span>
        </button>
      </section>

      <button type="submit" disabled={loading}
        className="w-full py-3.5 bg-g800 hover:bg-g700 text-white font-semibold rounded-[10px] text-[14px] flex items-center justify-center gap-2 transition-colors disabled:opacity-60 tracking-wide"
      >
        {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <i className="ti ti-device-floppy" />}
        {loading ? "Guardando…" : "Guardar retiro"}
      </button>

      <div className="flex items-center gap-1.5 text-[11px] text-gy400">
        <div className="w-1.5 h-1.5 rounded-full bg-g500" />
        ID único generado automáticamente · Timestamp registrado · Vinculado a trazabilidad
      </div>
    </form>
  );
}
