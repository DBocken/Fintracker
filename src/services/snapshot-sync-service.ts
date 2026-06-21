import { localEncryption, type EncryptedEnvelopeV1 } from './local-crypto';
import { LOCAL_FINANCE_KEYS } from './local-finance-store';
import { idbGet, idbSet } from './idb-kv';
import { LOCAL_CATEGORIES_KEY, LOCAL_SETTINGS_KEY } from './local-settings-service';

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
    label: label.trim() || 'Sync-Pfad',
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
    throw new Error('Bitte lokale Verschlüsselung aktivieren und entsperren, bevor ein Snapshot erstellt wird.');
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

export async function importEncryptedSnapshot(file: File): Promise<EncryptedSnapshotFileV1> {
  if (!localEncryption.isEnabled() || !localEncryption.isUnlocked()) {
    throw new Error('Bitte lokale Verschlüsselung entsperren, bevor ein Snapshot importiert wird.');
  }

  const raw = await file.text();
  const parsed = JSON.parse(raw) as EncryptedSnapshotFileV1;
  if (parsed?.type !== 'ausgabentracker.snapshot.enc' || parsed?.v !== 1 || !parsed.segments?.['finance-data']) {
    throw new Error('Ungültiges Snapshot-Format');
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
  if (Array.isArray(localSettings.syncPaths)) {
    localStorage.setItem(SYNC_PATHS_KEY, JSON.stringify(localSettings.syncPaths));
  }

  localStorage.setItem(SNAPSHOT_VERSION_KEY, String(parsed.snapshot_version));
  return parsed;
}

export async function getLatestSyncMetadata() {
  return readJson<LocalSyncMetadata | null>(LATEST_SYNC_METADATA_KEY, null);
}
