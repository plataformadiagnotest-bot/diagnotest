"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/ToastNotification";

interface ResultRow { codigo: string; nombre: string; estado: "creado" | "actualizado" | "error"; detalle?: string }
interface SyncResponse { resumen: { creados: number; actualizados: number; errores: number; total: number }; results: ResultRow[] }

const LS_KEY = "diagnotest_vets_sheet_url";

export function VeterinariasSync() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<SyncResponse | null>(null);

  useEffect(() => {
    setUrl(localStorage.getItem(LS_KEY) ?? "");
  }, []);

  async function sincronizar() {
    if (!url.trim()) { toast("error", "Pegá el link del Google Sheet"); return; }
    localStorage.setItem(LS_KEY, url.trim());
    setLoading(true);
    setData(null);
    const res = await fetch("/api/admin/veterinarias/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sheetUrl: url.trim() }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) { toast("error", json.error ?? "No se pudo sincronizar"); return; }
    setData(json);
    const { creados, actualizados, errores } = json.resumen;
    toast("success", `Sincronización lista: ${creados} nuevas, ${actualizados} actualizadas${errores ? `, ${errores} con error` : ""}`);
    router.refresh();
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-g300 text-g700 text-[12px] font-medium rounded-[6px] hover:bg-g50">
        <i className="ti ti-table-import" /> Importar desde Google Sheets
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-[16px] shadow-xl w-full max-w-[640px] max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gy100 flex items-center gap-2">
              <i className="ti ti-table-import text-g600" />
              <span className="text-[15px] font-semibold flex-1">Importar veterinarias desde Google Sheets</span>
              <button onClick={() => setOpen(false)} className="text-gy400 hover:text-gy600"><i className="ti ti-x text-[18px]" /></button>
            </div>

            <div className="px-5 py-4 space-y-3.5 overflow-y-auto">
              <div className="flex items-start gap-1.5 text-[11px] text-gy600 bg-gy50 rounded-[8px] px-3 py-2.5 leading-relaxed">
                <i className="ti ti-info-circle text-[14px] mt-0.5 shrink-0 text-g600" />
                <span>
                  El Sheet debe estar como <b>&quot;Cualquiera con el enlace puede ver&quot;</b> y tener en la primera fila las columnas:
                  <b> codigo</b>, <b>nombre</b>, y opcionalmente <b>direccion</b>, <b>telefono</b> y <b>zona</b>.
                  Se identifican por <b>código</b>: las que ya existan se actualizan, las nuevas se crean.
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gy600 mb-1.5">Link del Google Sheet</label>
                <input
                  className="w-full px-3 py-2 border-2 border-gy200 rounded-[8px] text-[12px] bg-gy50 focus:outline-none focus:border-g500 focus:bg-white"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={url} onChange={(e) => setUrl(e.target.value)} />
              </div>

              <button onClick={sincronizar} disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-g800 hover:bg-g700 text-white font-semibold rounded-[8px] text-[13px] disabled:opacity-60">
                {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <i className="ti ti-refresh" />}
                {loading ? "Sincronizando…" : "Sincronizar ahora"}
              </button>

              {data && (
                <div className="space-y-3">
                  <div className="flex gap-2 text-[11px]">
                    <span className="px-2.5 py-1 rounded-full bg-g50 text-g700 font-semibold">{data.resumen.creados} nuevas</span>
                    <span className="px-2.5 py-1 rounded-full bg-gy100 text-gy600 font-semibold">{data.resumen.actualizados} actualizadas</span>
                    {data.resumen.errores > 0 && <span className="px-2.5 py-1 rounded-full bg-red-50 text-red-700 font-semibold">{data.resumen.errores} con error</span>}
                  </div>

                  {data.results.some((r) => r.estado === "error") && (
                    <div className="border border-red-200 rounded-[10px] overflow-hidden">
                      <div className="px-3 py-2 bg-red-50 border-b border-red-100 text-[12px] font-semibold text-red-700">Filas con problemas</div>
                      <div className="divide-y divide-gy100">
                        {data.results.filter((r) => r.estado === "error").map((r, i) => (
                          <div key={i} className="px-3 py-1.5 text-[11px]">
                            <span className="font-medium">{r.codigo}</span> · {r.nombre} — <span className="text-red-600">{r.detalle}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
