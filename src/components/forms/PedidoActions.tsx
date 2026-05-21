"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/ui/ToastNotification";
import Link from "next/link";

interface Props {
  pedidoId: string;
  estado?: string; // reserved for future conditional rendering
  isPersonal: boolean;
}

export function PedidoActions({ pedidoId, estado, isPersonal }: Props) {
  const router = useRouter();

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

  return (
    <div className="flex gap-2 flex-wrap items-center">
      {isPersonal ? (
        <Link
          href={`/retiros/nuevo?pedido=${pedidoId}`}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-[6px] hover:bg-blue-100"
        >
          <i className="ti ti-circle-plus text-[13px]" /> Registrar retiro
        </Link>
      ) : (
        <>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium bg-white text-gy600 border border-gy200 rounded-[6px] hover:bg-gy50">
            <i className="ti ti-user-edit text-[13px]" /> Reasignar
          </button>
          <button onClick={marcarResuelto} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium bg-g50 text-g700 border border-g200 rounded-[6px] hover:bg-g100">
            <i className="ti ti-check text-[13px]" /> Marcar resuelto
          </button>
          <button onClick={cancelar} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium bg-red-50 text-red-700 border border-red-200 rounded-[6px] hover:bg-red-100">
            <i className="ti ti-x text-[13px]" /> Cancelar pedido
          </button>
        </>
      )}
    </div>
  );
}
