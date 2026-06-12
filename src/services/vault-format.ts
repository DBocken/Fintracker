import {
  encryptJsonWithPassword,
  decryptJsonWithPassword,
  type EncryptedEnvelopeV1,
} from './local-crypto';

/**
 * Vault-Dateiformat + Merge-Logik (Issue #36, Epic #22).
 *
 * Ein versioniertes, IMMER AES-GCM-verschlüsseltes Containerformat
 * (`fintracker.vault`). Es gibt bewusst keinen Codepfad, der eine
 * unverschlüsselte Vault-Datei erzeugt: `createVaultFile` verlangt ein
 * Passwort und legt den Payload ausschließlich als verschlüsselte
 * Envelope ab (gleiche Envelope wie verschlüsselte Backups, #30).
 *
 * Die Merge-Funktion ist pur, deterministisch und idempotent — sie wird
 * vom Desktop-Sync (#37) und Android-Sync (#38) gemeinsam genutzt.
 */

export const VAULT_FILE_TYPE = 'fintracker.vault';
export const VAULT_FORMAT_VERSION = 1;

/**
 * Jeder synchronisierbare Datensatz trägt `updated_at`; Löschungen werden
 * als Tombstone (`deleted_at`) synchronisiert statt hart zu verschwinden.
 */
export type SyncRecord = {
  id: string;
  updated_at?: string;
  deleted_at?: string | null;
  [key: string]: unknown;
};

export interface VaultPayload {
  transactions: SyncRecord[];
  accounts: SyncRecord[];
  debts: SyncRecord[];
  /** Forderungsakten (Epic #24) — Feld ist ab v1 reserviert. */
  claims: SyncRecord[];
  categories: SyncRecord[];
  /** Einstellungen als einzelner Datensatz (id: "settings"), gleiche Merge-Regel. */
  settings: SyncRecord | null;
}

export interface VaultFileV1 {
  type: typeof VAULT_FILE_TYPE;
  formatVersion: typeof VAULT_FORMAT_VERSION;
  createdAt: string;
  deviceId: string;
  payload: EncryptedEnvelopeV1;
}

export function emptyVaultPayload(): VaultPayload {
  return { transactions: [], accounts: [], debts: [], claims: [], categories: [], settings: null };
}

// --- Merge-Logik ---------------------------------------------------------

const EPOCH = '1970-01-01T00:00:00.000Z';

function timestampOf(record: SyncRecord): string {
  // Effektiver Zeitstempel: das jüngste bekannte Ereignis des Datensatzes.
  const updated = record.updated_at ?? EPOCH;
  const deleted = record.deleted_at ?? EPOCH;
  return updated >= deleted ? updated : deleted;
}

function isTombstone(record: SyncRecord): boolean {
  return record.deleted_at != null;
}

/**
 * Entscheidet pro ID, welcher Datensatz gewinnt.
 * Regeln (deterministisch, symmetrisch):
 * 1. Der jüngere effektive Zeitstempel gewinnt — ein Update NACH einer
 *    Löschung belebt den Datensatz wieder; ein Tombstone gewinnt über
 *    ältere Updates.
 * 2. Bei exakt gleichem Zeitstempel (Uhren-Drift) gewinnt der Tombstone —
 *    im Zweifel lieber gelöscht lassen als eine Löschung zu verlieren.
 * 3. Sind beide gleichzeitig und gleichartig, entscheidet die stabile
 *    JSON-Repräsentation (totale Ordnung ⇒ merge(a,b) === merge(b,a)).
 */
export function resolveRecord(a: SyncRecord, b: SyncRecord): SyncRecord {
  const ta = timestampOf(a);
  const tb = timestampOf(b);
  if (ta > tb) return a;
  if (tb > ta) return b;

  const aTomb = isTombstone(a);
  const bTomb = isTombstone(b);
  if (aTomb !== bTomb) return aTomb ? a : b;

  return stableStringify(a) >= stableStringify(b) ? a : b;
}

