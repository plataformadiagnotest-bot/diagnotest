"use client";

import { useEffect, useState } from "react";

// Detecta cuando hay un service worker nuevo (deploy nuevo) y muestra un
// cartel para actualizar al instante, sin pedirle al usuario que cierre y
// reabra la app. El SW ya usa skipWaiting + clientsClaim, así que la versión
// nueva se activa sola; acá solo avisamos y recargamos la pantalla abierta.
export function UpdatePrompt() {
  const [hayUpdate, setHayUpdate] = useState(false);
  const [recargando, setRecargando] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    let reg: ServiceWorkerRegistration | null = null;
    let cancelado = false;

    const marcarSiEsUpdate = (sw: ServiceWorker | null) => {
      if (!sw) return;
      const evaluar = () => {
        // "installed" + ya hay un controller => es una actualización
        // (no la primera instalación), así que avisamos.
        if (sw.state === "installed" && navigator.serviceWorker.controller && !cancelado) {
          setHayUpdate(true);
        }
      };
      evaluar();
      sw.addEventListener("statechange", evaluar);
    };

    const onUpdateFound = () => marcarSiEsUpdate(reg?.installing ?? null);

    navigator.serviceWorker.getRegistration().then((r) => {
      if (!r || cancelado) return;
      reg = r;
      // Por si quedó uno esperando de un ciclo anterior.
      if (r.waiting && navigator.serviceWorker.controller) setHayUpdate(true);
      r.addEventListener("updatefound", onUpdateFound);
    });

    // Busca actualizaciones cada tanto y cada vez que la app vuelve al frente.
    const buscar = () =>
      navigator.serviceWorker.getRegistration().then((r) => r?.update().catch(() => {}));
    const intervalo = setInterval(buscar, 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") buscar(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelado = true;
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", onVisible);
      reg?.removeEventListener("updatefound", onUpdateFound);
    };
  }, []);

  if (!hayUpdate) return null;

  return (
    <div className="fixed bottom-4 inset-x-3 z-[60] mx-auto max-w-[440px] flex items-center gap-3 bg-g800 text-white rounded-[12px] px-4 py-3 shadow-lg">
      <i className="ti ti-rocket text-[18px] shrink-0" />
      <span className="flex-1 text-[13px] font-medium leading-snug">
        Hay una versión nueva de Diagnotest
      </span>
      <button
        onClick={() => { setRecargando(true); window.location.reload(); }}
        disabled={recargando}
        className="shrink-0 bg-white text-g800 text-[12px] font-bold rounded-[8px] px-3 py-1.5 disabled:opacity-60"
      >
        {recargando ? "Actualizando…" : "Actualizar"}
      </button>
    </div>
  );
}
