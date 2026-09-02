import { localEncryption, type EncryptedEnvelopeV1 } from './local-crypto';
import { LOCAL_FINANCE_KEYS } from './local-finance-store';
import { idbGet, idbSet } from './idb-kv';
import { LOCAL_CATEGORIES_KEY, LOCAL_SETTINGS_KEY } from './local-settings-service';
import { t } from '../i18n/serviceT';
import { z } from 'zod';
import type { SnapshotStandInfo, SnapshotVersionComparison } from '@/lib/snapshot-comparison';

const DEVICE_ID_KEY = 'ausgabentracker_device_id_v1';
const SYNC_PATHS_KEY = 'ausgabentracker_sync_paths_v1';
const SNAPSHOT_VERSION_KEY = 'ausgabentracker_snapshot_version_v1';
const LATEST_SYNC_METADATA_KEY = 'ausgabentracker_latest_sync_metadata_v1';

export type SyncPathConfig = {
  id: string;
  label: string;
  pathHint: string;
  createdAt: string;
};

export type LocalSyncMetadata = {
  device_id: string;
  snapshot_id: string;
  snapshot_version: number;
  schema_version: number;
  storage_label: string | null;
  storage_path_hint: string | null;
  created_at: string;
};

export type EncryptedSnapshotFileV1 = {
  type: 'ausgabentracker.snapshot.enc';
  v: 1;
  snapshot_id: string;
  snapshot_version: number;
  schema_version: 1;
  device_id: string;
  created_at: string;
  segments: {
    'finance-data': EncryptedEnvelopeV1;
    'local-settings': EncryptedEnvelopeV1;
    'analytics-state': EncryptedEnvelopeV1;
  };
};

type SnapshotPlainSegment = Record<string, unknown>;

// Die Form des Vergleichs liegt in `@/lib/snapshot-comparison` — der Service
// speichert sie, besitzt sie aber nicht (AGENTS.md §3, „Wohin ein Typ
// gehört"). Re-Export, damit bestehende Importe hier weiter funktionieren.
export type { SnapshotStandInfo, SnapshotVersionComparison };

/**
 * Wird geworfen, wenn ein Import ohne Bestätigung einen älteren/abweichenden
 * Snapshot einspielen würde (RES-4). `comparison` trägt beide Stände, damit
 * die Aufrufstelle direkt einen Dialog bauen kann, ohne die Datei erneut zu
 * parsen.
 */
export class SnapshotOlderVersionError extends Error {
  readonly comparison: SnapshotVersionComparison;

  constructor(comparison: SnapshotVersionComparison) {
    super(t('snapshotSyncService.olderSnapshotConfirmationRequired'));
    this.name = 'SnapshotOlderVersionError';
    this.comparison = comparison;
  }
}

const EncryptedEnvelopeV1Schema = z.object({
  type: z.literal('ausgabentracker.enc'),
  v: z.literal(1),
  kdf: z.object({
    name: z.literal('PBKDF2'),
    hash: z.literal('SHA-256'),
    iterations: z.number().int().positive(),
    salt_b64: z.string().min(1),
  }).strict(),
  cipher: z.object({
    name: z.literal('AES-GCM'),
    iv_b64: z.string().min(1),
  }).strict(),
  ct_b64: z.string().min(1),
}).strict();

const EncryptedSnapshotFileV1Schema = z.object({
  type: z.literal('ausgabentracker.snapshot.enc'),
  v: z.literal(1),
  snapshot_id: z.string().uuid(),
  snapshot_version: z.number().int().positive(),
  schema_version: z.literal(1),
  device_id: z.string().uuid(),
  created_at: z.string().datetime(),
  segments: z.object({
    'finance-data': EncryptedEnvelopeV1Schema,
    'local-settings': EncryptedEnvelopeV1Schema,
    'analytics-state': EncryptedEnvelopeV1Schema,
  }).strict(),
}).strict();


function readJson<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function getOrCreateDeviceId(): string {
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(DEVICE_ID_KEY, id);
  return id;
}

