"use client";

import { useOffline } from "@/lib/hooks/useOffline";
import { useSync } from "@/lib/hooks/useSync";
import { useEffect } from "react";
import { toast } from "@/components/ui/ToastNotification";

export function SyncIndicator() {
  const { isOffline } = useOffline();
  const { pendingCount, isSyncing, lastSynced } = useSync();

  useEffect(() => {
    if (lastSynced && lastSynced > 0) {
      toast("success", `${lastSynced} registro${lastSynced > 1 ? "s" : ""} sincronizado${lastSynced > 1 ? "s" : ""} ✓`);
    }
  }, [lastSynced]);

  if (isOffline) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-orange-50 border border-orange-200 text-[11px] font-medium text-orange-700">
        <span className="w-2 h-2 rounded-full bg-orange-400" />
        Sin conexión · {pendingCount} pendiente{pendingCount !== 1 ? "s" : ""}
      </div>
    );
  }

  if (isSyncing) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-blue-50 border border-blue-200 text-[11px] font-medium text-blue-700">
        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
        Sincronizando…
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-amber-bg border border-amber text-[11px] font-medium text-amber-text">
        <span className="w-2 h-2 rounded-full bg-amber" />
        {pendingCount} sin sincronizar
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-g50 border border-g100 text-[11px] font-medium text-g700">
      <span className="w-2 h-2 rounded-full bg-g500" />
      Conectado
    </div>
  );
}

export function OfflineBanner() {
  const { isOffline } = useOffline();
  if (!isOffline) return null;

  return (
    <div className="bg-orange-500 text-white text-center text-xs py-1.5 font-medium">
      Modo sin conexión — los cambios se guardan localmente y se sincronizarán al reconectarse
    </div>
  );
}
