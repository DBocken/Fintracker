import { describe, it, expect } from 'vitest';
import {
  computeBackupChecksum,
  verifyBackupChecksum,
  isVersionCompatible,
  getVersionMinorMismatchWarning,
  validateBackup,
  BACKUP_VERSION,
  type BackupData,
} from '../backup-service';

/**
 * WP 1.5 (RES-5): `validateBackup`/`isVersionCompatible` waren bis hierhin
 * `private` an `BackupService` und deshalb von außen nicht testbar
 * (`nachpruefung.md` 0.6). Jetzt eigenständige, exportierte Modul-Funktionen —
 * dieser Test deckt genau diese Testbarkeits-Lücke.
 */

function samplePayload(): Pick<BackupData, 'data' | 'collections'> {
  return {
    data: {
      transactions: [{ id: 't1', amount: -12.34, payee: 'REWE' } as never],
      categories: [],
      accounts: [{ id: 'a1', name: 'Giro' } as never],
      settings: { retention_months: 36 } as never,
    },
    collections: { debts: [{ id: 'd1', name: 'Karte' }] },
  };
}

describe('computeBackupChecksum / verifyBackupChecksum (WP 1.5, RES-5)', () => {
  it('Roundtrip: dieselbe Nutzlast ergibt dieselbe Prüfsumme', async () => {
    const payload = samplePayload();
    const value = await computeBackupChecksum(payload);
    expect(value).toMatch(/^[0-9a-f]{64}$/);
    expect(await computeBackupChecksum(payload)).toBe(value);
  });

  it('ist stabil gegenüber Schlüsselreihenfolge in JSON', async () => {
    const a = await computeBackupChecksum({
      data: { transactions: [{ id: 't1', amount: -1, payee: 'X' } as never], categories: [], accounts: [], settings: {} as never },
      collections: { debts: [{ id: 'd1', name: 'Karte', balance: 100 }] },
    });
    // Gleicher Inhalt, Schlüssel innerhalb der Items in anderer Reihenfolge
    // konstruiert (JSON.stringify serialisiert nach Einfügereihenfolge).
    const b = await computeBackupChecksum({
      data: { transactions: [{ payee: 'X', amount: -1, id: 't1' } as never], categories: [], accounts: [], settings: {} as never },
      collections: { debts: [{ balance: 100, name: 'Karte', id: 'd1' }] },
    });
    expect(a).toBe(b);
  });

  it('unterschiedliche Nutzlast ergibt unterschiedliche Prüfsumme', async () => {
    const a = await computeBackupChecksum(samplePayload());
    const changed = samplePayload();
    changed.collections = { debts: [{ id: 'd1', name: 'MANIPULIERT' }] };
    const b = await computeBackupChecksum(changed);
    expect(a).not.toBe(b);
  });

  it("[INTEGRITY] verifyBackupChecksum erkennt eine manipulierte Nutzlast als 'mismatch'", async () => {
    const payload = samplePayload();
    const value = await computeBackupChecksum(payload);
    const tampered = { ...payload, collections: { debts: [{ id: 'd1', name: 'MANIPULIERT' }] } };

    const result = await verifyBackupChecksum({ ...tampered, checksum: { algorithm: 'sha256', value } });
    expect(result).toBe('mismatch');
  });

  it("[REGRESSION] verifyBackupChecksum meldet ein Backup ohne checksum-Feld als 'missing', nicht als Fehler", async () => {
    const payload = samplePayload();
    const result = await verifyBackupChecksum({ ...payload, checksum: undefined });
    expect(result).toBe('missing');
  });

  it("verifyBackupChecksum meldet eine unveränderte, korrekt berechnete Nutzlast als 'ok'", async () => {
    const payload = samplePayload();
    const value = await computeBackupChecksum(payload);
    const result = await verifyBackupChecksum({ ...payload, checksum: { algorithm: 'sha256', value } });
    expect(result).toBe('ok');
  });

  it('behandelt collections: undefined und collections: {} gleich (Abwärtskompatibilität vor v1.1)', async () => {
    const withUndefined = await computeBackupChecksum({ data: samplePayload().data, collections: undefined });
    const withEmpty = await computeBackupChecksum({ data: samplePayload().data, collections: {} });
    expect(withUndefined).toBe(withEmpty);
  });
});

describe('isVersionCompatible / getVersionMinorMismatchWarning (WP 1.5, RES-5)', () => {
  it('bleibt Major-basiert: gleicher Major, anderer Minor/Patch ⇒ kompatibel', () => {
    expect(isVersionCompatible('1.0.0', '1.2.0')).toBe(true);
    expect(isVersionCompatible('1.9.3', '1.2.0')).toBe(true);
  });

  it('lehnt einen abweichenden Major ab', () => {
    expect(isVersionCompatible('2.0.0', '1.2.0')).toBe(false);
    expect(isVersionCompatible('0.9.0', '1.2.0')).toBe(false);
  });

  it('nutzt BACKUP_VERSION als Standard für currentVersion', () => {
    expect(isVersionCompatible(BACKUP_VERSION)).toBe(true);
  });

  it('liefert einen Warnhinweis bei Minor-Differenz trotz gleichem Major', () => {
    const warning = getVersionMinorMismatchWarning('1.0.0', '1.2.0');
    expect(warning).not.toBeNull();
    expect(warning).toContain('1.0.0');
    expect(warning).toContain('1.2.0');
  });

  it('liefert keinen Warnhinweis bei identischem Minor (nur Patch weicht ab)', () => {
    expect(getVersionMinorMismatchWarning('1.2.5', '1.2.0')).toBeNull();
  });

  it('liefert keinen Warnhinweis bei exakt gleicher Version', () => {
    expect(getVersionMinorMismatchWarning('1.2.0', '1.2.0')).toBeNull();
  });
});

describe('validateBackup (WP 1.2/1.5) — jetzt exportierte Modul-Funktion', () => {
  it('akzeptiert eine strukturell vollständige BackupData', () => {
    const backup: BackupData = {
      version: '1.2.0',
      timestamp: '2026-08-08T00:00:00.000Z',
      userId: 'user-1',
      data: { transactions: [], categories: [], accounts: [], settings: {} as never },
    };
    expect(validateBackup(backup)).toBe(true);
  });

  it('lehnt ein Objekt ohne data.transactions-Array ab', () => {
    expect(
      validateBackup({
        version: '1.2.0',
        timestamp: '2026-08-08T00:00:00.000Z',
        userId: 'user-1',
        data: { transactions: 'kaputt', categories: [], accounts: [], settings: {} },
      }),
    ).toBe(false);
  });

  it('lehnt null/primitive Werte ab', () => {
    expect(validateBackup(null)).toBe(false);
    expect(validateBackup('string')).toBe(false);
    expect(validateBackup(42)).toBe(false);
  });
});
