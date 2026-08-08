import { t } from '../i18n/serviceT';
import { LocalEncryptionLockedError, VaultCorruptError, localEncryption } from './local-crypto';
// Key-Definitionen leben zentral in local-storage-keys (VE-6), damit die
// Verschlüsselungs-Migration keine Kollektion übersehen kann. Re-Export hält
// bestehende Importe (`from './local-finance-store'`) funktionsfähig.
import { LOCAL_FINANCE_KEYS, type LocalFinanceKey } from './local-storage-keys';
import { StoreVersionTooNewError, checkStoreCompatibility } from '@/lib/store-compatibility';

export { LOCAL_FINANCE_KEYS };
export type { LocalFinanceKey };

/**
 * Schema-Version des lokalen Finanzspeichers. Wird erhöht, sobald bestehende
 * Datenstrukturen migrationsbedürftig erweitert werden. Reine Neuanlage weiterer
 * Collections braucht keine Migration. Alles bleibt strikt lokal.
 *
 * **WP-11.3: Diese Konstante wird jetzt tatsächlich benutzt.** Bis dahin stand
 * hier nur die Absicht („damit ein späterer Migrationshook erkennt, ob er
 * laufen muss") — gelesen oder geschrieben hat sie niemand. Für Phase 11 ist
 * das der Unterschied zwischen einem Rollback und einem Datenverlust: Wird eine
 * Auslieferung zurückgenommen, trifft eine ältere App auf neuere Daten und
 * schreibt beim Speichern alles weg, was sie nicht versteht.
 */
export const LOCAL_STORE_SCHEMA_VERSION = 2;
export const LOCAL_STORE_SCHEMA_VERSION_KEY = 'ausgabentracker_store_schema_version';

/**
 * Prüft vor JEDEM Zugriff, ob diese App die vorgefundene Ablage überhaupt
 * verstehen darf — und schreibt die eigene Version fest, sobald sie es tut.
 *
 * Bewusst hier und nicht in einem einmaligen Start-Hook: Ein Rollback passiert
 * nicht beim Start, sondern zwischen zwei Besuchen. Ein Hook, der beim letzten
 * Start lief, hätte die Antwort von gestern.
 */
function assertCompatibleStore() {
  const compatibility = checkStoreCompatibility(
    localStorage.getItem(LOCAL_STORE_SCHEMA_VERSION_KEY),
    LOCAL_STORE_SCHEMA_VERSION,
  );

  if (compatibility.status === 'refuse') {
    throw new StoreVersionTooNewError(compatibility.stored, compatibility.supported);
  }

  // `migrate` und `ok` schreiben beide fest, was diese App versteht. Eine
  // eigene Migrationsstufe gibt es (noch) nicht — sobald es sie gibt, ist das
  // hier ihr Aufhänger, und der Zweig ist bereits benannt.
  if (compatibility.status === 'migrate') {
    localStorage.setItem(LOCAL_STORE_SCHEMA_VERSION_KEY, String(LOCAL_STORE_SCHEMA_VERSION));
  }
}

function assertClientStorage() {
  if (typeof window === 'undefined') {
    throw new Error(t('localFinanceStore.clientOnly', 'Lokale Finanzdaten können nur im Client verarbeitet werden.'));
  }
  assertCompatibleStore();
}

export async function readLocalFinanceList<T>(key: LocalFinanceKey): Promise<T[]> {
  assertClientStorage();
  if (localEncryption.isEnabled() && !localEncryption.isUnlocked()) {
    throw new LocalEncryptionLockedError();
  }

  const storageKey = LOCAL_FINANCE_KEYS[key];
  const data = await localEncryption.loadAndMaybeDecrypt<T[]>(storageKey);
  if (data === null) return [];
  // `null` heisst „Key existiert nicht" (echter Leerzustand). Gültiges JSON,
  // das kein Array ist, ist dagegen ein beschädigter Bestand (RES-1) — würde
  // hier stillschweigend `[]` zurückkommen, überschriebe der nächste Schreib-
  // vorgang (Read-Modify-Write in upsertLocalFinanceItem) die Collection.
  if (!Array.isArray(data)) throw new VaultCorruptError(storageKey);
  return data;
}

export async function writeLocalFinanceList<T>(key: LocalFinanceKey, items: T[]): Promise<void> {
  assertClientStorage();
  if (localEncryption.isEnabled() && !localEncryption.isUnlocked()) {
    throw new LocalEncryptionLockedError();
  }

  await localEncryption.encryptAndStore(LOCAL_FINANCE_KEYS[key], items);
}

