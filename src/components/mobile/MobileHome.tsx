"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useOffline } from "@/lib/hooks/useOffline";
import { saveRetiroOffline, addToSyncQueue } from "@/lib/offline/indexeddb";
import { toast } from "@/components/ui/ToastNotification";
import { todayISO, nowISO } from "@/lib/utils/dates";
import { initials } from "@/lib/utils/format";
import type { MetodoPago } from "@/types";
import type { PedidoMobile } from "@/app/(dashboard)/inicio/page";

interface VetOption { id: string; codigo: string; nombre: string }

interface Props {
  nombre: string;
  zonaNombre: string;
  personalId: string;
  profileId: string;
  veterinarias: VetOption[];
  pedidos: PedidoMobile[];
}

type Tab = "retiro" | "pedidos" | "gastos";

export function MobileHome({ nombre, zonaNombre, personalId, profileId, veterinarias, pedidos }: Props) {
  const router = useRouter();
  const { isOffline } = useOffline();
  const supabase = createClient();

  const [tab, setTab] = useState<Tab>("retiro");
  const [bannerOpen, setBannerOpen] = useState(pedidos.length > 0);

  // ── Retiro form ─────────────────────────────────────────────
  const [vetTexto, setVetTexto] = useState("");
  const [vetId, setVetId] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [muestras, setMuestras] = useState("");
  const [importe, setImporte] = useState("");
  const [metodoPago, setMetodoPago] = useState<MetodoPago | "">("");
  const [comentarios, setComentarios] = useState("");
  const [urgente, setUrgente] = useState(false);
  const [pedidoId, setPedidoId] = useState<string | null>(null);
  const [savingRetiro, setSavingRetiro] = useState(false);
  const [fotoRetiro, setFotoRetiro] = useState<File | null>(null);
  const fotoRetiroInput = useRef<HTMLInputElement>(null);

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
    const m = veterinarias.find((v) => v.nombre === value || v.codigo === value);
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
    setMuestras(""); setImporte(""); setMetodoPago(""); setComentarios("");
    setUrgente(false); setPedidoId(null); setFotoRetiro(null);
    if (fotoRetiroInput.current) fotoRetiroInput.current.value = "";
  }

  async function guardarRetiro() {
    if (!personalId) { toast("error", "No se encontró tu perfil de personal"); return; }
    if (!vetTexto.trim()) { toast("error", "Indicá la veterinaria"); return; }
    if (!muestras.trim() || parseInt(muestras) < 0) { toast("error", "Ingresá la cantidad de muestras"); return; }
    if (!importe.trim() || parseFloat(importe) < 0) { toast("error", "Ingresá el importe"); return; }
    const hayPago = parseFloat(importe) > 0;
    if (hayPago && !metodoPago) { toast("error", "Seleccioná el tipo de pago"); return; }
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
      veterinaria_texto_original: vetTexto,
      codigo_original: codigo || null,
      cantidad_muestras: parseInt(muestras) || 0,
      importe_declarado: parseFloat(importe) || 0,
      metodo_pago: hayPago ? (metodoPago as MetodoPago) : null,
      comprobante_url: comprobanteUrl,
      comentarios: comentarios || null,
      tipo: "veterinaria" as const,
      urgente,
      estado: "registrado" as const,
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

    const { error } = await supabase.from("retiros").insert(retiro);
    if (error) { toast("error", "Error al guardar: " + error.message); setSavingRetiro(false); return; }

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
    if (!gDesc.trim()) { toast("error", "Indicá una descripción"); return; }
    setSavingGasto(true);

    let comprobanteUrl: string | null = null;
    if (fotoGasto) {
      comprobanteUrl = await uploadComprobante(fotoGasto);
      if (!comprobanteUrl) { setSavingGasto(false); return; }
    }

    const { error } = await supabase.from("gastos").insert({
      personal_id: personalId,
      tipo: gTipo,
      descripcion: gDesc,
      monto: parseFloat(gMonto) || 0,
      fecha_operativa: gFecha,
      comprobante_url: comprobanteUrl,
      estado: "pendiente",
    });

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
        <div className={`flex items-center gap-2 text-[12px] font-medium px-3.5 py-2.5 rounded-[10px] ${isOffline ? "bg-amber/15 text-amber-text" : "bg-g50 text-g700"}`}>
          <span className={`w-2 h-2 rounded-full ${isOffline ? "bg-amber" : "bg-g500"}`} />
          {isOffline ? "Sin conexión · los retiros se guardan en el dispositivo" : "Conectado · sincronización automática"}
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
          {([["retiro", "Nuevo retiro"], ["pedidos", "Pedidos"], ["gastos", "Gastos"]] as [Tab, string][]).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-[8px] text-[12px] font-semibold transition-all ${tab === t ? "bg-white text-g700 shadow-sm" : "text-gy500"}`}>
              {label}
              {t === "pedidos" && pedidos.length > 0 && (
                <span className="ml-1 text-[9px] bg-blue-500 text-white rounded-full px-1.5 py-0.5">{pedidos.length}</span>
              )}
            </button>
          ))}
        </div>

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
                {veterinarias.map((v) => <option key={v.id} value={v.nombre}>{v.codigo}</option>)}
              </datalist>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gy600 mb-1.5">Muestras <span className="text-red-500">*</span></label>
                <input type="number" inputMode="numeric" min="0" required className={`${inputCls} ${bigCls}`} placeholder="0"
                  value={muestras} onChange={(e) => setMuestras(e.target.value)} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gy600 mb-1.5">Importe $ <span className="text-red-500">*</span></label>
                <input type="number" inputMode="decimal" min="0" required className={`${inputCls} ${bigCls}`} placeholder="0"
                  value={importe} onChange={(e) => setImporte(e.target.value)} />
              </div>
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
              const mins = Math.floor((Date.now() - new Date(p.created_at).getTime()) / 60000);
              const hace = `${Math.floor(mins / 60)}h ${mins % 60}m`;
              return (
                <div key={p.id} className="bg-white border border-blue-200 border-l-4 border-l-blue-500 rounded-[12px] px-3.5 py-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[14px] font-semibold text-gy900">{p.veterinaria_nombre}</div>
                    {p.urgente && <span className="text-[9px] font-bold bg-red-500 text-white rounded-full px-2 py-0.5">URGENTE</span>}
                  </div>
                  <div className="text-[11px] text-gy500 mt-1">
                    {p.veterinaria_codigo ? `Código: ${p.veterinaria_codigo} · ` : ""}Hace {hace}
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
                  <button key={val} type="button" onClick={() => setGTipo(val)}
                    className={`flex-1 py-2.5 rounded-[10px] border-2 text-[13px] font-medium transition-all ${gTipo === val ? "bg-purple-600 text-white border-purple-600" : "bg-white text-gy600 border-gy200"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gy600 mb-1.5">Descripción</label>
              <input className={inputCls} placeholder="Ej: Nafta Shell, km 1234..." value={gDesc} onChange={(e) => setGDesc(e.target.value)} />
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
    </div>
  );
}
