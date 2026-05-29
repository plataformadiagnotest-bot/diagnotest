import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/layout/Topbar";
import { PillStatus } from "@/components/ui/PillStatus";
import { StatCard } from "@/components/ui/StatCard";
import { fmtMoney } from "@/lib/utils/format";
import { formatDateTime } from "@/lib/utils/dates";
import Link from "next/link";

const METODO_PAGO_LABEL: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  mercado_pago: "Mercado Pago",
};

const FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "hoy", label: "Hoy" },
  { key: "semana", label: "Esta semana" },
  { key: "pre_pendiente", label: "Pre. pendiente" },
  { key: "observados", label: "Observados" },
  { key: "urgentes", label: "Urgentes" },
] as const;

export default async function RetirosPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; desde?: string; hasta?: string; cod?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase.from("profiles").select("rol").eq("id", user!.id).single();
  const isPersonal = profile?.rol === "personal_logistica";

  const { f, desde, hasta, cod } = await searchParams;
  // Por defecto, el personal de logística ve sus retiros de hoy
  const filter = f ?? (isPersonal ? "hoy" : "todos");

  let query = supabase
    .from("retiros")
    .select(`
      id, fecha_operativa, timestamp_carga, tipo, urgente, estado, sincronizado, anulado,
      cantidad_muestras, importe_declarado, metodo_pago, comprobante_url, veterinaria_texto_original, codigo_original,
      personal:personal_id(nombre),
      veterinaria:veterinaria_id(nombre, codigo),
      control_preanalitica:control_preanalitica(estado),
      control_cobranzas:control_cobranzas(estado)
    `)
    .eq("anulado", false)
    .order("timestamp_carga", { ascending: false })
    .limit(100);

  if (isPersonal) {
    const { data: pers } = await supabase.from("personal").select("id").eq("profile_id", user!.id).single();
    if (pers) query = query.eq("personal_id", pers.id);
  }

  const { data: allRetiros } = await query;

  const today = new Date().toISOString().split("T")[0];
  const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().split("T")[0];

  const preOf = (r: any) => Array.isArray(r.control_preanalitica) ? r.control_preanalitica[0]?.estado : (r.control_preanalitica)?.estado;
  const cobOf = (r: any) => Array.isArray(r.control_cobranzas) ? r.control_cobranzas[0]?.estado : (r.control_cobranzas)?.estado;

  const codTerm = (cod ?? "").trim().toLowerCase();
  const retiros = (allRetiros ?? []).filter((r) => {
    if (desde && r.fecha_operativa < desde) return false;
    if (hasta && r.fecha_operativa > hasta) return false;
    if (codTerm) {
      const code = `${r.codigo_original ?? ""} ${(r.veterinaria as any)?.codigo ?? ""}`.toLowerCase();
      if (!code.includes(codTerm)) return false;
    }
    switch (filter) {
      case "hoy": return r.fecha_operativa === today;
      case "semana": return r.fecha_operativa >= weekAgo;
      case "pre_pendiente": return (preOf(r) ?? "pendiente") === "pendiente";
      case "observados": return preOf(r) === "observado" || cobOf(r) === "diferencia";
      case "urgentes": return r.urgente;
      default: return true;
    }
  });

  const retirosHoy = (allRetiros ?? []).filter((r) => r.fecha_operativa === today);
  const muestrasHoy = retirosHoy.reduce((s, r) => s + (r.cantidad_muestras ?? 0), 0);

  return (
    <div>
      <Topbar
        title={isPersonal ? "Mis Retiros" : "Todos los Retiros"}
        actions={
          <Link href="/retiros/nuevo" className="flex items-center gap-1.5 px-3.5 py-2 bg-g800 text-white text-[12px] font-medium rounded-[6px] hover:bg-g700">
            <i className="ti ti-plus" /> Nuevo retiro
          </Link>
        }
      />
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-3 gap-3.5">
          <StatCard label="Retiros hoy" value={retirosHoy.length}
            badge={<span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-g50 text-g700 font-medium">▲ 2 vs ayer</span>} />
          <StatCard label={isPersonal ? "Este mes" : "Total cargados"} value={allRetiros?.length ?? 0} />
          <StatCard label="Muestras hoy" value={muestrasHoy} accent="warn" />
        </div>

        {/* Filter chips */}
        <div className="flex gap-1.5 flex-wrap">
          {FILTERS.map((opt) => {
            const params = new URLSearchParams();
            params.set("f", opt.key);
            if (desde) params.set("desde", desde);
            if (hasta) params.set("hasta", hasta);
            if (cod) params.set("cod", cod);
            return (
              <Link key={opt.key} href={`/retiros?${params.toString()}`} scroll={false}
                className={`px-3 py-1.5 rounded-full border text-[11px] transition-all ${filter === opt.key ? "bg-g800 text-white border-g800" : "bg-white text-gy600 border-gy200 hover:border-g400 hover:text-g700"}`}>
                {opt.label}
              </Link>
            );
          })}
          <div className="flex-1" />
          {!isPersonal && (
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gy200 text-[11px] text-gy600 rounded-full hover:bg-gy50">
              <i className="ti ti-download text-[13px]" /> Exportar Excel
            </button>
          )}
        </div>

        {/* Filtros por fecha y código */}
        <form method="get" className="flex items-end gap-2 flex-wrap">
          <input type="hidden" name="f" value={filter} />
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-gy400 mb-1">Desde</label>
            <input type="date" name="desde" defaultValue={desde ?? ""}
              className="px-2.5 py-1.5 border-2 border-gy200 rounded-[8px] text-[12px] bg-gy50 focus:outline-none focus:border-g500" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-gy400 mb-1">Hasta</label>
            <input type="date" name="hasta" defaultValue={hasta ?? ""}
              className="px-2.5 py-1.5 border-2 border-gy200 rounded-[8px] text-[12px] bg-gy50 focus:outline-none focus:border-g500" />
          </div>
          <div className="min-w-[160px]">
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-gy400 mb-1">Código</label>
            <input type="text" name="cod" defaultValue={cod ?? ""} placeholder="Código de veterinaria…"
              className="w-full px-2.5 py-1.5 border-2 border-gy200 rounded-[8px] text-[12px] bg-gy50 focus:outline-none focus:border-g500" />
          </div>
          <button type="submit"
            className="px-3.5 py-1.5 bg-g800 text-white text-[12px] font-medium rounded-[8px] hover:bg-g700">Filtrar</button>
          {(desde || hasta || cod) && (
            <Link href={`/retiros?f=${filter}`}
              className="px-3 py-1.5 text-[12px] text-gy500 hover:text-gy700">Limpiar</Link>
          )}
        </form>

        {/* Table */}
        <div className="bg-white rounded-[14px] border border-gy200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="bg-gy50">
                  <th className="px-3.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-gy400 border-b border-gy200">ID</th>
                  <th className="px-3.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-gy400 border-b border-gy200">Fecha/hora</th>
                  {!isPersonal && <th className="px-3.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-gy400 border-b border-gy200">Personal</th>}
                  <th className="px-3.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-gy400 border-b border-gy200">Veterinaria</th>
                  <th className="px-3.5 py-2.5 text-center text-[10px] font-bold uppercase tracking-wide text-gy400 border-b border-gy200">Muestras</th>
                  <th className="px-3.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-gy400 border-b border-gy200">Importe</th>
                  <th className="px-3.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-gy400 border-b border-gy200">Pago</th>
                  <th className="px-3.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-gy400 border-b border-gy200">Preanalítica</th>
                  <th className="px-3.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-gy400 border-b border-gy200">Cobranzas</th>
                  <th className="px-3.5 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-gy400 border-b border-gy200"></th>
                </tr>
              </thead>
              <tbody>
                {(retiros ?? []).map((r) => {
                  const preEstado = Array.isArray(r.control_preanalitica) ? r.control_preanalitica[0]?.estado : (r.control_preanalitica as any)?.estado;
                  const cobEstado = Array.isArray(r.control_cobranzas) ? r.control_cobranzas[0]?.estado : (r.control_cobranzas as any)?.estado;
                  return (
                    <tr key={r.id} className="hover:bg-gy50 border-b border-gy100 last:border-0">
                      <td className="px-3.5 py-2.5 font-mono text-[11px] text-gy400">{r.id.slice(0, 8).toUpperCase()}</td>
                      <td className="px-3.5 py-2.5 text-gy600">{formatDateTime(r.timestamp_carga)}</td>
                      {!isPersonal && <td className="px-3.5 py-2.5 font-medium text-gy900">{(r.personal as any)?.nombre ?? "—"}</td>}
                      <td className="px-3.5 py-2.5 max-w-[140px] truncate">
                        {(r.veterinaria as any)?.nombre ?? r.veterinaria_texto_original}
                        {r.codigo_original && <span className="ml-1.5 font-mono text-[10px] text-gy400">{r.codigo_original}</span>}
                      </td>
                      <td className="px-3.5 py-2.5 text-center font-semibold">{r.cantidad_muestras}</td>
                      <td className="px-3.5 py-2.5">${fmtMoney(r.importe_declarado)}</td>
                      <td className="px-3.5 py-2.5 text-gy600">{METODO_PAGO_LABEL[r.metodo_pago as string] ?? "—"}</td>
                      <td className="px-3.5 py-2.5">
                        <PillStatus variant={preEstado === "ok" ? "ok" : preEstado === "observado" ? "observado" : "pendiente"} />
                      </td>
                      <td className="px-3.5 py-2.5">
                        <PillStatus variant={cobEstado === "adjudicado" ? "ok" : cobEstado === "diferencia" ? "diferencia" : "pendiente"} />
                      </td>
                      <td className="px-3.5 py-2.5">
                        <div className="flex items-center gap-1.5">
                          {r.urgente && <PillStatus variant="urgente" />}
                          {!r.sincronizado && <PillStatus variant="nosync" />}
                          {r.comprobante_url && (
                            <a href={r.comprobante_url as string} target="_blank" rel="noopener noreferrer"
                              title="Ver ticket"
                              className="px-2 py-1 text-[11px] bg-white border border-gy200 rounded-[6px] hover:bg-gy50 flex items-center gap-1 text-g700">
                              <i className="ti ti-photo text-[13px]" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!retiros?.length && (
                  <tr><td colSpan={10} className="py-10 text-center text-gy400 text-sm">Sin retiros registrados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
