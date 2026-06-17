"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/ToastNotification";

// Botón de eliminación manual de un retiro (solo dirección / super admin).
export function EliminarRetiro({ retiroId, etiqueta }: { retiroId: string; etiqueta?: string }) {
  const router = useRouter();
  const [borrando, setBorrando] = useState(false);

  async function eliminar() {
    if (!window.confirm(`¿Eliminar definitivamente este registro${etiqueta ? ` (${etiqueta})` : ""}?\n\nSe borra el retiro y sus controles. Esta acción no se puede deshacer.`)) return;
    setBorrando(true);
    const res = await fetch("/api/retiros/eliminar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: retiroId }),
    });
    const json = await res.json().catch(() => ({}));
    setBorrando(false);
    if (!res.ok) { toast("error", json.error ?? "No se pudo eliminar"); return; }
    toast("success", "Registro eliminado ✓");
    router.refresh();
  }

  return (
    <button onClick={eliminar} disabled={borrando} title="Eliminar registro"
      className="px-2 py-1 text-[11px] bg-white border border-red-200 text-red-600 rounded-[6px] hover:bg-red-50 flex items-center gap-1 disabled:opacity-50">
      {borrando
        ? <span className="w-3.5 h-3.5 border-2 border-red-200 border-t-red-600 rounded-full animate-spin" />
        : <i className="ti ti-trash text-[13px]" />}
    </button>
  );
}
