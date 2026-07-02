import { LocalEncryptionLockedError, localEncryption } from './local-crypto';
// Key-Definitionen leben zentral in local-storage-keys (VE-6), damit die
// Verschlüsselungs-Migration keine Kollektion übersehen kann. Re-Export hält
// bestehende Importe (`from './local-finance-store'`) funktionsfähig.
import { LOCAL_FINANCE_KEYS, type LocalFinanceKey } from './local-storage-keys';

export { LOCAL_FINANCE_KEYS };
export type { LocalFinanceKey };

/**
 * Schema-Version des lokalen Finanzspeichers. Wird erhöht, sobald bestehende
 * Datenstrukturen migrationsbedürftig erweitert werden. Reine Neuanlage weiterer
 * Collections braucht keine Migration. Der Wert wird lokal persistiert, damit ein
 * späterer Migrationshook erkennt, ob er laufen muss. Alles bleibt strikt lokal.
 */
export const LOCAL_STORE_SCHEMA_VERSION = 2;
export const LOCAL_STORE_SCHEMA_VERSION_KEY = 'ausgabentracker_store_schema_version';

function assertClientStorage() {
  if (typeof window === 'undefined') {
    throw new Error('Lokale Finanzdaten können nur im Client verarbeitet werden.');
  }
}

export async function readLocalFinanceList<T>(key: LocalFinanceKey): Promise<T[]> {
  assertClientStorage();
  if (localEncryption.isEnabled() && !localEncryption.isUnlocked()) {
    throw new LocalEncryptionLockedError();
  }

  const data = await localEncryption.loadAndMaybeDecrypt<T[]>(LOCAL_FINANCE_KEYS[key]);
  return Array.isArray(data) ? data : [];
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
  if (index < 0) throw new Error('Datensatz nicht gefunden');

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
    if (fromIdb == null && isPlaintextRaw(localStorage.getItem(storageKey))) return true;
  }
  return false;
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
