import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/layout/Topbar";
import { PillStatus } from "@/components/ui/PillStatus";
import { StatCard } from "@/components/ui/StatCard";
import { fmtMoney } from "@/lib/utils/format";
import { formatDateTime } from "@/lib/utils/dates";
import Link from "next/link";

export default async function RetirosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase.from("profiles").select("rol").eq("id", user!.id).single();
  const isPersonal = profile?.rol === "personal_logistica";

  let query = supabase
    .from("retiros")
    .select(`
      id, fecha_operativa, timestamp_carga, tipo, urgente, estado, sincronizado, anulado,
      cantidad_muestras, importe_declarado, veterinaria_texto_original, codigo_original,
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

  const { data: retiros } = await query;

  const today = new Date().toISOString().split("T")[0];
  const retirosHoy = retiros?.filter((r) => r.fecha_operativa === today) ?? [];
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
          <StatCard label={isPersonal ? "Este mes" : "Total cargados"} value={retiros?.length ?? 0} />
          <StatCard label="Muestras hoy" value={muestrasHoy} accent="warn" />
        </div>

        {/* Filter chips */}
        <div className="flex gap-1.5 flex-wrap">
          {["Todos", "Hoy", "Esta semana", "Pre. pendiente", "Observados", "Urgentes"].map((f, i) => (
            <button key={f} className={`px-3 py-1.5 rounded-full border text-[11px] transition-all ${i === 0 ? "bg-g800 text-white border-g800" : "bg-white text-gy600 border-gy200 hover:border-g400 hover:text-g700"}`}>
              {f}
            </button>
          ))}
          <div className="flex-1" />
          {!isPersonal && (
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gy200 text-[11px] text-gy600 rounded-full hover:bg-gy50">
              <i className="ti ti-download text-[13px]" /> Exportar Excel
            </button>
          )}
        </div>

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
                          <button className="px-2 py-1 text-[11px] bg-white border border-gy200 rounded-[6px] hover:bg-gy50 flex items-center gap-1">
                            <i className="ti ti-eye text-[13px]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!retiros?.length && (
                  <tr><td colSpan={9} className="py-10 text-center text-gy400 text-sm">Sin retiros registrados</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
