import { beforeEach, describe, expect, it } from 'vitest';
import {
  compareSnapshotForImport,
  getOrCreateDeviceId,
  importEncryptedSnapshot,
  previewSnapshotImport,
  SnapshotOlderVersionError,
} from '../snapshot-sync-service';
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

/** Baut einen Snapshot mit einem bestimmten Transaktionsbetrag, um Overwrite-Effekte sichtbar zu machen. */
async function makeSnapshotWithAmount(amount: number, overrides: Record<string, unknown> = {}) {
  const financeData = { transactions: JSON.stringify([{ id: 'tx-1', amount }]) };
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
      'local-settings': await localEncryption.encryptJson({}),
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

describe('snapshot-sync-service Versionsvergleich (RES-4)', () => {
  beforeEach(async () => {
    localStorage.clear();
    localEncryption.lock();
    await clearLocalKvStore();
    await localEncryption.enable(PASSWORD);
  });

  it('[REGRESSION] sollte den Import eines älteren Snapshots vom selben Gerät ohne Bestätigung verhindern — lokale Daten bleiben unverändert', async () => {
    const deviceId = getOrCreateDeviceId();

    // Baseline: v5 auf diesem Gerät (erster Import läuft ohne Bestätigung durch).
    const baseline = await makeSnapshotWithAmount(-500, { snapshot_version: 5, device_id: deviceId });
    await importEncryptedSnapshot(asFile(baseline));
    expect(await idbGet(LOCAL_FINANCE_KEYS.transactions)).toBe(JSON.stringify([{ id: 'tx-1', amount: -500 }]));

    // Versuch: v3 vom selben Gerät — älter, ohne Bestätigung verboten.
    const older = await makeSnapshotWithAmount(-999, { snapshot_version: 3, device_id: deviceId });
    await expect(importEncryptedSnapshot(asFile(older))).rejects.toThrow(SnapshotOlderVersionError);

    // Lokale Daten unverändert — nicht nur „es gab einen Fehler".
    expect(await idbGet(LOCAL_FINANCE_KEYS.transactions)).toBe(JSON.stringify([{ id: 'tx-1', amount: -500 }]));
    expect(localStorage.getItem('ausgabentracker_snapshot_version_v1')).toBe('5');
  });

  it('sollte mit acknowledgeOlder denselben älteren Snapshot einspielen', async () => {
    const deviceId = getOrCreateDeviceId();

    const baseline = await makeSnapshotWithAmount(-500, { snapshot_version: 5, device_id: deviceId });
    await importEncryptedSnapshot(asFile(baseline));

    const older = await makeSnapshotWithAmount(-999, { snapshot_version: 3, device_id: deviceId });
    const parsed = await importEncryptedSnapshot(asFile(older), { acknowledgeOlder: true });

    expect(parsed.snapshot_version).toBe(3);
    expect(await idbGet(LOCAL_FINANCE_KEYS.transactions)).toBe(JSON.stringify([{ id: 'tx-1', amount: -999 }]));
    expect(localStorage.getItem('ausgabentracker_snapshot_version_v1')).toBe('3');
  });

  it('sollte gleichen oder neueren Snapshot vom selben Gerät ohne Bestätigung importieren, wie bisher', async () => {
    const deviceId = getOrCreateDeviceId();

    const baseline = await makeSnapshotWithAmount(-500, { snapshot_version: 5, device_id: deviceId });
    await importEncryptedSnapshot(asFile(baseline));

    const sameVersion = await makeSnapshotWithAmount(-600, { snapshot_version: 5, device_id: deviceId });
    await expect(importEncryptedSnapshot(asFile(sameVersion))).resolves.not.toThrow();
    expect(await idbGet(LOCAL_FINANCE_KEYS.transactions)).toBe(JSON.stringify([{ id: 'tx-1', amount: -600 }]));

    const newerVersion = await makeSnapshotWithAmount(-700, { snapshot_version: 6, device_id: deviceId });
    await expect(importEncryptedSnapshot(asFile(newerVersion))).resolves.not.toThrow();
    expect(await idbGet(LOCAL_FINANCE_KEYS.transactions)).toBe(JSON.stringify([{ id: 'tx-1', amount: -700 }]));
  });

  it('sollte bei einem fremden Gerät mit älterem Zeitstempel eine Bestätigung verlangen, obwohl die Versionsnummer höher ist', async () => {
    const deviceId = getOrCreateDeviceId();
    const foreignDeviceId = crypto.randomUUID();

    // Lokaler Stand: aktuell (heute), Version 2.
    const baseline = await makeSnapshotWithAmount(-100, {
      snapshot_version: 2,
      device_id: deviceId,
      created_at: new Date().toISOString(),
    });
    await importEncryptedSnapshot(asFile(baseline));

    // Fremdes Gerät: viel höhere Versionsnummer, aber Monate alter Zeitstempel.
    const staleForeign = await makeSnapshotWithAmount(-200, {
      snapshot_version: 50,
      device_id: foreignDeviceId,
      created_at: '2025-01-01T00:00:00.000Z',
    });

    await expect(importEncryptedSnapshot(asFile(staleForeign))).rejects.toThrow(SnapshotOlderVersionError);
    expect(await idbGet(LOCAL_FINANCE_KEYS.transactions)).toBe(JSON.stringify([{ id: 'tx-1', amount: -100 }]));
  });

  it('[INTEGRITY] sollte einen fremden Snapshot auch mit neuerem Zeitstempel bestätigen lassen', async () => {
    // GEÄNDERTE ERWARTUNG (Audit 2026-09, WP7). Vorher galt: neuerer
    // Zeitstempel gewinnt, ohne Rückfrage. Der Zeitstempel sagt aber nur, wann
    // der Snapshot ERZEUGT wurde — nicht, wann auf diesem Gerät zuletzt
    // gearbeitet wurde; Änderungszeiten werden gar nicht verfolgt. Wer auf dem
    // Zweitgerät „Export" drückt, erzeugt damit einen frischen Zeitstempel über
    // einem monatealten Datenstand und überschrieb hier lautlos die Arbeit von
    // gestern. Ein Datenverlust darf keine Nebenwirkung eines Exports sein;
    // die Rückfrage kostet einen Klick und ist rückgängig zu machen.
    const deviceId = getOrCreateDeviceId();
    const foreignDeviceId = crypto.randomUUID();

    const baseline = await makeSnapshotWithAmount(-100, {
      snapshot_version: 10,
      device_id: deviceId,
      created_at: '2025-01-01T00:00:00.000Z',
    });
    await importEncryptedSnapshot(asFile(baseline));

    const freshForeign = await makeSnapshotWithAmount(-200, {
      snapshot_version: 2,
      device_id: foreignDeviceId,
      created_at: new Date().toISOString(),
    });

    await expect(importEncryptedSnapshot(asFile(freshForeign))).rejects.toThrow(SnapshotOlderVersionError);
    // Der lokale Bestand ist unberührt geblieben.
    expect(await idbGet(LOCAL_FINANCE_KEYS.transactions)).toBe(JSON.stringify([{ id: 'tx-1', amount: -100 }]));

    // Mit Bestätigung geht es weiterhin durch — die Rückfrage blockiert nicht,
    // sie fragt.
    await expect(
      importEncryptedSnapshot(asFile(freshForeign), { acknowledgeOlder: true }),
    ).resolves.not.toThrow();
    expect(await idbGet(LOCAL_FINANCE_KEYS.transactions)).toBe(JSON.stringify([{ id: 'tx-1', amount: -200 }]));
  });

  it('sollte den ersten Import überhaupt (kein bekannter lokaler Stand) nie blockieren', async () => {
    const firstEver = await makeSnapshotWithAmount(-50, { snapshot_version: 1 });
    await expect(importEncryptedSnapshot(asFile(firstEver))).resolves.not.toThrow();
  });

  it('compareSnapshotForImport: sollte requiresConfirmation und beide Stände (Version + Datum) liefern', async () => {
    const deviceId = getOrCreateDeviceId();
    const older = await makeSnapshotWithAmount(-1, {
      snapshot_version: 3,
      device_id: deviceId,
      created_at: '2026-07-20T10:00:00.000Z',
    });

    const comparison = compareSnapshotForImport(
      older as unknown as Parameters<typeof compareSnapshotForImport>[0],
      5,
      { device_id: deviceId, snapshot_id: 'x', snapshot_version: 5, schema_version: 1, storage_label: null, storage_path_hint: null, created_at: '2026-08-01T10:00:00.000Z' },
    );

    expect(comparison.requiresConfirmation).toBe(true);
    expect(comparison.isForeignDevice).toBe(false);
    expect(comparison.local).toEqual({ version: 5, createdAt: '2026-08-01T10:00:00.000Z', deviceId });
    expect(comparison.remote).toEqual({ version: 3, createdAt: '2026-07-20T10:00:00.000Z', deviceId });
  });

  it('[INTEGRITY] sollte einen fremden Snapshot auch dann bestätigen lassen, wenn er jünger als der lokale ist', async () => {
    // Audit 2026-09, WP7: Vorher entschied ein Zeitvergleich — ein jüngerer
    // fremder Snapshot ersetzte den lokalen Bestand ohne Rückfrage. Der
    // Zeitstempel sagt aber nur, wann der Snapshot ERZEUGT wurde, nicht wann
    // hier zuletzt gearbeitet wurde; Änderungszeiten werden nicht verfolgt.
    // Ein heute erzeugter Export eines seit Wochen unbenutzten Zweitgeräts
    // überschrieb damit lautlos die Arbeit von gestern.
    const fremd = await makeSnapshotWithAmount(-1, {
      snapshot_version: 9,
      device_id: 'fremdes-geraet',
      created_at: '2026-08-30T10:00:00.000Z',
    });

    const comparison = compareSnapshotForImport(
      fremd as unknown as Parameters<typeof compareSnapshotForImport>[0],
      5,
      {
        device_id: getOrCreateDeviceId(),
        snapshot_id: 'x',
        snapshot_version: 5,
        schema_version: 1,
        storage_label: null,
        storage_path_hint: null,
        created_at: '2026-08-01T10:00:00.000Z',
      },
    );

    expect(comparison.isForeignDevice).toBe(true);
    expect(comparison.requiresConfirmation).toBe(true);
  });

  it('sollte einen fremden Snapshot OHNE lokalen Bestand ohne Rückfrage zulassen', async () => {
    // Die Gegenprobe: Wo nichts liegt, kann nichts überschrieben werden — eine
    // Rückfrage wäre hier reine Reibung beim Einrichten eines zweiten Geräts.
    const fremd = await makeSnapshotWithAmount(-1, {
      snapshot_version: 9,
      device_id: 'fremdes-geraet',
    });

    const comparison = compareSnapshotForImport(
      fremd as unknown as Parameters<typeof compareSnapshotForImport>[0],
      0,
      null,
    );

    expect(comparison.isForeignDevice).toBe(true);
    expect(comparison.requiresConfirmation).toBe(false);
  });

  it('sollte previewSnapshotImport ohne Import Version und Datum beider Stände liefern', async () => {
    const deviceId = getOrCreateDeviceId();
    const baseline = await makeSnapshotWithAmount(-500, { snapshot_version: 5, device_id: deviceId });
    await importEncryptedSnapshot(asFile(baseline));

    const older = await makeSnapshotWithAmount(-999, { snapshot_version: 3, device_id: deviceId });
    const { comparison } = await previewSnapshotImport(asFile(older));

    expect(comparison.requiresConfirmation).toBe(true);
    expect(comparison.local.version).toBe(5);
    expect(comparison.remote.version).toBe(3);
    // Nichts importiert — previewSnapshotImport liest nur.
    expect(await idbGet(LOCAL_FINANCE_KEYS.transactions)).toBe(JSON.stringify([{ id: 'tx-1', amount: -500 }]));
  });
});
