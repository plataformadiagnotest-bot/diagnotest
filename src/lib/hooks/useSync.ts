"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useOffline } from "./useOffline";
import { processSyncQueue } from "../offline/sync-queue";
import { getSyncQueue } from "../offline/indexeddb";

export function useSync() {
  const { isOnline } = useOffline();
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  // Guarda contra reentradas sin meter `isSyncing` en las deps del callback
  // (eso creaba un bucle: cada cambio de isSyncing recreaba `sync` y el efecto
  //  lo volvía a disparar, haciendo titilar el indicador).
  const syncingRef = useRef(false);

  const refreshPending = useCallback(async () => {
    const queue = await getSyncQueue();
    setPendingCount(queue.length);
  }, []);

  const sync = useCallback(async () => {
    if (syncingRef.current) return 0;
    if (typeof navigator !== "undefined" && !navigator.onLine) return 0;
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      const count = await processSyncQueue();
      if (count > 0) setLastSynced(count);
      await refreshPending();
      return count;
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [refreshPending]);

  useEffect(() => {
    refreshPending();
  }, [refreshPending]);

  // Sincroniza una sola vez al reconectarse (cuando isOnline pasa a true).
  useEffect(() => {
    if (isOnline) sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  return { pendingCount, isSyncing, lastSynced, sync, refreshPending };
}
