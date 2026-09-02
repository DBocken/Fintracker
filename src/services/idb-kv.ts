import { ENCRYPTED_STORAGE_KEYS } from './local-storage-keys';
import {
  IndexedDbUnavailableError,
  isQuotaExceededError,
  StorageQuotaExceededError,
} from '@/lib/storage-errors';

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
    }).catch((error: unknown) => {
      // RES-6: Ein fehlgeschlagener Erstaufruf darf den KV-Store nicht
      // dauerhaft totlegen. Ohne dieses Verwerfen bleibt `dbPromise` das
      // abgelehnte Promise für die gesamte Session — jeder spätere Zugriff
      // scheitert sofort wieder, ohne dass IndexedDB je einen zweiten Versuch
      // bekommt. Der nächste Aufruf von `openDb()` startet dadurch neu.
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb()
    .then(
      (db) =>
        new Promise<T>((resolve, reject) => {
          const transaction = db.transaction(STORE_NAME, mode);
          const store = transaction.objectStore(STORE_NAME);
          const request = run(store);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        }),
    )
    .catch((error: unknown) => {
      // RES-6: Ein voller Speicher wirft sonst eine rohe DOMException bis zur
      // Oberfläche durch. Übersetzt in einen typisierten Fehler mit
      // Handlungsoption (Backup exportieren / Daten aufräumen) statt eines
      // technischen Browser-Brockens.
      if (isQuotaExceededError(error)) throw new StorageQuotaExceededError(error);
      throw error;
    });
}

export async function idbGet(key: string): Promise<string | null> {
  if (!isIndexedDbAvailable()) return null;
  const value = await tx<string | undefined>("readonly", (store) => store.get(key));
  return value ?? null;
}

export async function idbSet(key: string, value: string): Promise<void> {
  // Kein stilles No-op mehr (Audit 2026-09, WP7): Wer schreibt, muss erfahren,
  // dass nicht geschrieben wurde. Lesen (`idbGet`/`idbKeys`) darf weiterhin
  // leer zurückkommen — nichts gespeichert ist nichts zu lesen.
  if (!isIndexedDbAvailable()) throw new IndexedDbUnavailableError();
  await tx("readwrite", (store) => store.put(value, key));
}

export async function idbRemove(key: string): Promise<void> {
  if (!isIndexedDbAvailable()) throw new IndexedDbUnavailableError();
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
export const IDB_DATA_KEYS: readonly string[] = ENCRYPTED_STORAGE_KEYS;

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

/** Kleines UI-Flag (kein Finanzdatum) — bleibt bewusst in localStorage. */
const PERSISTENCE_DENIED_KEY = "ausgabentracker_persistent_storage_denied_v1";

/**
 * RES-7: `requestPersistentStorage()` wurde bisher fire-and-forget aufgerufen
 * (`void requestPersistentStorage()` in local-crypto.ts) — der Rückgabewert
 * ging verloren, eine Verweigerung blieb unbemerkt. Diese Variante wertet ihn
 * aus und merkt eine Verweigerung als kleines Flag, das eine ruhige Fläche
 * (Backup-Einstellungen) lesen kann. Kein Dauerbanner: Der Nutzer kann die
 * Browser-Entscheidung ohnehin nicht beeinflussen, er soll nur wissen, dass
 * ein aktuelles Backup dadurch wichtiger ist als sonst.
 */
export async function requestAndRecordPersistentStorage(): Promise<boolean> {
  const granted = await requestPersistentStorage();
  if (typeof localStorage !== "undefined") {
    if (granted) localStorage.removeItem(PERSISTENCE_DENIED_KEY);
    else localStorage.setItem(PERSISTENCE_DENIED_KEY, "1");
  }
  return granted;
}

/** Liest das von {@link requestAndRecordPersistentStorage} gesetzte Flag. */
export function isPersistentStorageDenied(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(PERSISTENCE_DENIED_KEY) === "1";
}
