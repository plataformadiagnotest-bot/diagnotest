"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/ToastNotification";
import Link from "next/link";

interface Props {
  pedidoId: string;
  estado?: string; // reserved for future conditional rendering
  isPersonal: boolean;
}

interface PersonalOption { id: string; nombre: string }

export function PedidoActions({ pedidoId, estado, isPersonal }: Props) {
  const router = useRouter();
  const [reasignando, setReasignando] = useState(false);
  const [personal, setPersonal] = useState<PersonalOption[]>([]);
  const [destino, setDestino] = useState("");
  const [loading, setLoading] = useState(false);

  async function abrirReasignar() {
    setReasignando(true);
    if (personal.length === 0) {
      const supabase = createClient();
      const { data } = await supabase
        .from("personal")
        .select("id, nombre")
        .eq("activo", true)
        .order("nombre");
      setPersonal(data ?? []);
    }
  }

  async function confirmarReasignar() {
    if (!destino) { toast("warning", "Elegí a quién reasignar"); return; }
    setLoading(true);
    const supabase = createClient();
    // Reasignar reabre el pedido (por si estaba vencido) y renueva el plazo.
    const { error } = await supabase
      .from("pedidos_retiro")
      .update({
        personal_asignado_id: destino,
        estado: "asignado",
        fecha_limite: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
      })
      .eq("id", pedidoId);
    setLoading(false);
    if (error) { toast("error", "Error al reasignar: " + error.message); return; }
    toast("success", "Pedido reasignado ✓");
    setReasignando(false);
    setDestino("");
    router.refresh();
  }

  async function marcarResuelto() {
    const supabase = createClient();
    const { error } = await supabase
      .from("pedidos_retiro")
      .update({ estado: "resuelto", resuelto_en: new Date().toISOString() })
      .eq("id", pedidoId);
    if (error) { toast("error", "Error al actualizar"); return; }
    toast("success", "Pedido marcado como resuelto ✓");
    router.refresh();
  }

  async function cancelar() {
    if (!confirm("¿Cancelar este pedido?")) return;
    const supabase = createClient();
    await supabase.from("pedidos_retiro").update({ estado: "cancelado" }).eq("id", pedidoId);
    toast("warning", "Pedido cancelado");
    router.refresh();
  }

  if (isPersonal) {
    return (
      <div className="flex gap-2 flex-wrap items-center">
        <Link
          href={`/retiros/nuevo?pedido=${pedidoId}`}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-[6px] hover:bg-blue-100"
        >
          <i className="ti ti-circle-plus text-[13px]" /> Registrar retiro
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 flex-wrap items-center">
        <button onClick={abrirReasignar} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium bg-white text-gy600 border border-gy200 rounded-[6px] hover:bg-gy50">
          <i className="ti ti-user-edit text-[13px]" /> Reasignar
        </button>
        <button onClick={marcarResuelto} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium bg-g50 text-g700 border border-g200 rounded-[6px] hover:bg-g100">
          <i className="ti ti-check text-[13px]" /> Marcar resuelto
        </button>
        <button onClick={cancelar} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium bg-red-50 text-red-700 border border-red-200 rounded-[6px] hover:bg-red-100">
          <i className="ti ti-x text-[13px]" /> Cancelar pedido
        </button>
      </div>

      {reasignando && (
        <div className="flex gap-2 items-center flex-wrap bg-gy50 border border-gy200 rounded-[8px] px-3 py-2">
          <span className="text-[11px] font-semibold text-gy600">Reasignar a:</span>
          <select
            className="px-2.5 py-1.5 border-2 border-gy200 rounded-[6px] text-[12px] bg-white focus:outline-none focus:border-g500"
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
          >
            <option value="">— Seleccionar —</option>
            {personal.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
          <button onClick={confirmarReasignar} disabled={loading}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium bg-g700 text-white rounded-[6px] hover:bg-g800 disabled:opacity-50">
            {loading ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <i className="ti ti-check text-[13px]" />}
            Confirmar
          </button>
          <button onClick={() => { setReasignando(false); setDestino(""); }}
            className="px-2.5 py-1.5 text-[11px] bg-white border border-gy200 rounded-[6px] text-gy600 hover:bg-gy50">
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}
