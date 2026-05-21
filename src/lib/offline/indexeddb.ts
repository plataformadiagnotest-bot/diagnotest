import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { RetiroOffline, SyncQueueItem } from "@/types";

interface DiagnotestDB extends DBSchema {
  retiros: {
    key: string;
    value: RetiroOffline;
    indexes: { by_personal: string; by_fecha: string };
  };
  sync_queue: {
    key: string;
    value: SyncQueueItem;
    indexes: { by_timestamp: number };
  };
  pedidos_cache: {
    key: string;
    value: Record<string, unknown>;
  };
  gastos_cache: {
    key: string;
    value: Record<string, unknown>;
  };
}

let db: IDBPDatabase<DiagnotestDB> | null = null;

export async function getDB() {
  if (db) return db;

  db = await openDB<DiagnotestDB>("diagnotest-offline", 1, {
    upgrade(database) {
      const retiros = database.createObjectStore("retiros", { keyPath: "id" });
      retiros.createIndex("by_personal", "personal_id");
      retiros.createIndex("by_fecha", "fecha_operativa");

      const queue = database.createObjectStore("sync_queue", { keyPath: "id" });
      queue.createIndex("by_timestamp", "timestamp");

      database.createObjectStore("pedidos_cache", { keyPath: "id" });
      database.createObjectStore("gastos_cache", { keyPath: "id" });
    },
  });

  return db;
}

export async function saveRetiroOffline(retiro: RetiroOffline) {
  const database = await getDB();
  await database.put("retiros", { ...retiro, _offline: true });
}

export async function getRetirosOffline(personalId?: string): Promise<RetiroOffline[]> {
  const database = await getDB();
  if (personalId) {
    return database.getAllFromIndex("retiros", "by_personal", personalId);
  }
  return database.getAll("retiros");
}

export async function deleteRetiroOffline(id: string) {
  const database = await getDB();
  await database.delete("retiros", id);
}

export async function addToSyncQueue(item: Omit<SyncQueueItem, "attempts">) {
  const database = await getDB();
  await database.put("sync_queue", { ...item, attempts: 0 });
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const database = await getDB();
  return database.getAllFromIndex("sync_queue", "by_timestamp");
}

export async function removeSyncQueueItem(id: string) {
  const database = await getDB();
  await database.delete("sync_queue", id);
}

export async function incrementSyncAttempts(id: string) {
  const database = await getDB();
  const item = await database.get("sync_queue", id);
  if (item) {
    await database.put("sync_queue", { ...item, attempts: item.attempts + 1 });
  }
}
