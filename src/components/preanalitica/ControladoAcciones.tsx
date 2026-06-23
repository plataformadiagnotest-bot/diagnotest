"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/ToastNotification";

interface Props {
  controlId: string;
  cancelado: boolean;
  comentario: string | null;
}

export function ControladoAcciones({ controlId, cancelado, comentario }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<"cancelar" | "reactivar" | "comentario" | null>(null);
  const [modal, setModal] = useState<null | "cancelar" | "comentario">(null);
  const [motivo, setMotivo] = useState("");
  const [texto, setTexto] = useState(comentario ?? "");

  async function enviar(accion: "cancelar" | "reactivar" | "comentario", extra?: Record<string, string>) {
    setLoading(accion);
    try {
      const res = await fetch("/api/preanalitica/controlado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ controlId, accion, ...extra }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast("error", json.error ?? "No se pudo completar la acción");
        return;
      }
      const msg =
        accion === "cancelar" ? "Registro cancelado"
        : accion === "reactivar" ? "Registro reactivado"
        : "Comentario guardado";
      toast("success", msg);
      setModal(null);
      setMotivo("");
      router.refresh();
    } catch {
      toast("error", "Error de conexión");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      {cancelado ? (
        <button
          onClick={() => enviar("reactivar")}
          disabled={loading !== null}
          className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-[6px] border border-g300 text-g700 bg-white hover:bg-g50 disabled:opacity-50"
          title="Reactivar el registro (vuelve a estado normal)"
        >
          <i className="ti ti-arrow-back-up text-[12px]" /> Reactivar
        </button>
      ) : (
        <button
          onClick={() => setModal("cancelar")}
          disabled={loading !== null}
          className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-[6px] border border-red-300 text-red-700 bg-white hover:bg-red-50 disabled:opacity-50"
          title="Cancelar el registro"
        >
          <i className="ti ti-ban text-[12px]" /> Cancelar
        </button>
      )}
      <button
        onClick={() => { setTexto(comentario ?? ""); setModal("comentario"); }}
        disabled={loading !== null}
        className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-[6px] border border-gy200 text-gy600 bg-white hover:bg-gy50 disabled:opacity-50"
        title="Agregar o editar comentario"
      >
        <i className="ti ti-message-2 text-[12px]" /> Comentar
      </button>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-[14px] shadow-xl w-full max-w-[420px] p-5" onClick={(e) => e.stopPropagation()}>
            {modal === "cancelar" ? (
              <>
                <div className="text-[14px] font-semibold text-gy800 mb-1">Cancelar registro</div>
                <p className="text-[12px] text-gy500 mb-3">
                  Quedará marcado en rojo y se avisará a cobranzas y carga. Podés reactivarlo después si fue un error.
                </p>
                <label className="block text-[10px] font-semibold uppercase tracking-wide text-gy400 mb-1">Motivo (opcional)</label>
                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={3}
                  placeholder="Ej.: muestra en mal estado, sin orden…"
                  className="w-full px-2.5 py-2 border-2 border-gy200 rounded-[8px] text-[12px] bg-gy50 focus:outline-none focus:border-g500 focus:bg-white"
                />
                <div className="flex justify-end gap-2 mt-4">
                  <button onClick={() => setModal(null)} className="px-3 py-1.5 text-[12px] text-gy600 hover:text-gy800">Volver</button>
                  <button
                    onClick={() => enviar("cancelar", { motivo })}
                    disabled={loading === "cancelar"}
                    className="px-3.5 py-1.5 bg-red-600 text-white text-[12px] font-medium rounded-[8px] hover:bg-red-700 disabled:opacity-50"
                  >
                    {loading === "cancelar" ? "Cancelando…" : "Cancelar registro"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-[14px] font-semibold text-gy800 mb-1">Comentario</div>
                <p className="text-[12px] text-gy500 mb-3">Visible para cobranzas y carga.</p>
                <textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  rows={4}
                  placeholder="Escribí un comentario…"
                  className="w-full px-2.5 py-2 border-2 border-gy200 rounded-[8px] text-[12px] bg-gy50 focus:outline-none focus:border-g500 focus:bg-white"
                />
                <div className="flex justify-end gap-2 mt-4">
                  <button onClick={() => setModal(null)} className="px-3 py-1.5 text-[12px] text-gy600 hover:text-gy800">Volver</button>
                  <button
                    onClick={() => enviar("comentario", { comentario: texto })}
                    disabled={loading === "comentario"}
                    className="px-3.5 py-1.5 bg-g800 text-white text-[12px] font-medium rounded-[8px] hover:bg-g700 disabled:opacity-50"
                  >
                    {loading === "comentario" ? "Guardando…" : "Guardar comentario"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
