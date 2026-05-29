"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/ToastNotification";

interface ResultRow { nombre: string; email: string; password?: string; estado: "creado" | "existente" | "error"; detalle?: string }
interface SyncResponse { resumen: { creados: number; existentes: number; errores: number; total: number }; results: ResultRow[] }

const LS_KEY = "diagnotest_cadetes_sheet_url";

export function CadetesSync() {
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
    const res = await fetch("/api/admin/cadetes/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sheetUrl: url.trim() }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) { toast("error", json.error ?? "No se pudo sincronizar"); return; }
    setData(json);
    const { creados, existentes, errores } = json.resumen;
    toast("success", `Sincronización lista: ${creados} nuevos, ${existentes} existentes${errores ? `, ${errores} con error` : ""}`);
    router.refresh();
  }

  const creados = data?.results.filter((r) => r.estado === "creado") ?? [];

  function copiarCredenciales() {
    const texto = creados.map((r) => `${r.nombre}\t${r.email}\t${r.password}`).join("\n");
    navigator.clipboard.writeText(texto);
    toast("success", "Credenciales copiadas al portapapeles");
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
              <span className="text-[15px] font-semibold flex-1">Importar cadetes desde Google Sheets</span>
              <button onClick={() => setOpen(false)} className="text-gy400 hover:text-gy600"><i className="ti ti-x text-[18px]" /></button>
            </div>

            <div className="px-5 py-4 space-y-3.5 overflow-y-auto">
              <div className="flex items-start gap-1.5 text-[11px] text-gy600 bg-gy50 rounded-[8px] px-3 py-2.5 leading-relaxed">
                <i className="ti ti-info-circle text-[14px] mt-0.5 shrink-0 text-g600" />
                <span>
                  El Sheet debe estar como <b>&quot;Cualquiera con el enlace puede ver&quot;</b> y tener en la primera fila las columnas:
                  <b> nombre</b>, <b>email</b>, y opcionalmente <b>zona</b> y <b>tipo</b> (fijo/reemplazo/ventanilla).
                  Los que no existan se crean con una contraseña automática que verás abajo.
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
                    <span className="px-2.5 py-1 rounded-full bg-g50 text-g700 font-semibold">{data.resumen.creados} creados</span>
                    <span className="px-2.5 py-1 rounded-full bg-gy100 text-gy600 font-semibold">{data.resumen.existentes} ya existían</span>
                    {data.resumen.errores > 0 && <span className="px-2.5 py-1 rounded-full bg-red-50 text-red-700 font-semibold">{data.resumen.errores} con error</span>}
                  </div>

                  {creados.length > 0 && (
                    <div className="border border-g200 rounded-[10px] overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 bg-g50 border-b border-g100">
                        <span className="text-[12px] font-semibold text-g700 flex-1">Credenciales nuevas — entregáselas a cada cadete</span>
                        <button onClick={copiarCredenciales} className="flex items-center gap-1 text-[11px] text-g700 hover:underline">
                          <i className="ti ti-copy" /> Copiar todo
                        </button>
                      </div>
                      <table className="w-full text-[11px]">
                        <thead><tr className="bg-gy50 text-gy400">
                          <th className="px-3 py-1.5 text-left font-bold uppercase tracking-wide">Nombre</th>
                          <th className="px-3 py-1.5 text-left font-bold uppercase tracking-wide">Email</th>
                          <th className="px-3 py-1.5 text-left font-bold uppercase tracking-wide">Contraseña</th>
                        </tr></thead>
                        <tbody>
                          {creados.map((r) => (
                            <tr key={r.email} className="border-b border-gy100 last:border-0">
                              <td className="px-3 py-1.5">{r.nombre}</td>
                              <td className="px-3 py-1.5 text-gy600">{r.email}</td>
                              <td className="px-3 py-1.5 font-mono font-semibold text-g700">{r.password}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="px-3 py-2 text-[10px] text-amber-text bg-amber-bg border-t border-amber/30">
                        ⚠️ Guardá estas contraseñas ahora: por seguridad no se vuelven a mostrar.
                      </div>
                    </div>
                  )}

                  {data.results.some((r) => r.estado === "error") && (
                    <div className="border border-red-200 rounded-[10px] overflow-hidden">
                      <div className="px-3 py-2 bg-red-50 border-b border-red-100 text-[12px] font-semibold text-red-700">Filas con problemas</div>
                      <div className="divide-y divide-gy100">
                        {data.results.filter((r) => r.estado === "error").map((r, i) => (
                          <div key={i} className="px-3 py-1.5 text-[11px]">
                            <span className="font-medium">{r.nombre}</span> · {r.email} — <span className="text-red-600">{r.detalle}</span>
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