export async function upsertLocalFinanceItem<T extends { id?: string }>(
  key: LocalFinanceKey,
  item: T,
): Promise<T & { id: string }> {
  const items = await readLocalFinanceList<T & { id: string }>(key);
  const id = item.id || crypto.randomUUID();
  const now = new Date().toISOString();
  const nextItem = {
    ...item,
    id,
    updated_at: (item as T & { updated_at?: string }).updated_at ?? now,
    created_at: (item as T & { created_at?: string }).created_at ?? now,
  } as T & { id: string };

  const index = items.findIndex((entry) => entry.id === id);
  if (index >= 0) {
    items[index] = { ...items[index], ...nextItem };
  } else {
    items.push(nextItem);
  }

  await writeLocalFinanceList(key, items);
  return nextItem;
}

export async function updateLocalFinanceItem<T extends { id?: string }>(
  key: LocalFinanceKey,
  id: string,
  updates: Partial<T>,
): Promise<T> {
  const items = await readLocalFinanceList<T>(key);
  const index = items.findIndex((entry) => entry.id === id);
  if (index < 0) throw new Error(t('localFinanceStore.recordNotFound', 'Datensatz nicht gefunden'));

  const updated = {
    ...items[index],
    ...updates,
    id,
    updated_at: new Date().toISOString(),
  } as T;
  items[index] = updated;
  await writeLocalFinanceList(key, items);
  return updated;
}

export async function deleteLocalFinanceItem<T extends { id?: string }>(
  key: LocalFinanceKey,
  id: string,
): Promise<void> {
  const items = await readLocalFinanceList<T>(key);
  await writeLocalFinanceList(key, items.filter((entry) => entry.id !== id));
}

function isPlaintextRaw(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    return parsed?.type !== 'ausgabentracker.enc';
  } catch {
    return true;
  }
}

/**
 * Prüft, ob Finanzdaten unverschlüsselt vorliegen. Liest IndexedDB (Issue #29)
 * und berücksichtigt einen evtl. noch vorhandenen localStorage-Altbestand.
 */
export async function hasPlaintextFinanceStorage(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const { idbGet } = await import('./idb-kv');
  for (const storageKey of Object.values(LOCAL_FINANCE_KEYS)) {
    const fromIdb = await idbGet(storageKey);
    if (isPlaintextRaw(fromIdb)) return true;
    if (fromIdb == null && isPlaintextRaw(readLegacyLocalStorage(storageKey))) return true;
  }
  return false;
}

/**
 * [REGRESSION] Liest `localStorage` mit eigener Verfügbarkeitsprüfung.
 *
 * Die Prüfung am Anfang von {@link hasPlaintextFinanceStorage} ist nach dem
 * ersten `await` nicht mehr gültig: Die Umgebung kann in der Zwischenzeit
 * verschwunden sein. In der Testumgebung passiert genau das, wenn die Abfrage
 * eine Testdatei überlebt — jsdom ist dann abgebaut, und der Zugriff wirft
 * `ReferenceError: localStorage is not defined` als unbehandelte Rejection.
 * Der Testlauf war dadurch rot, obwohl alle 4602 Tests grün waren.
 *
 * Dieselbe Klasse Fehler entsteht ausserhalb von Tests, wenn ein Tab während
 * der Abfrage geschlossen wird. Die Antwort ist nicht, den Aufrufer zu
 * disziplinieren, sondern die Prüfung dorthin zu ziehen, wo der Zugriff
 * stattfindet — so wie `idb-kv.ts` es bereits tut.
 */
function readLegacyLocalStorage(storageKey: string): string | null {
  // `try` und nicht nur `typeof`: Der Zugriff selbst kann werfen, wenn der
  // Speicher gesperrt ist (Safari im privaten Modus, blockierte Cookies) — dort
  // ist die Eigenschaft vorhanden und der Zugriff darauf ein `SecurityError`.
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(storageKey);
  } catch {
    // Kein Altbestand lesbar heisst hier „kein Klartext gefunden". Die Frage,
    // die diese Funktion beantwortet, ist eine Warnung an den Nutzer — sie
    // darf nicht die App anhalten.
    return null;
  }
}

export async function getLocalFinanceStorageStatus() {
  if (typeof window === 'undefined') {
    return { encrypted: false, unlocked: false, plaintextFound: false };
  }

  return {
    encrypted: localEncryption.isEnabled(),
    unlocked: localEncryption.isUnlocked(),
    plaintextFound: await hasPlaintextFinanceStorage(),
  };
}
