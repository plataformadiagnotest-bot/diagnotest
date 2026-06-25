"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useOffline } from "@/lib/hooks/useOffline";
import { useSync } from "@/lib/hooks/useSync";
import { saveRetiroOffline, addToSyncQueue, getRetirosOffline } from "@/lib/offline/indexeddb";
import { toast } from "@/components/ui/ToastNotification";
import { todayISO, nowISO, formatDateTime } from "@/lib/utils/dates";
import { initials, fmtMoneySign } from "@/lib/utils/format";
import { notificarNuevoPedido, pedirPermisoNotificaciones } from "@/lib/utils/notificaciones";
import { normVet } from "@/lib/pedidos/match";
import type { MetodoPago } from "@/types";
import type { PedidoMobile, RetiroResumen } from "@/app/(dashboard)/inicio/page";

interface VetOption { id: string; codigo: string; nombre: string; telefono: string | null; direccion: string | null }

interface Props {
  nombre: string;
  zonaNombre: string;
  personalId: string;
  profileId: string;
  veterinarias: VetOption[];
  pedidos: PedidoMobile[];
  retirosHoy: RetiroResumen[];
}

type Tab = "resumen" | "retiro" | "pedidos" | "gastos";

export function MobileHome({ nombre, zonaNombre, personalId, profileId, veterinarias, pedidos, retirosHoy }: Props) {
  const router = useRouter();
  const { isOffline } = useOffline();
  // El layout del cadete no monta Topbar/DashboardShell, así que la cola de
  // sincronización se dispara desde acá: al reconectarse (o al abrir la app ya
  // online) se sube todo lo que quedó pendiente offline.
  const { pendingCount, isSyncing, lastSynced, sync } = useSync();
  const supabase = createClient();

  const [tab, setTab] = useState<Tab>("resumen");
  const [bannerOpen, setBannerOpen] = useState(pedidos.length > 0);
  const [verVets, setVerVets] = useState(false);

  // Retiros offline del día (aún sin sincronizar) — se suman al resumen del servidor.
  const [retirosOfflineHoy, setRetirosOfflineHoy] = useState<RetiroResumen[]>([]);
  useEffect(() => {
    if (!personalId) return;
    let activo = true;
    getRetirosOffline(personalId).then((rows) => {
      if (!activo) return;
      const hoy = todayISO();
      const mapped = (rows ?? [])
        .filter((r) => r.fecha_operativa === hoy)
        .map((r) => ({
          id: r.id,
          veterinaria: r.veterinaria_texto_original ?? "Veterinaria",
          codigo: r.codigo_original ?? "",
          importe: Number(r.importe_declarado ?? 0),
          muestras: Number(r.cantidad_muestras ?? 0),
        }));
      setRetirosOfflineHoy(mapped);
    });
    return () => { activo = false; };
  }, [personalId, isOffline]);

  // Combina servidor + offline sin duplicar por id.
  const resumenRetiros = useMemo(() => {
    const ids = new Set(retirosHoy.map((r) => r.id));
    return [...retirosHoy, ...retirosOfflineHoy.filter((r) => !ids.has(r.id))];
  }, [retirosHoy, retirosOfflineHoy]);

  const totalVisitas = resumenRetiros.length;
  const totalImporte = resumenRetiros.reduce((s, r) => s + r.importe, 0);
  const totalMuestras = resumenRetiros.reduce((s, r) => s + r.muestras, 0);

  // Realtime: cuando el jefe asigna un pedido a este cadete, el perfil se
  // actualiza solo (sin recargar) y avisa con vibración + sonido + notificación.
  useEffect(() => {
    if (!personalId) return;
    pedirPermisoNotificaciones();
    const channel = supabase
      .channel(`pedidos-cadete-${personalId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "pedidos_retiro", filter: `personal_asignado_id=eq.${personalId}` },
        () => {
          notificarNuevoPedido();
          toast("info", "📍 Nuevo pedido de retiro asignado");
          router.refresh();
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pedidos_retiro", filter: `personal_asignado_id=eq.${personalId}` },
        () => router.refresh()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personalId]);

  // Al terminar de subir la cola pendiente, avisa y refresca el resumen.
  useEffect(() => {
    if (lastSynced && lastSynced > 0) {
      toast("success", `${lastSynced} registro${lastSynced > 1 ? "s" : ""} sincronizado${lastSynced > 1 ? "s" : ""} ✓`);
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastSynced]);

  // ── Retiro form ─────────────────────────────────────────────
  const [vetTexto, setVetTexto] = useState("");
  const [vetId, setVetId] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [muestras, setMuestras] = useState("");
  const [importe, setImporte] = useState("0");
  const [metodoPago, setMetodoPago] = useState<MetodoPago | "">("");
  const [comentarios, setComentarios] = useState("");
  const [urgente, setUrgente] = useState(false);
  const [pedidoId, setPedidoId] = useState<string | null>(null);
  const [savingRetiro, setSavingRetiro] = useState(false);
  const [fotoRetiro, setFotoRetiro] = useState<File | null>(null);
  const fotoRetiroInput = useRef<HTMLInputElement>(null);
  // Avisos que requieren confirmación antes de guardar (modal propio: en la PWA
  // instalada el window.confirm nativo suele quedar suprimido por el navegador).
  // `dup` indica si entre los avisos hay un duplicado confirmado, para que el
  // retiro guardado quede como visita válida y no oculto como sospechoso.
  const [confirmRetiro, setConfirmRetiro] = useState<{ msgs: string[]; dup: boolean } | null>(null);

  // ── Gasto form ──────────────────────────────────────────────
  const [gTipo, setGTipo] = useState<"gasto" | "retiro_dinero">("gasto");
  const [gDesc, setGDesc] = useState("");
  const [gMonto, setGMonto] = useState("");
  const [gFecha, setGFecha] = useState(todayISO());
  const [savingGasto, setSavingGasto] = useState(false);
  const [fotoGasto, setFotoGasto] = useState<File | null>(null);
  const fotoGastoInput = useRef<HTMLInputElement>(null);

  // Sube una foto al bucket "comprobantes" y devuelve la URL pública
  async function uploadComprobante(file: File): Promise<string | null> {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${personalId || "anon"}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("comprobantes").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "image/jpeg",
    });
    if (error) { toast("error", "No se pudo subir la foto: " + error.message); return null; }
    return supabase.storage.from("comprobantes").getPublicUrl(path).data.publicUrl;
  }

  function matchVet(value: string) {
    setVetTexto(value);
    const val = value.trim();
    const valLow = val.toLowerCase();
    // Coincidencia por valor combinado "código — nombre", por código exacto o por nombre.
    const m = veterinarias.find((v) => `${v.codigo} — ${v.nombre}` === val)
      ?? veterinarias.find((v) => v.codigo.toLowerCase() === valLow)
      ?? veterinarias.find((v) => v.nombre.toLowerCase() === valLow);
    if (m) { setVetId(m.id); setCodigo(m.codigo); } else { setVetId(null); }
  }

  function abrirPedido(p: PedidoMobile) {
    setTab("retiro");
    setPedidoId(p.id);
    setVetId(p.veterinaria_id);
    setVetTexto(p.veterinaria_nombre);
    setCodigo(p.veterinaria_codigo);
    setUrgente(p.urgente);
    setComentarios(p.detalle ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetRetiro() {
    setVetTexto(""); setVetId(null); setCodigo("");
    setMuestras(""); setImporte("0"); setMetodoPago(""); setComentarios("");
    setUrgente(false); setPedidoId(null); setFotoRetiro(null);
    if (fotoRetiroInput.current) fotoRetiroInput.current.value = "";
  }

  // ¿Ya hay un retiro de esta veterinaria cargado hoy por este cadete? Matchea
  // por id, código o nombre normalizado. Online consulta la base (ve también los
  // marcados como sospechosos); offline usa lo que ya está en el resumen del día.
  async function hayDuplicadoHoy(): Promise<boolean> {
    const nombre = normVet(vetSel?.nombre ?? vetTexto);
    const cod = normVet(codigo);
    if (!vetId && !nombre && !cod) return false;
    if (isOffline) {
      return resumenRetiros.some((r) =>
        (!!cod && normVet(r.codigo) === cod) || (!!nombre && normVet(r.veterinaria) === nombre)
      );
    }
    const { data } = await supabase
      .from("retiros")
      .select("id, veterinaria_id, veterinaria_texto_original, codigo_original")
      .eq("personal_id", personalId)
      .eq("fecha_operativa", todayISO())
      .eq("anulado", false);
    return (data ?? []).some((r) =>
      (!!vetId && r.veterinaria_id === vetId) ||
      (!!cod && normVet(r.codigo_original) === cod) ||
      (!!nombre && normVet(r.veterinaria_texto_original) === nombre)
    );
  }

  async function guardarRetiro() {
    if (!personalId) { toast("error", "No se encontró tu perfil de personal"); return; }
    if (!vetTexto.trim()) { toast("error", "Indicá la veterinaria"); return; }
    if (!muestras.trim() || parseInt(muestras) < 0) { toast("error", "Ingresá la cantidad de muestras"); return; }
    if (!importe.trim() || parseFloat(importe) < 0) { toast("error", "Ingresá el importe"); return; }
    const hayPago = parseFloat(importe) > 0;
    if (hayPago && !metodoPago) { toast("error", "Seleccioná el tipo de pago"); return; }

    // Avisos que requieren confirmación: 0 muestras (visita sin levantar nada) y
    // duplicado del día. Si hay alguno, abrimos el modal y esperamos el OK.
    const cantidad = parseInt(muestras) || 0;
    const msgs: string[] = [];
    if (cantidad === 0) {
      msgs.push("Vas a guardar un retiro con 0 muestras (pasaste por la veterinaria sin levantar ninguna).");
    }
    const dup = await hayDuplicadoHoy();
    if (dup) {
      msgs.push(`Ya cargaste un retiro de "${vetSel?.nombre ?? vetTexto}" hoy. Si confirmás, se guarda igual como una segunda visita válida.`);
    }
    if (msgs.length > 0) {
      setConfirmRetiro({ msgs, dup });
      return;
    }
    await persistRetiro(false);
  }

  // Guarda el retiro de verdad. `confirmadoDup` = el cadete aceptó un duplicado:
  // en ese caso, si el trigger de la base lo marcó como sospechoso, lo volvemos a
  // 'registrado' para que cuente como visita.
  async function persistRetiro(confirmadoDup: boolean) {
    if (!personalId) return;
    const hayPago = parseFloat(importe) > 0;
    setSavingRetiro(true);

    let comprobanteUrl: string | null = null;
    if (fotoRetiro && !isOffline) {
      comprobanteUrl = await uploadComprobante(fotoRetiro);
      if (!comprobanteUrl) { setSavingRetiro(false); return; }
    }

    const id = crypto.randomUUID();
    const retiro = {
      id,
      timestamp_carga: nowISO(),
      fecha_operativa: todayISO(),
      personal_id: personalId,
      veterinaria_id: vetId,
      veterinaria_texto_original: vetSel?.nombre ?? vetTexto,
      codigo_original: codigo || null,
      cantidad_muestras: parseInt(muestras) || 0,
      importe_declarado: parseFloat(importe) || 0,
      metodo_pago: hayPago ? (metodoPago as MetodoPago) : null,
      comprobante_url: comprobanteUrl,
      comentarios: comentarios.trim() || null,
      tipo: "veterinaria" as const,
      urgente,
      estado: "registrado" as const,
      segunda_visita: confirmadoDup,
      latitud: null,
      longitud: null,
      sincronizado: false,
      pedido_id: pedidoId,
      anulado: false,
      created_by: profileId,
    };

    if (isOffline) {
      await saveRetiroOffline({ ...retiro, _offline: true });
      await addToSyncQueue({ id: crypto.randomUUID(), action: "create", table: "retiros", data: retiro, timestamp: Date.now() });
      toast("warning", fotoRetiro
        ? "Retiro guardado offline — la foto deberá adjuntarse al reconectarse"
        : "Retiro guardado offline — se sincronizará al reconectarse");
      resetRetiro();
      setSavingRetiro(false);
      return;
    }

    // Insert directo al servidor: por definición queda sincronizado.
    const { error } = await supabase.from("retiros").insert({ ...retiro, sincronizado: true });
    if (error) { toast("error", "Error al guardar: " + error.message); setSavingRetiro(false); return; }

    // El cadete confirmó que es una segunda visita (no un duplicado). El trigger
    // ya la ignora por la bandera segunda_visita, pero por las dudas (deploy de
    // la migración pendiente) revertimos cualquier marca de sospechoso.
    if (confirmadoDup) {
      await supabase.from("retiros").update({ estado: "registrado" }).eq("id", id).eq("estado", "duplicado_sospechoso");
    }

    if (pedidoId) {
      await supabase.from("pedidos_retiro").update({ estado: "resuelto", resuelto_en: nowISO(), retiro_id: id }).eq("id", pedidoId);
    }

    toast("success", "Retiro guardado correctamente ✓");
    resetRetiro();
    setSavingRetiro(false);
    router.refresh();
  }

  async function guardarGasto() {
    if (!personalId) { toast("error", "No se encontró tu perfil de personal"); return; }
    if (!gDesc.trim()) { toast("error", "Seleccioná un concepto"); return; }
    setSavingGasto(true);

    const gasto = {
      id: crypto.randomUUID(),
      personal_id: personalId,
      tipo: gTipo,
      descripcion: gDesc,
      monto: parseFloat(gMonto) || 0,
      fecha_operativa: gFecha,
      comprobante_url: null as string | null,
      estado: "pendiente" as const,
    };

    // Offline: encolar para sincronizar al reconectarse (la foto se adjunta luego).
    if (isOffline) {
      await addToSyncQueue({ id: crypto.randomUUID(), action: "create", table: "gastos", data: gasto, timestamp: Date.now() });
      toast("warning", fotoGasto
        ? "Gasto guardado offline — la foto deberá adjuntarse al reconectarse"
        : "Gasto guardado offline — se sincronizará al reconectarse");
      setGDesc(""); setGMonto(""); setFotoGasto(null);
      if (fotoGastoInput.current) fotoGastoInput.current.value = "";
      setSavingGasto(false);
      return;
    }

    if (fotoGasto) {
      const url = await uploadComprobante(fotoGasto);
      if (!url) { setSavingGasto(false); return; }
      gasto.comprobante_url = url;
    }

    const { error } = await supabase.from("gastos").insert(gasto);
    if (error) { toast("error", "Error al guardar: " + error.message); setSavingGasto(false); return; }
    toast("success", "Gasto registrado correctamente ✓");
    setGDesc(""); setGMonto(""); setFotoGasto(null);
    if (fotoGastoInput.current) fotoGastoInput.current.value = "";
    setSavingGasto(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const vetSel = vetId ? veterinarias.find((v) => v.id === vetId) ?? null : null;

  const inputCls = "w-full px-3.5 py-3 border-2 border-gy200 rounded-[10px] text-[14px] bg-gy50 focus:outline-none focus:border-g500 focus:bg-white transition-colors";
  const bigCls = "text-center text-[22px] font-bold";

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header verde */}
      <header className="bg-g800 text-white px-4 pt-4 pb-3.5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-g500 flex items-center justify-center text-[12px] font-bold border-2 border-white/20 shrink-0">
          {initials(nombre)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold truncate">{nombre}</div>
          <div className="text-[11px] text-white/60 truncate">{zonaNombre} · Personal de logística</div>
        </div>
        <button onClick={handleLogout} aria-label="Cerrar sesión"
          className="ml-auto flex items-center gap-1.5 text-white/80 hover:text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors shrink-0">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="M16 17l5-5-5-5" />
            <path d="M21 12H9" />
          </svg>
          Salir
        </button>
      </header>

      <div className="flex-1 px-4 py-4 space-y-3.5">
        {/* Sync status */}
        <div className={`flex items-center gap-2 text-[12px] font-medium px-3.5 py-2.5 rounded-[10px] ${isOffline ? "bg-amber/15 text-amber-text" : pendingCount > 0 ? "bg-blue-50 text-blue-700" : "bg-g50 text-g700"}`}>
          <span className={`w-2 h-2 rounded-full ${isOffline ? "bg-amber" : isSyncing ? "bg-blue-400 animate-pulse" : pendingCount > 0 ? "bg-blue-400" : "bg-g500"}`} />
          <span className="flex-1">
            {isOffline
              ? `Sin conexión · ${pendingCount} pendiente${pendingCount !== 1 ? "s" : ""} en el dispositivo`
              : isSyncing
                ? "Sincronizando…"
                : pendingCount > 0
                  ? `${pendingCount} sin sincronizar`
                  : "Conectado · sincronización automática"}
          </span>
          {!isOffline && !isSyncing && pendingCount > 0 && (
            <button onClick={() => sync()} className="text-[11px] font-semibold underline shrink-0">Reintentar</button>
          )}
        </div>

        {/* Banner pedidos */}
        {bannerOpen && pedidos.length > 0 && (
          <button onClick={() => setTab("pedidos")}
            className="w-full flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-[12px] px-3.5 py-3 text-left">
            <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center shrink-0">
              <i className="ti ti-map-pin text-[16px]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-blue-800">{pedidos.length} pedido{pedidos.length !== 1 ? "s" : ""} de retiro asignado{pedidos.length !== 1 ? "s" : ""}</div>
              <div className="text-[11px] text-blue-600 truncate">{pedidos.map((p) => p.veterinaria_nombre).join(" · ")}</div>
            </div>
            <span className="ml-auto w-6 h-6 rounded-full bg-blue-500 text-white text-[11px] font-bold flex items-center justify-center shrink-0">{pedidos.length}</span>
          </button>
        )}

        {/* Tabs */}
        <div className="flex bg-gy100 rounded-[10px] p-1">
          {([["resumen", "Resumen"], ["retiro", "Nuevo retiro"], ["pedidos", "Pedidos"], ["gastos", "Gastos"]] as [Tab, string][]).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-[8px] text-[11px] font-semibold transition-all ${tab === t ? "bg-white text-g700 shadow-sm" : "text-gy500"}`}>
              {label}
              {t === "pedidos" && pedidos.length > 0 && (
                <span className="ml-1 text-[9px] bg-blue-500 text-white rounded-full px-1.5 py-0.5">{pedidos.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* TAB: Resumen del día */}
        {tab === "resumen" && (
          <div className="space-y-3">
            <div className="text-[11px] text-gy400">Tu actividad de hoy · {todayISO().split("-").reverse().join("/")}</div>
            <div className="grid grid-cols-3 gap-2">
              {/* Veterinarias (clickable) */}
              <button onClick={() => setVerVets((v) => !v)}
                className={`flex flex-col items-center justify-center gap-0.5 py-3.5 rounded-[12px] border-2 transition-all ${verVets ? "border-g500 bg-g50" : "border-gy200 bg-white"}`}>
                <span className="text-[24px] font-bold text-g700 leading-none">{totalVisitas}</span>
                <span className="text-[10px] font-semibold text-gy500 flex items-center gap-0.5">
                  Visitas <i className={`ti ti-chevron-${verVets ? "up" : "down"} text-[11px]`} />
                </span>
              </button>
              {/* Ingreso total */}
              <div className="flex flex-col items-center justify-center gap-0.5 py-3.5 rounded-[12px] border-2 border-gy200 bg-white">
                <span className="text-[18px] font-bold text-g700 leading-none">{fmtMoneySign(totalImporte)}</span>
                <span className="text-[10px] font-semibold text-gy500">Ingreso día</span>
              </div>
              {/* Muestras */}
              <div className="flex flex-col items-center justify-center gap-0.5 py-3.5 rounded-[12px] border-2 border-gy200 bg-white">
                <span className="text-[24px] font-bold text-g700 leading-none">{totalMuestras}</span>
                <span className="text-[10px] font-semibold text-gy500">Muestras</span>
              </div>
            </div>

            {/* Listado de veterinarias visitadas (al tocar el número) */}
            {verVets && (
              <div className="bg-white border border-gy200 rounded-[12px] overflow-hidden">
                <div className="px-3.5 py-2.5 border-b border-gy100 text-[11px] font-bold uppercase tracking-wide text-gy400">
                  Veterinarias visitadas hoy
                </div>
                {resumenRetiros.length === 0 ? (
                  <div className="py-8 text-center text-[12px] text-gy400">Todavía no cargaste retiros hoy</div>
                ) : (
                  <div className="divide-y divide-gy100">
                    {resumenRetiros.map((r) => (
                      <div key={r.id} className="flex items-center gap-3 px-3.5 py-2.5">
                        <div className="min-w-0 flex-1">
                          <div className="font-mono text-[15px] font-bold text-gy900 leading-tight">{r.codigo || "S/C"}</div>
                          <div className="text-[11px] text-gy500 truncate">{r.veterinaria}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-[13px] font-semibold text-g700">{fmtMoneySign(r.importe)}</div>
                          <div className="text-[10px] text-gy400">{r.muestras} muestra{r.muestras !== 1 ? "s" : ""}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button onClick={() => setTab("retiro")}
              className="w-full py-3 bg-g800 hover:bg-g700 text-white font-bold rounded-[12px] text-[14px] flex items-center justify-center gap-2 transition-colors">
              <i className="ti ti-circle-plus text-[18px]" /> Cargar nuevo retiro
            </button>
          </div>
        )}

        {/* TAB: Nuevo retiro */}
        {tab === "retiro" && (
          <div className="space-y-3">
            {pedidoId && (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-[10px] px-3 py-2 text-[11px] text-blue-700">
                <i className="ti ti-link text-[14px]" />
                Registrando retiro de un pedido asignado
                <button onClick={resetRetiro} className="ml-auto text-blue-500 hover:text-blue-700"><i className="ti ti-x" /></button>
              </div>
            )}
            <div>
              <label className="block text-[11px] font-semibold text-gy600 mb-1.5">Veterinaria <span className="text-red-500">*</span></label>
              <input list="mob-vets" required className={inputCls} placeholder="Buscar por nombre o código..."
                value={vetTexto} onChange={(e) => matchVet(e.target.value)} />
              <datalist id="mob-vets">
                {veterinarias.map((v) => <option key={v.id} value={`${v.codigo} — ${v.nombre}`} />)}
              </datalist>
              {vetSel && (
                <div className="mt-2 flex flex-col gap-1.5 bg-g50 border border-g200 rounded-[10px] px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <i className="ti ti-building-store text-[17px] text-g600 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-[18px] font-bold text-gy900 leading-tight">{vetSel.codigo || "S/C"}</div>
                      <div className="text-[12px] text-gy500 truncate">{vetSel.nombre}</div>
                    </div>
                  </div>
                  {vetSel.telefono && (
                    <a href={`tel:${vetSel.telefono.replace(/\s+/g, "")}`}
                      className="flex items-center gap-2 text-[13px] font-semibold text-g700">
                      <i className="ti ti-phone text-[15px]" />
                      <span className="flex-1">{vetSel.telefono}</span>
                      <span className="text-[10px] font-medium text-g600 bg-white border border-g300 rounded-full px-2 py-0.5">Llamar</span>
                    </a>
                  )}
                  {vetSel.direccion && (
                    <div className="flex items-start gap-2 text-[12px] text-gy600">
                      <i className="ti ti-map-pin text-[14px] mt-0.5 shrink-0" />
                      <span>{vetSel.direccion}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gy600 mb-1.5">Muestras <span className="text-red-500">*</span></label>
              <input type="number" inputMode="numeric" min="0" required className={`${inputCls} ${bigCls}`} placeholder="0"
                onFocus={(e) => e.target.select()}
                value={muestras} onChange={(e) => setMuestras(e.target.value)} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gy600 mb-1.5">Importe cobrado <span className="text-red-500">*</span></label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[22px] font-bold text-g700 pointer-events-none">$</span>
                <input type="number" inputMode="decimal" min="0" required
                  className={`${inputCls} ${bigCls} pl-9 border-g500 bg-white`} placeholder="0"
                  onFocus={(e) => e.target.select()}
                  value={importe} onChange={(e) => setImporte(e.target.value)} />
              </div>
              <div className="text-[10px] text-gy400 mt-1">Si no cobraste, dejá en <span className="font-semibold">0</span>.</div>
            </div>
            {parseFloat(importe) > 0 && (
              <div>
                <label className="block text-[11px] font-semibold text-gy600 mb-1.5">Tipo de pago <span className="text-red-500">*</span></label>
                <div className="grid grid-cols-3 gap-2">
                  {([["efectivo", "Efectivo"], ["transferencia", "Transferencia"], ["mercado_pago", "Mercado Pago"]] as [MetodoPago, string][]).map(([val, label]) => (
                    <button key={val} type="button" onClick={() => setMetodoPago(val)}
                      className={`py-2.5 px-1 rounded-[10px] border-2 text-[12px] font-medium transition-all ${metodoPago === val ? "bg-g800 text-white border-g800" : "bg-white text-gy600 border-gy200"}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label className="block text-[11px] font-semibold text-gy600 mb-1.5">Comentarios</label>
              <input className={inputCls} placeholder="Opcional..." value={comentarios} onChange={(e) => setComentarios(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input ref={fotoRetiroInput} type="file" accept="image/*" className="hidden"
                onChange={(e) => setFotoRetiro(e.target.files?.[0] ?? null)} />
              <button type="button" onClick={() => fotoRetiroInput.current?.click()}
                className={`flex flex-col items-center justify-center gap-1 py-3 rounded-[10px] border-2 text-[12px] font-medium transition-all ${fotoRetiro ? "border-g500 bg-g50 text-g700" : "border-dashed border-gy300 text-gy500"}`}>
                <i className="ti ti-camera text-[18px]" />
                {fotoRetiro ? "Foto cargada ✓" : "Foto comprobante"}
              </button>
              <button type="button" onClick={() => setUrgente((v) => !v)}
                className={`flex flex-col items-center justify-center gap-1 py-3 rounded-[10px] border-2 text-[12px] font-medium transition-all ${urgente ? "border-red-400 bg-red-50 text-red-600" : "border-dashed border-gy300 text-gy500"}`}>
                <i className="ti ti-alert-triangle text-[18px]" />
                {urgente ? "URGENTE" : "Marcar urgente"}
              </button>
            </div>
            {fotoRetiro && (
              <div className="flex items-center gap-2 text-[11px] text-g700 bg-g50 rounded-[8px] px-3 py-2">
                <i className="ti ti-photo" />
                <span className="truncate flex-1">{fotoRetiro.name}</span>
                <button type="button" onClick={() => { setFotoRetiro(null); if (fotoRetiroInput.current) fotoRetiroInput.current.value = ""; }}
                  className="text-gy400 hover:text-red-500"><i className="ti ti-x" /></button>
              </div>
            )}
            <button onClick={guardarRetiro} disabled={savingRetiro}
              className="w-full py-3.5 bg-g800 hover:bg-g700 text-white font-bold rounded-[12px] text-[15px] flex items-center justify-center gap-2 disabled:opacity-60 transition-colors">
              {savingRetiro ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <i className="ti ti-device-floppy text-[18px]" />}
              GUARDAR RETIRO
            </button>
            <div className="text-center text-[11px] text-gy400">Se guarda localmente si no hay conexión</div>
          </div>
        )}

        {/* TAB: Pedidos */}
        {tab === "pedidos" && (
          <div className="space-y-3">
            <div className="text-[11px] text-gy400">Tocá un pedido para abrir el formulario de retiro ya cargado</div>
            {pedidos.length === 0 && (
              <div className="py-12 text-center text-gy400 text-[13px]">No tenés pedidos asignados</div>
            )}
            {pedidos.map((p) => {
              return (
                <div key={p.id} className="bg-white border border-blue-200 border-l-4 border-l-blue-500 rounded-[12px] px-3.5 py-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-[18px] font-bold text-gy900 leading-tight">{p.veterinaria_codigo || "S/C"}</div>
                      <div className="text-[12px] text-gy500 truncate">{p.veterinaria_nombre}</div>
                    </div>
                    {p.urgente && <span className="text-[9px] font-bold bg-red-500 text-white rounded-full px-2 py-0.5 shrink-0">URGENTE</span>}
                  </div>
                  <div className="flex items-center gap-1.5 text-[12px] font-semibold text-blue-700 mt-1.5">
                    <i className="ti ti-clock-hour-4 text-[14px]" />
                    Horario de retiro: {formatDateTime(p.fecha_limite)}
                  </div>
                  {p.detalle && <div className="text-[11px] text-gy500 mt-0.5">{p.detalle}</div>}
                  <button onClick={() => abrirPedido(p)}
                    className="w-full mt-2.5 flex items-center justify-center gap-1.5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white text-[13px] font-semibold rounded-[10px] transition-colors">
                    <i className="ti ti-circle-plus text-[16px]" /> Registrar este retiro
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB: Gastos */}
        {tab === "gastos" && (
          <div className="space-y-3">
            <div className="text-[11px] text-gy400">Registrá un gasto o retiro de dinero para recupero</div>
            <div>
              <label className="block text-[11px] font-semibold text-gy600 mb-1.5">Tipo</label>
              <div className="flex gap-2">
                {([["gasto", "Gasto"], ["retiro_dinero", "Retiro $"]] as ["gasto" | "retiro_dinero", string][]).map(([val, label]) => (
                  <button key={val} type="button" onClick={() => { setGTipo(val); setGDesc(""); }}
                    className={`flex-1 py-2.5 rounded-[10px] border-2 text-[13px] font-medium transition-all ${gTipo === val ? "bg-purple-600 text-white border-purple-600" : "bg-white text-gy600 border-gy200"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gy600 mb-1.5">Concepto <span className="text-red-500">*</span></label>
              <select className={inputCls} value={gDesc} onChange={(e) => setGDesc(e.target.value)}>
                <option value="">Seleccioná un concepto…</option>
                {(gTipo === "retiro_dinero"
                  ? ["Zona extra", "Reemplazo", "Honorarios"]
                  : ["Peaje", "Nafta", "Estacionamiento", "Bebida"]
                ).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gy600 mb-1.5">Monto $</label>
                <input type="number" inputMode="decimal" min="0" className={`${inputCls} ${bigCls}`} placeholder="0"
                  value={gMonto} onChange={(e) => setGMonto(e.target.value)} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gy600 mb-1.5">Fecha</label>
                <input type="date" className={inputCls} value={gFecha} onChange={(e) => setGFecha(e.target.value)} />
              </div>
            </div>
            <input ref={fotoGastoInput} type="file" accept="image/*" className="hidden"
              onChange={(e) => setFotoGasto(e.target.files?.[0] ?? null)} />
            <button type="button" onClick={() => fotoGastoInput.current?.click()}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-[10px] border-2 text-[13px] font-medium transition-all ${fotoGasto ? "border-purple-400 bg-purple-50 text-purple-700" : "border-dashed border-gy300 text-gy500"}`}>
              <i className="ti ti-camera text-[16px]" />
              {fotoGasto ? "Foto del ticket cargada ✓" : "Foto del ticket"}
            </button>
            {fotoGasto && (
              <div className="flex items-center gap-2 text-[11px] text-purple-700 bg-purple-50 rounded-[8px] px-3 py-2">
                <i className="ti ti-photo" />
                <span className="truncate flex-1">{fotoGasto.name}</span>
                <button type="button" onClick={() => { setFotoGasto(null); if (fotoGastoInput.current) fotoGastoInput.current.value = ""; }}
                  className="text-gy400 hover:text-red-500"><i className="ti ti-x" /></button>
              </div>
            )}
            <button onClick={guardarGasto} disabled={savingGasto}
              className="w-full py-3.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-[12px] text-[15px] flex items-center justify-center gap-2 disabled:opacity-60 transition-colors">
              {savingGasto ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <i className="ti ti-device-floppy text-[18px]" />}
              GUARDAR GASTO
            </button>
          </div>
        )}
      </div>

      {confirmRetiro && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-3" onClick={() => setConfirmRetiro(null)}>
          <div className="bg-white rounded-[16px] shadow-xl max-w-[420px] w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gy100 flex items-center gap-2.5">
              <i className="ti ti-alert-triangle text-[22px] text-amber-500" />
              <span className="text-[15px] font-semibold text-gy900">Confirmá antes de guardar</span>
            </div>
            <div className="px-5 py-4 space-y-3">
              {confirmRetiro.msgs.map((m, i) => (
                <div key={i} className="flex items-start gap-2 text-[13px] text-gy700 leading-snug">
                  <i className="ti ti-point-filled text-[15px] text-amber-500 mt-0.5 shrink-0" />
                  <span>{m}</span>
                </div>
              ))}
              <p className="text-[12px] text-gy500 pt-0.5">¿Querés guardar de todas formas?</p>
            </div>
            <div className="px-5 py-3.5 bg-gy50 border-t border-gy100 flex gap-2.5">
              <button type="button" onClick={() => setConfirmRetiro(null)}
                className="flex-1 py-3 text-[14px] font-semibold bg-white text-gy600 border-2 border-gy200 rounded-[12px]">
                Cancelar
              </button>
              <button type="button" disabled={savingRetiro}
                onClick={() => { const dup = confirmRetiro.dup; setConfirmRetiro(null); persistRetiro(dup); }}
                className="flex-1 py-3 text-[14px] font-bold bg-g700 text-white rounded-[12px] disabled:opacity-60">
                Sí, guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
