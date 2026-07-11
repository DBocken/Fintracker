import { idbGet, idbSet, idbRemove } from './idb-kv';
import { redactSensitive } from '@/utils/redact';

/**
 * Lokales Fehlerprotokoll (Ring-Buffer) im IndexedDB-KV-Store.
 *
 * Bewusst NICHT verschlüsselt und NICHT in IDB_DATA_KEYS: Fehler passieren
 * auch vor dem Entsperren der lokalen Verschlüsselung und müssen dann noch
 * protokollierbar/lesbar sein. Genau deshalb ist Redaktion-beim-Schreiben
 * (redactSensitive über ALLE Stringfelder) hier Pflicht, nicht Kür.
 *
 * Es gibt keinerlei Netzwerk-Pfad: das Protokoll verlässt das Gerät nur, wenn
 * der Nutzer es in den Einstellungen aktiv kopiert/exportiert.
 */

export const ERROR_LOG_KEY = 'ausgabentracker_error_log_v1';
export const MAX_ERROR_LOG_ENTRIES = 100;

// Identische Fehler innerhalb dieses Fensters werden zu count kollabiert,
// damit Render-/Retry-Schleifen das Protokoll nicht fluten.
const DEDUPE_WINDOW_MS = 30_000;

export type ErrorLogSource = 'boundary' | 'window' | 'promise' | 'manual';

export interface ErrorLogEntry {
  id: string;
  timestamp: string;
  level: 'warn' | 'error';
  source: ErrorLogSource;
  message: string;
  stack?: string;
  url?: string;
  userAgent?: string;
  context?: Record<string, unknown>;
  count: number;
}

export interface ErrorLogInput {
  level: 'warn' | 'error';
  source: ErrorLogSource;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
}

function hasLocalStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

async function readRaw(): Promise<string | null> {
  const fromIdb = await idbGet(ERROR_LOG_KEY);
  if (fromIdb != null) return fromIdb;
  // Fallback für Umgebungen ohne IndexedDB (idbGet liefert dort null).
  return hasLocalStorage() ? localStorage.getItem(ERROR_LOG_KEY) : null;
}

async function writeRaw(value: string): Promise<void> {
  await idbSet(ERROR_LOG_KEY, value);
  if ((await idbGet(ERROR_LOG_KEY)) == null && hasLocalStorage()) {
    localStorage.setItem(ERROR_LOG_KEY, value);
  }
}

function parseEntries(raw: string | null): ErrorLogEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function getErrorLog(): Promise<ErrorLogEntry[]> {
  return parseEntries(await readRaw());
}

export async function appendErrorLogEntry(input: ErrorLogInput): Promise<void> {
  try {
    const entries = await getErrorLog();
    const now = Date.now();

    const message = redactSensitive(input.message);
    const stack = input.stack ? redactSensitive(input.stack) : undefined;

    const last = entries[entries.length - 1];
    if (
      last &&
      last.message === message &&
      last.stack === stack &&
      now - Date.parse(last.timestamp) < DEDUPE_WINDOW_MS
    ) {
      last.count += 1;
      last.timestamp = new Date(now).toISOString();
      await writeRaw(JSON.stringify(entries));
      return;
    }

    entries.push({
      id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date(now).toISOString(),
      level: input.level,
      source: input.source,
      message,
      stack,
      url: typeof window !== 'undefined' ? redactSensitive(window.location.href) : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      context: input.context,
      count: 1,
    });

    await writeRaw(JSON.stringify(entries.slice(-MAX_ERROR_LOG_ENTRIES)));
  } catch {
    // Protokollieren darf nie selbst zum Fehler werden.
  }
}

export async function clearErrorLog(): Promise<void> {
  await idbRemove(ERROR_LOG_KEY);
  if (hasLocalStorage()) localStorage.removeItem(ERROR_LOG_KEY);
}

export async function exportErrorLogAsJson(): Promise<string> {
  const entries = await getErrorLog();
  return JSON.stringify({ exportedAt: new Date().toISOString(), entries }, null, 2);
}

/**
 * Einmaliger Import des alten localStorage-Protokolls ('error_log', max. 10
 * Einträge aus dem früheren ErrorBoundary-Stub). Idempotent: der Legacy-Key
 * wird nach dem Import (auch bei kaputtem JSON) entfernt.
 *
 * @returns Anzahl importierter Einträge
 */
export async function migrateLegacyErrorLog(): Promise<number> {
  if (!hasLocalStorage()) return 0;
  const raw = localStorage.getItem('error_log');
  if (raw == null) return 0;
  localStorage.removeItem('error_log');

  let legacy: Array<{ message?: string; stack?: string; timestamp?: string }> = [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) legacy = parsed;
  } catch {
    return 0;
  }

  let imported = 0;
  for (const item of legacy) {
    if (!item || typeof item.message !== 'string') continue;
    await appendErrorLogEntry({
      level: 'error',
      source: 'boundary',
      message: item.message,
      stack: typeof item.stack === 'string' ? item.stack : undefined,
    });
    imported += 1;
  }
  return imported;
}
