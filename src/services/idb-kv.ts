/**
 * Minimaler IndexedDB-Key-Value-Speicher (Issue #29).
 *
 * Ersetzt localStorage als Primärspeicher für die (verschlüsselten) Finanzdaten:
 * kein ~5-MB-Limit, robuster gegen Browser-Eviction und performant bei tausenden
 * Transaktionen. Bewusst ohne externe Abhängigkeit (rohes IndexedDB).
 *
 * Gespeichert werden – wie zuvor in localStorage – fertige JSON-Strings
 * (Klartext oder verschlüsselte Envelopes). Die Verschlüsselungsschicht in
 * local-crypto.ts bleibt unverändert davor.
 */

const DB_NAME = "ausgabentracker";
const STORE_NAME = "kv";
const DB_VERSION = 1;

function isIndexedDbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);
        const request = run(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

export async function idbGet(key: string): Promise<string | null> {
  if (!isIndexedDbAvailable()) return null;
  const value = await tx<string | undefined>("readonly", (store) => store.get(key));
  return value ?? null;
}

export async function idbSet(key: string, value: string): Promise<void> {
  if (!isIndexedDbAvailable()) return;
  await tx("readwrite", (store) => store.put(value, key));
}

export async function idbRemove(key: string): Promise<void> {
  if (!isIndexedDbAvailable()) return;
  await tx("readwrite", (store) => store.delete(key));
}

export async function idbKeys(): Promise<string[]> {
  if (!isIndexedDbAvailable()) return [];
  const keys = await tx<IDBValidKey[]>("readonly", (store) => store.getAllKeys());
  return keys.map((k) => String(k));
}

/** Leert den gesamten KV-Store (für Datenlöschung, Issues #31/#32). */
export async function clearLocalKvStore(): Promise<void> {
  if (!isIndexedDbAvailable()) return;
  await tx("readwrite", (store) => store.clear());
}

/**
 * Fordert persistenten Speicher an, damit der Browser die Finanzdaten nicht
 * bei Speicherdruck verwirft. Liefert true, wenn Persistenz gewährt ist.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
