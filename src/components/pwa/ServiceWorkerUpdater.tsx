"use client";

import { useEffect } from "react";

/**
 * Mantiene la PWA siempre actualizada:
 * - Pide al navegador que chequee si hay un service worker nuevo (al cargar,
 *   al volver a la pestaña y cada 60s).
 * - Cuando el SW nuevo toma el control, recarga la página una sola vez,
 *   evitando que el usuario quede atrapado en una versión vieja en caché.
 */
export function ServiceWorkerUpdater() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    let reloaded = false;
    const onControllerChange = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const checkForUpdate = async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) return;
        await reg.update();
        // Si ya hay uno esperando, activarlo de inmediato
        if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
      } catch {
        /* sin conexión u otro error: se reintenta luego */
      }
    };

    checkForUpdate();
    const onVisible = () => document.visibilityState === "visible" && checkForUpdate();
    document.addEventListener("visibilitychange", onVisible);
    const interval = setInterval(checkForUpdate, 60_000);

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(interval);
    };
  }, []);

  return null;
}
