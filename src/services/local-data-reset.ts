/**
 * Vollständiges Löschen aller lokalen App-Daten auf diesem Gerät.
 *
 * Gemeinsam genutzt vom Logout-Datenhinweis (Issue #32) und vom
 * DSGVO-Löschflow (Issue #31). Entfernt sämtliche `ausgabentracker_*`-Schlüssel
 * – Finanzdaten, Kategorien, Einstellungen, Transaktions-Cache, Anonym-Flag und
 * (optional) die lokale Verschlüsselungs-Konfiguration.
 *
 * Async, damit später der IndexedDB-Speicher (Issue #29) ohne Signaturänderung
 * mitberücksichtigt werden kann.
 */

const APP_STORAGE_PREFIX = "ausgabentracker_";

/** Sammelt alle App-eigenen localStorage-Schlüssel. */
function appStorageKeys(): string[] {
  if (typeof localStorage === "undefined") return [];
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(APP_STORAGE_PREFIX)) keys.push(k);
  }
  return keys;
}

export async function clearAllLocalData(): Promise<void> {
  if (typeof window === "undefined") return;

  for (const key of appStorageKeys()) {
    localStorage.removeItem(key);
  }

  // IndexedDB-Finanzspeicher (Issue #29) ebenfalls leeren, falls vorhanden.
  try {
    const { clearLocalKvStore } = await import("./idb-kv");
    await clearLocalKvStore();
  } catch {
    // idb-kv noch nicht vorhanden oder IndexedDB nicht verfügbar – ignorieren.
  }
}
