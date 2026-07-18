import { beforeEach, describe, expect, it } from 'vitest';
import { importEncryptedSnapshot } from '../snapshot-sync-service';
import { localEncryption } from '../local-crypto';
import { clearLocalKvStore, idbGet } from '../idb-kv';
import { LOCAL_FINANCE_KEYS } from '../local-finance-store';

const PASSWORD = 'snapshot-test-passwort-123';

async function makeSnapshot(overrides: Record<string, unknown> = {}) {
  const financeData = { transactions: JSON.stringify([{ id: 'tx-1', amount: -1200 }]) };
  const localSettings = {
    syncPaths: [{ id: 'path-1', label: 'Privater Pfad', pathHint: '/Users/alice/Finanzen' }],
  };

  return {
    type: 'ausgabentracker.snapshot.enc',
    v: 1,
    snapshot_id: crypto.randomUUID(),
    snapshot_version: 1,
    schema_version: 1,
    device_id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    segments: {
      'finance-data': await localEncryption.encryptJson(financeData),
      'local-settings': await localEncryption.encryptJson(localSettings),
      'analytics-state': await localEncryption.encryptJson({}),
    },
    ...overrides,
  };
}

function asFile(data: unknown) {
  return new File([JSON.stringify(data)], 'snapshot.enc.json', { type: 'application/json' });
}

describe('snapshot-sync-service Import', () => {
  beforeEach(async () => {
    localStorage.clear();
    localEncryption.lock();
    await clearLocalKvStore();
    await localEncryption.enable(PASSWORD);
  });

  it('[INTEGRITY] sollte kaputte Snapshot-Strukturen per Schema ablehnen', async () => {
    const snapshot = await makeSnapshot({ snapshot_id: 'not-a-uuid' });

    await expect(importEncryptedSnapshot(asFile(snapshot))).rejects.toThrow(/Snapshot-Format|snapshot format/i);
  });

  it('[PRIVACY] sollte importierte syncPaths und pathHints nicht lokal persistieren', async () => {
    const snapshot = await makeSnapshot();

    await importEncryptedSnapshot(asFile(snapshot));

    expect(localStorage.getItem('ausgabentracker_sync_paths_v1')).toBeNull();
    expect(localStorage.getItem('ausgabentracker_snapshot_version_v1')).toBe('1');
  });

  it('[REGRESSION] sollte Finanzsegmente als explizites Replace nach stabilen Keys importieren', async () => {
    const snapshot = await makeSnapshot();

    await importEncryptedSnapshot(asFile(snapshot));

    expect(await idbGet(LOCAL_FINANCE_KEYS.transactions)).toBe(JSON.stringify([{ id: 'tx-1', amount: -1200 }]));
  });
});
