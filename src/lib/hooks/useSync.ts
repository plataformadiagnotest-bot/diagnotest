"use client";

import { useState, useEffect, useCallback } from "react";
import { useOffline } from "./useOffline";
import { processSyncQueue } from "../offline/sync-queue";
import { getSyncQueue } from "../offline/indexeddb";

export function useSync() {
  const { isOnline } = useOffline();
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<number | null>(null);

  const refreshPending = useCallback(async () => {
    const queue = await getSyncQueue();
    setPendingCount(queue.length);
  }, []);

  const sync = useCallback(async () => {
    if (!isOnline || isSyncing) return 0;
    setIsSyncing(true);
    try {
      const count = await processSyncQueue();
      if (count > 0) setLastSynced(count);
      await refreshPending();
      return count;
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, refreshPending]);

  useEffect(() => {
    refreshPending();
  }, [refreshPending]);

  useEffect(() => {
    if (isOnline) {
      sync();
    }
  }, [isOnline, sync]);

  return { pendingCount, isSyncing, lastSynced, sync, refreshPending };
}