export function getSyncPaths(): SyncPathConfig[] {
  return readJson<SyncPathConfig[]>(SYNC_PATHS_KEY, []);
}

export function saveSyncPath(label: string, pathHint: string): SyncPathConfig[] {
  const paths = getSyncPaths();
  const entry: SyncPathConfig = {
    id: crypto.randomUUID(),
    label: label.trim() || t('snapshotSyncService.defaultSyncPathLabel'),
    pathHint: pathHint.trim(),
    createdAt: new Date().toISOString(),
  };
  const next = [entry, ...paths].slice(0, 5);
  localStorage.setItem(SYNC_PATHS_KEY, JSON.stringify(next));
  return next;
}

export function removeSyncPath(id: string): SyncPathConfig[] {
  const next = getSyncPaths().filter((path) => path.id !== id);
  localStorage.setItem(SYNC_PATHS_KEY, JSON.stringify(next));
  return next;
}

export async function createEncryptedSnapshot(): Promise<EncryptedSnapshotFileV1> {
  if (!localEncryption.isEnabled() || !localEncryption.isUnlocked()) {
    throw new Error(t('snapshotSyncService.encryptionRequiredForCreate'));
  }

  const version = Number(localStorage.getItem(SNAPSHOT_VERSION_KEY) || '0') + 1;
  localStorage.setItem(SNAPSHOT_VERSION_KEY, String(version));

  const financeData: SnapshotPlainSegment = {};
  for (const [name, key] of Object.entries(LOCAL_FINANCE_KEYS)) {
    financeData[name] = (await idbGet(key)) ?? localStorage.getItem(key);
  }

  const localSettings: SnapshotPlainSegment = {
    categories: (await idbGet(LOCAL_CATEGORIES_KEY)) ?? localStorage.getItem(LOCAL_CATEGORIES_KEY),
    userSettings: (await idbGet(LOCAL_SETTINGS_KEY)) ?? localStorage.getItem(LOCAL_SETTINGS_KEY),
    syncPaths: getSyncPaths(),
    deviceId: getOrCreateDeviceId(),
  };

  const analyticsState: SnapshotPlainSegment = {
    lastGeneratedAt: localStorage.getItem('ausgabentracker_analytics_last_generated_at_v1'),
  };

  const createdAt = new Date().toISOString();
  return {
    type: 'ausgabentracker.snapshot.enc',
    v: 1,
    snapshot_id: crypto.randomUUID(),
    snapshot_version: version,
    schema_version: 1,
    device_id: getOrCreateDeviceId(),
    created_at: createdAt,
    segments: {
      'finance-data': await localEncryption.encryptJson(financeData),
      'local-settings': await localEncryption.encryptJson(localSettings),
      'analytics-state': await localEncryption.encryptJson(analyticsState),
    },
  };
}

export async function exportEncryptedSnapshot(storageLabel?: string, storagePathHint?: string): Promise<EncryptedSnapshotFileV1> {
  const snapshot = await createEncryptedSnapshot();
  const filename = `ausgabentracker_snapshot_v${snapshot.snapshot_version}_${snapshot.created_at.slice(0, 10)}.enc.json`;
  downloadJson(filename, snapshot);

  localStorage.setItem(LATEST_SYNC_METADATA_KEY, JSON.stringify({
    device_id: snapshot.device_id,
    snapshot_id: snapshot.snapshot_id,
    snapshot_version: snapshot.snapshot_version,
    schema_version: snapshot.schema_version,
    storage_label: storageLabel || null,
    storage_path_hint: storagePathHint || null,
    created_at: snapshot.created_at,
  }));

  return snapshot;
}