/** JSON mit sortierten Schlüsseln — für deterministische Tie-Breaks. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

/**
 * Merged zwei Datensatz-Listen pro ID. Datensätze ohne ID werden ignoriert
 * (sie können nicht konfliktfrei synchronisiert werden).
 * Ergebnis ist nach ID sortiert ⇒ deterministisch und idempotent.
 */
export function mergeRecords(local: SyncRecord[], remote: SyncRecord[]): SyncRecord[] {
  const byId = new Map<string, SyncRecord>();

  for (const record of [...local, ...remote]) {
    if (!record || typeof record.id !== 'string' || record.id.length === 0) continue;
    const existing = byId.get(record.id);
    byId.set(record.id, existing ? resolveRecord(existing, record) : record);
  }

  return [...byId.values()].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
}

export function mergeVaultPayloads(local: VaultPayload, remote: VaultPayload): VaultPayload {
  const settings =
    local.settings && remote.settings
      ? resolveRecord(local.settings, remote.settings)
      : local.settings ?? remote.settings ?? null;

  return {
    transactions: mergeRecords(local.transactions, remote.transactions),
    accounts: mergeRecords(local.accounts, remote.accounts),
    debts: mergeRecords(local.debts, remote.debts),
    claims: mergeRecords(local.claims, remote.claims),
    categories: mergeRecords(local.categories, remote.categories),
    settings,
  };
}

// --- Datei-Erzeugung & -Verarbeitung --------------------------------------

/**
 * Erzeugt eine Vault-Datei. Der Payload wird IMMER verschlüsselt — ein
 * leeres Passwort wird abgewiesen (kein Klartext-Codepfad).
 */
export async function createVaultFile(
  payload: VaultPayload,
  password: string,
  deviceId: string,
  now: Date = new Date(),
): Promise<VaultFileV1> {
  if (!password) throw new Error('Vault-Dateien sind immer verschlüsselt — Passwort fehlt.');

  return {
    type: VAULT_FILE_TYPE,
    formatVersion: VAULT_FORMAT_VERSION,
    createdAt: now.toISOString(),
    deviceId,
    payload: await encryptJsonWithPassword(payload, password),
  };
}

export function serializeVaultFile(file: VaultFileV1): string {
  return JSON.stringify(file);
}

/**
 * Parst und validiert eine Vault-Datei. Wirft verständliche deutsche
 * Fehler für korrupte Dateien und falsche Formate.
 */
export function parseVaultFile(raw: string): VaultFileV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Die Vault-Datei ist beschädigt (kein gültiges JSON).');
  }

  const file = parsed as Partial<VaultFileV1> | null;
  if (!file || typeof file !== 'object' || file.type !== VAULT_FILE_TYPE) {
    throw new Error('Das ist keine fintracker.vault-Datei.');
  }
  if (file.formatVersion !== VAULT_FORMAT_VERSION) {
    throw new Error(
      `Vault-Format ${String(file.formatVersion)} wird von dieser App-Version nicht unterstützt.`,
    );
  }
  if (!file.payload || (file.payload as { type?: string }).type !== 'ausgabentracker.enc') {
    throw new Error('Die Vault-Datei ist beschädigt (verschlüsselter Inhalt fehlt).');
  }

  return file as VaultFileV1;
}

/** Entschlüsselt den Vault-Payload. Falsches Passwort ⇒ „Falsches Passwort". */
export async function openVaultFile(file: VaultFileV1, password: string): Promise<VaultPayload> {
  const payload = await decryptJsonWithPassword<Partial<VaultPayload>>(file.payload, password);

  // Defensiv normalisieren — ältere/fremde Dateien könnten Felder weglassen.
  return {
    transactions: Array.isArray(payload.transactions) ? payload.transactions : [],
    accounts: Array.isArray(payload.accounts) ? payload.accounts : [],
    debts: Array.isArray(payload.debts) ? payload.debts : [],
    claims: Array.isArray(payload.claims) ? payload.claims : [],
    categories: Array.isArray(payload.categories) ? payload.categories : [],
    settings: payload.settings ?? null,
  };
}
