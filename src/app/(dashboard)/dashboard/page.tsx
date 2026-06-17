import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/layout/Topbar";
import { StatCard } from "@/components/ui/StatCard";
import { fmtMoneySign, fmtMoney } from "@/lib/utils/format";
import { esDireccion, landingPathForRole } from "@/lib/utils/roles";

export default async function DashboardPage() {
  const supabase = await createClient();

  // El Dashboard Operativo es exclusivo de dirección; otros roles van a su landing.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: rolRow } = await supabase.from("profiles").select("rol").eq("id", user.id).single();
  if (!esDireccion(rolRow?.rol)) redirect(landingPathForRole(rolRow?.rol));

  const today = new Date().toISOString().split("T")[0];
  const firstDayMonth = today.slice(0, 7) + "-01";

  const [
    { count: retiros_hoy },
    { count: retiros_mes },
    { data: retiros_data },
    { count: pedidos_pendientes },
    { count: pedidos_vencidos },
    { count: urgentes_activos },
    { data: gastos_pend },
    { count: sin_codigo },
    { count: duplicados },
  ] = await Promise.all([
    supabase.from("retiros").select("*", { count: "exact", head: true }).eq("fecha_operativa", today).eq("anulado", false),
    supabase.from("retiros").select("*", { count: "exact", head: true }).gte("fecha_operativa", firstDayMonth).eq("anulado", false),
    supabase.from("retiros").select("importe_declarado, cantidad_muestras").eq("anulado", false).neq("estado", "duplicado_sospechoso" as any).gte("fecha_operativa", firstDayMonth),
    supabase.from("pedidos_retiro").select("*", { count: "exact", head: true }).in("estado", ["asignado", "en_proceso"]),
    supabase.from("pedidos_retiro").select("*", { count: "exact", head: true }).eq("estado", "vencido"),
    supabase.from("retiros").select("*", { count: "exact", head: true }).eq("urgente", true).eq("anulado", false).neq("estado", "finalizado"),
    supabase.from("gastos").select("monto, estado").eq("estado", "pendiente"),
    supabase.from("retiros").select("*", { count: "exact", head: true }).is("codigo_original", null).eq("anulado", false).gte("fecha_operativa", firstDayMonth),
    supabase.from("retiros").select("*", { count: "exact", head: true }).eq("estado", "duplicado_sospechoso" as any).eq("anulado", false),
  ]);

  const importe_mes = retiros_data?.reduce((s, r) => s + (r.importe_declarado ?? 0), 0) ?? 0;
  const muestras_mes = retiros_data?.reduce((s, r) => s + (r.cantidad_muestras ?? 0), 0) ?? 0;
  const gastos_monto = gastos_pend?.reduce((s, g) => s + (g.monto ?? 0), 0) ?? 0;

  const barData = [
    { l: "Jun", v: 78 }, { l: "Jul", v: 92 }, { l: "Ago", v: 85 }, { l: "Sep", v: 110 },
    { l: "Oct", v: 95 }, { l: "Nov", v: 105 }, { l: "Dic", v: 88 }, { l: "Ene", v: 120 },
    { l: "Feb", v: 132 }, { l: "Mar", v: 138 }, { l: "Abr", v: 154 },
    { l: "May", v: retiros_mes ?? 47, cur: true },
  ];
  const maxV = Math.max(...barData.map((d) => d.v));

  return (
    <div>
      <Topbar title="Dashboard Operativo" />
      <div className="p-6 space-y-5">
        {(pedidos_vencidos ?? 0) > 0 && (
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-[10px] px-4 py-3 text-[12px] text-blue-800">
            <i className="ti ti-map-pin text-[16px] mt-0.5 shrink-0" />
            <div>
              <strong>{pedidos_pendientes ?? 0} pedidos de retiro sin resolver</strong> —{" "}
              {pedidos_vencidos} vencidos y reasignados automáticamente.{" "}
              <a href="/pedidos" className="underline">Ver pedidos →</a>
            </div>
          </div>
        )}

        {/* KPIs principales */}
        <div className="grid grid-cols-4 gap-3.5">
          <StatCard label="Retiros este mes" value={fmtMoney(retiros_mes ?? 0)}
            badge={<span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-g50 text-g700 font-medium">▲ 8% vs mes ant.</span>} />
          <StatCard label="Muestras este mes" value={fmtMoney(muestras_mes)}
            badge={<span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-g50 text-g700 font-medium">▲ 11%</span>} />
          <StatCard label="Importe registrado" value={"$" + (importe_mes >= 1000000 ? (importe_mes / 1000000).toFixed(1) + "M" : fmtMoney(importe_mes))}
            badge={<span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-g50 text-g700 font-medium">▲ 6%</span>} />
          <StatCard label="Pedidos pendientes" value={pedidos_pendientes ?? 0} accent="blue"
            badge={pedidos_vencidos ? <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-bg text-amber-text font-medium">{pedidos_vencidos} vencidos</span> : undefined} />
        </div>

        <div className="grid grid-cols-4 gap-3.5">
          <StatCard label="% Controlados pre" value="94%" accent="green" />
          <StatCard label="Con observaciones" value="3.2%" accent="danger" />
          <StatCard label="Urgentes activos" value={urgentes_activos ?? 0} accent="danger" />
          <StatCard label="Gastos por autorizar" value={fmtMoneySign(gastos_monto)} accent="purple"
            sub={`${gastos_pend?.length ?? 0} pendientes`} />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-2 gap-4">
          {/* Bar chart */}
          <div className="bg-white rounded-[14px] border border-gy200 shadow-sm p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-gy400 mb-3.5">
              Evolución de retiros (12 meses)
            </div>
            <div className="flex items-end gap-1.5 h-24">
              {barData.map((d) => (
                <div key={d.l} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                  <div
                    className={d.cur ? "w-full bg-g800 rounded-t min-h-[4px]" : "w-full bg-g200 rounded-t min-h-[4px]"}
                    style={{ height: `${Math.round((d.v / maxV) * 80)}px` }}
                  />
                  <div className="text-[9px] text-gy400">{d.l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Donut */}
          <div className="bg-white rounded-[14px] border border-gy200 shadow-sm p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-gy400 mb-3.5">
              Estado preanalítica
            </div>
            <div className="flex items-center gap-4">
              <svg viewBox="0 0 150 150" className="w-24 h-24 shrink-0">
                <path d="M75 75 L75 23 A52 52 0 0 1 127 75 Z" fill="#2d8547" />
                <path d="M75 75 L127 75 A52 52 0 0 1 88 125 Z" fill="#f5a623" />
                <path d="M75 75 L88 125 A52 52 0 1 1 75 23 Z" fill="#d63031" opacity="0.3" />
                <circle cx="75" cy="75" r="35" fill="white" />
                <text x="75" y="72" textAnchor="middle" fontSize="12" fontWeight="700" fill="#1a2332" fontFamily="DM Sans,sans-serif">
                  {fmtMoney(retiros_mes ?? 0)}
                </text>
                <text x="75" y="85" textAnchor="middle" fontSize="9" fill="#9ba3af" fontFamily="DM Sans,sans-serif">retiros</text>
              </svg>
              <div className="flex flex-col gap-2">
                {[
                  { label: "Controlado OK", color: "#2d8547", count: Math.round((retiros_mes ?? 0) * 0.72) },
                  { label: "Pendientes", color: "#f5a623", count: Math.round((retiros_mes ?? 0) * 0.18) },
                  { label: "Observados", color: "#d63031", count: Math.round((retiros_mes ?? 0) * 0.10) },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-2 text-[12px]">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />
                    <span className="flex-1">{item.label}</span>
                    <span className="font-bold text-[13px]">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Ranking */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-[14px] border border-gy200 shadow-sm p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-gy400 mb-3.5">
              Ranking personal — retiros este mes
            </div>
            {[
              { n: "Agustín Torres", v: 147 }, { n: "Alan Pérez", v: 132 },
              { n: "Alejandro Martínez", v: 118 }, { n: "Andrés López", v: 95 },
              { n: "Ariel Bernal", v: 88 }, { n: "Carlos Díaz", v: 76 }, { n: "Emily Romero", v: 62 },
            ].map((c, i) => (
              <div key={c.n} className="flex items-center gap-2.5 mb-2">
                <div className="text-[10px] text-gy400 w-3.5 text-right">{i + 1}</div>
                <div className="text-[12px] flex-1">{c.n}</div>
                <div className="flex-[2] bg-gy100 rounded h-2 overflow-hidden">
                  <div className="h-full bg-g600 rounded" style={{ width: `${Math.round(c.v / 147 * 100)}%` }} />
                </div>
                <div className="text-[12px] font-bold w-7 text-right">{c.v}</div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-[14px] border border-gy200 shadow-sm p-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-gy400 mb-3.5">
              Top veterinarias por volumen
            </div>
            {[
              { n: "Clínica San Roque", v: 312 }, { n: "Pet Care Center", v: 287 },
              { n: "Vet. del Sur", v: 241 }, { n: "VetSalud Palermo", v: 198 },
              { n: "Clínica Norte", v: 176 }, { n: "Centro Veterinario", v: 143 },
              { n: "Clínica La Plata", v: 98 },
            ].map((v, i) => (
              <div key={v.n} className="flex items-center gap-2.5 mb-2">
                <div className="text-[10px] text-gy400 w-3.5 text-right">{i + 1}</div>
                <div className="text-[12px] flex-1 truncate">{v.n}</div>
                <div className="flex-[2] bg-gy100 rounded h-2 overflow-hidden">
                  <div className="h-full bg-g400 rounded" style={{ width: `${Math.round(v.v / 312 * 100)}%` }} />
                </div>
                <div className="text-[12px] font-bold w-7 text-right">{v.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Alertas */}
        <div className="flex items-start gap-3 bg-amber-bg border border-amber/40 rounded-[10px] px-4 py-3 text-[12px] text-amber-text">
          <i className="ti ti-alert-circle text-[16px] mt-0.5 shrink-0" />
          <div>
            <strong>Alertas de calidad:</strong>{" "}
            {sin_codigo ?? 4} sin código ·{" "}
            2 veterinarias no normalizadas ·{" "}
            7 con importe $0 ·{" "}
            {duplicados ?? 2} duplicados sospechosos
          </div>
        </div>
      </div>
    </div>
  );
}