/**
 * Importiert einen Snapshot als explizites Replace der lokalen Segmente.
 *
 * RES-4: Ist die Datei laut {@link compareSnapshotForImport} älter/abweichend
 * vom lokalen Stand, wird ohne `options.acknowledgeOlder` verweigert
 * (`SnapshotOlderVersionError`, trägt den Vergleich für den Dialog der
 * Aufrufstelle). Das Replace-Verhalten selbst bleibt unverändert — es ist nur
 * nicht mehr ungeschützt. Gleicher oder neuerer Stand importiert wie bisher,
 * ohne Bestätigung.
 *
 * `input` darf eine `File` sein (üblicher Weg) oder ein bereits geparster
 * Snapshot (z. B. aus {@link previewSnapshotImport}) — dann entfällt das
 * erneute Parsen der Datei, wenn die Aufrufstelle den Nutzer schon vorab
 * fragen musste.
 */
export async function importEncryptedSnapshot(
  input: File | EncryptedSnapshotFileV1,
  options?: { acknowledgeOlder?: boolean },
): Promise<EncryptedSnapshotFileV1> {
  if (!localEncryption.isEnabled() || !localEncryption.isUnlocked()) {
    throw new Error(t('snapshotSyncService.encryptionRequiredForImport'));
  }

  const parsed = input instanceof File ? await parseSnapshotFile(input) : input;

  const localVersion = Number(localStorage.getItem(SNAPSHOT_VERSION_KEY) || '0');
  const localMeta = await getLatestSyncMetadata();
  const comparison = compareSnapshotForImport(parsed, localVersion, localMeta);
  if (comparison.requiresConfirmation && !options?.acknowledgeOlder) {
    throw new SnapshotOlderVersionError(comparison);
  }

  const financeData = await localEncryption.decryptJson<Record<string, string | null>>(parsed.segments['finance-data']);
  for (const [name, key] of Object.entries(LOCAL_FINANCE_KEYS)) {
    const rawSegment = financeData[name];
    if (rawSegment) await idbSet(key, rawSegment);
  }

  const localSettings = await localEncryption.decryptJson<Record<string, unknown>>(parsed.segments['local-settings']);
  if (typeof localSettings.categories === 'string') {
    await idbSet(LOCAL_CATEGORIES_KEY, localSettings.categories);
  }
  if (typeof localSettings.userSettings === 'string') {
    await idbSet(LOCAL_SETTINGS_KEY, localSettings.userSettings);
  }
  // Snapshot-Import ist ein explizites Replace für verschlüsselte Finanzsegmente.
  // Geräte-/Pfad-Metadaten bleiben lokal: importierte syncPaths/pathHints werden
  // bewusst nicht übernommen, damit ein fremder Snapshot keine lokalen
  // Speicherlabels oder Pfadangaben persistiert.
  localStorage.setItem(SNAPSHOT_VERSION_KEY, String(parsed.snapshot_version));
  // Lokalen Sync-Stand auch beim Import fortschreiben (RES-4), nicht nur beim
  // Export: sonst kennt ein späterer Versionsvergleich nach einem Fremd-Import
  // den tatsächlich installierten Stand nicht mehr, und der Fremdgeräte-Zweig
  // oben hätte nach dem ersten Import keine Vergleichsbasis mehr.
  localStorage.setItem(LATEST_SYNC_METADATA_KEY, JSON.stringify({
    device_id: parsed.device_id,
    snapshot_id: parsed.snapshot_id,
    snapshot_version: parsed.snapshot_version,
    schema_version: parsed.schema_version,
    storage_label: localMeta?.storage_label ?? null,
    storage_path_hint: localMeta?.storage_path_hint ?? null,
    created_at: parsed.created_at,
  } satisfies LocalSyncMetadata));
  return parsed;
}

export async function getLatestSyncMetadata() {
  return readJson<LocalSyncMetadata | null>(LATEST_SYNC_METADATA_KEY, null);
}

async function parseSnapshotFile(file: File): Promise<EncryptedSnapshotFileV1> {
  const raw = await file.text();
  let snapshotJson: unknown;
  try {
    snapshotJson = JSON.parse(raw);
  } catch {
    throw new Error(t('snapshotSyncService.invalidSnapshotFormat'));
  }
  const parsedResult = EncryptedSnapshotFileV1Schema.safeParse(snapshotJson);
  if (!parsedResult.success) {
    throw new Error(t('snapshotSyncService.invalidSnapshotFormat'));
  }
  return parsedResult.data as EncryptedSnapshotFileV1;
}

