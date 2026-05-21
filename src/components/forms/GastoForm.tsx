"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/ToastNotification";
import { todayISO } from "@/lib/utils/dates";

interface Props {
  personalId: string;
}

export function GastoForm({ personalId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState<"gasto" | "retiro_dinero">("gasto");
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(todayISO());
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!personalId) { toast("error", "No se encontró tu perfil de personal"); return; }
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.from("gastos").insert({
      personal_id: personalId,
      tipo,
      descripcion,
      monto: parseFloat(monto) || 0,
      fecha_operativa: fecha,
      estado: "pendiente",
    });

    if (error) { toast("error", "Error al guardar: " + error.message); setLoading(false); return; }
    toast("success", "Gasto registrado correctamente ✓");
    setOpen(false);
    setDescripcion(""); setMonto("");
    router.refresh();
    setLoading(false);
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-[12px] font-medium rounded-[6px]">
        <i className="ti ti-plus" /> Registrar gasto/retiro
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-5 py-4 border-b border-gy100 bg-purple-50 flex items-center gap-2.5 rounded-t-2xl">
              <i className="ti ti-receipt text-purple-600 text-[20px]" />
              <span className="text-[14px] font-semibold flex-1">Nuevo gasto o retiro de dinero</span>
              <button onClick={() => setOpen(false)} className="text-gy400 hover:text-gy800">
                <i className="ti ti-x text-[18px]" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-gy600 mb-1.5">Tipo</label>
                <div className="flex gap-2">
                  {[["gasto", "Gasto"], ["retiro_dinero", "Retiro de dinero"]] .map(([val, label]) => (
                    <button key={val} type="button"
                      className={`flex-1 py-2 rounded-[6px] border-2 text-[12px] font-medium transition-all ${tipo === val ? "bg-purple-600 text-white border-purple-600" : "bg-white text-gy600 border-gy200"}`}
                      onClick={() => setTipo(val as "gasto" | "retiro_dinero")}
                    >{label}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gy600 mb-1.5">Descripción</label>
                <input className="w-full px-3 py-2 border-2 border-gy200 rounded-[6px] text-[13px] bg-gy50 focus:outline-none focus:border-purple-400"
                  placeholder="Ej: Nafta Shell estación Florida, km 1234" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-gy600 mb-1.5">Monto ($)</label>
                  <input type="number" min="0" step="0.01" className="w-full px-3 py-2 border-2 border-gy200 rounded-[6px] text-[13px] bg-gy50 focus:outline-none focus:border-purple-400"
                    placeholder="0.00" value={monto} onChange={(e) => setMonto(e.target.value)} required />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gy600 mb-1.5">Fecha</label>
                  <input type="date" className="w-full px-3 py-2 border-2 border-gy200 rounded-[6px] text-[13px] bg-gy50 focus:outline-none focus:border-purple-400"
                    value={fecha} onChange={(e) => setFecha(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={loading}
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-[8px] text-[13px] flex items-center justify-center gap-2 disabled:opacity-60">
                  {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <i className="ti ti-device-floppy" />}
                  Guardar
                </button>
                <button type="button" onClick={() => setOpen(false)} className="px-4 py-2.5 bg-white border border-gy200 text-gy600 rounded-[8px] text-[13px] hover:bg-gy50">
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
