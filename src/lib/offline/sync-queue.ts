"use client";

import {
  getSyncQueue,
  removeSyncQueueItem,
  incrementSyncAttempts,
} from "./indexeddb";

const MAX_ATTEMPTS = 5;

export async function processSyncQueue(
  onProgress?: (synced: number, total: number) => void
): Promise<number> {
  const queue = await getSyncQueue();
  if (queue.length === 0) return 0;

  let synced = 0;

  for (const item of queue) {
    if (item.attempts >= MAX_ATTEMPTS) {
      await removeSyncQueueItem(item.id);
      continue;
    }

    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });

      if (res.ok) {
        await removeSyncQueueItem(item.id);
        synced++;
        onProgress?.(synced, queue.length);
      } else {
        await incrementSyncAttempts(item.id);
      }
    } catch {
      await incrementSyncAttempts(item.id);
    }
  }

  return synced;
}