/**
 * Vergleicht eine zu importierende Snapshot-Datei mit dem lokalen Stand
 * (RES-4). Die Gerätezugehörigkeit entscheidet über die Vergleichsmethode:
 *
 * - **Gleiches Gerät** (`parsed.device_id` == die eigene Geräte-ID): der
 *   Versionszähler wird bei jedem Export dieses Geräts exakt und lückenlos
 *   um eins erhöht — er ist hier der verlässlichere Indikator als eine Uhr.
 * - **Fremdes Gerät**: dessen Versionszähler führt eine unabhängige
 *   Historie. Eine niedrigere Zahl kann von einem seltener synchronisierten,
 *   aber inhaltlich trotzdem neueren Gerät stammen (Beispiel: Gerät A exportiert
 *   selten und steht bei Version 2, Gerät B exportiert oft und steht bei
 *   Version 10 — B kann trotzdem seit Wochen nicht mehr angefasst worden
 *   sein). Vergleichbar ist über Geräte hinweg nur der Zeitstempel, verglichen
 *   mit dem zuletzt bekannten lokalen Sync-Stand. Ohne einen solchen bekannten
 *   Stand (noch nie synchronisiert) gibt es nichts, was verloren gehen könnte
 *   — der Import läuft dann ohne Bestätigung durch.
 */
export function compareSnapshotForImport(
  parsed: EncryptedSnapshotFileV1,
  localVersion: number,
  localMeta: LocalSyncMetadata | null,
): SnapshotVersionComparison {
  const isForeignDevice = parsed.device_id !== getOrCreateDeviceId();

  const local: SnapshotStandInfo = {
    version: localVersion,
    createdAt: localMeta?.created_at ?? null,
    deviceId: localMeta?.device_id ?? null,
  };
  const remote: SnapshotStandInfo = {
    version: parsed.snapshot_version,
    createdAt: parsed.created_at,
    deviceId: parsed.device_id,
  };

  // Ein fremdes Gerät wird IMMER bestätigt, sobald lokal etwas liegt (Audit
  // 2026-09, WP7). Vorher entschied ein Zeitvergleich: Ist der fremde
  // Snapshot jünger, ersetzte er den lokalen Bestand ohne Rückfrage. Der
  // Zeitstempel sagt aber nur, wann der Snapshot ERZEUGT wurde — nicht, wann
  // hier zuletzt gearbeitet wurde; Änderungszeiten werden gar nicht
  // verfolgt. Ein heute erzeugter Export eines seit Wochen unbenutzten
  // Zweitgeräts überschrieb damit die Arbeit von gestern, lautlos.
  const requiresConfirmation = isForeignDevice
    ? localMeta !== null
    : remote.version < localVersion;

  return { requiresConfirmation, isForeignDevice, local, remote };
}

/**
 * Liest eine Snapshot-Datei und vergleicht sie mit dem lokalen Stand, OHNE
 * etwas zu importieren. Für die Fläche gedacht: Vergleich zuerst anzeigen,
 * bei Bedarf bestätigen lassen, dann erst `importEncryptedSnapshot` mit dem
 * schon geparsten Snapshot aufrufen (kein zweites Parsen der Datei nötig).
 */
export async function previewSnapshotImport(file: File): Promise<{
  snapshot: EncryptedSnapshotFileV1;
  comparison: SnapshotVersionComparison;
}> {
  const snapshot = await parseSnapshotFile(file);
  const localVersion = Number(localStorage.getItem(SNAPSHOT_VERSION_KEY) || '0');
  const localMeta = await getLatestSyncMetadata();
  return { snapshot, comparison: compareSnapshotForImport(snapshot, localVersion, localMeta) };
}
