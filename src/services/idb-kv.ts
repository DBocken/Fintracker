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
 * Bulk-Datenschlüssel, die früher in localStorage lagen und nach IndexedDB
 * migriert werden. Kleine Metadaten/UI-Schlüssel (Verschlüsselungs-Config,
 * Anonym-Flag, device_id, KPI-Caches …) bleiben bewusst in localStorage.
 */
export const IDB_DATA_KEYS: readonly string[] = [
  "ausgabentracker_transactions_v3",
  "ausgabentracker_accounts_v1",
  "ausgabentracker_debts_v1",
  "ausgabentracker_debt_assignments_v1",
  "ausgabentracker_portfolios_v1",
  "ausgabentracker_portfolio_positions_v1",
  "ausgabentracker_bank_connections_v1",
  "ausgabentracker_categories_v1",
  "ausgabentracker_user_settings_v1",
];

export const IDB_DATA_KEY_PREFIXES: readonly string[] = ["ausgabentracker_transactions_v2__"];

/** Sammelt vorhandene Legacy-Datenschlüssel aus localStorage. */
export function collectLegacyDataKeys(): string[] {
  if (typeof localStorage === "undefined") return [];
  const found = new Set<string>();
  for (const key of IDB_DATA_KEYS) {
    if (localStorage.getItem(key) != null) found.add(key);
  }
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && IDB_DATA_KEY_PREFIXES.some((p) => k.startsWith(p))) found.add(k);
  }
  return [...found];
}

/**
 * Einmalige Migration der Bulk-Daten von localStorage nach IndexedDB.
 * Verifiziert jeden Wert nach dem Schreiben und löscht die localStorage-Kopie
 * erst danach. Idempotent: bereits migrierte Schlüssel werden übersprungen.
 *
 * @returns Anzahl tatsächlich migrierter Schlüssel
 */
export async function migrateLocalStorageToIdb(): Promise<number> {
  if (!isIndexedDbAvailable() || typeof localStorage === "undefined") return 0;

  let migrated = 0;
  for (const key of collectLegacyDataKeys()) {
    const raw = localStorage.getItem(key);
    if (raw == null) continue;

    // Schon in IndexedDB vorhanden: localStorage-Kopie ist veraltet, verwerfen.
    const existing = await idbGet(key);
    if (existing != null) {
      localStorage.removeItem(key);
      continue;
    }

    await idbSet(key, raw);
    const verify = await idbGet(key);
    if (verify === raw) {
      localStorage.removeItem(key);
      migrated += 1;
    }
  }
  return migrated;
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
