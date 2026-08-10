import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LOCAL_USER_ID } from '../local-settings-service';
import type { UserSettings } from '../../types';

/**
 * WP 7.3 (`4dcfa86`) hat das anonyme Backup repariert — seither trägt eine
 * ohne Anmeldung erstellte Sicherung `userId: "local"` (`LOCAL_USER_ID`).
 *
 * Damit ist ein Pfad erreichbar geworden, den es vorher nicht gab: Meldet sich
 * derselbe Mensch später an und spielt SEIN EIGENES Backup ein, unterscheiden
 * sich die Kennungen — und die App behauptete „Dieses Backup wurde mit einem
 * anderen Benutzerkonto erstellt". Das ist sachlich falsch; die Datei stammt
 * aus der Nutzung ohne Konto, nicht aus einem fremden Konto.
 *
 * Die Rückfrage BLEIBT (es ist ein Merge in vorhandene Daten), nur die
 * Auskunft muss wahr werden. Die Unterscheidung gehört in den Service: nur er
 * kennt beide Kennungen.
 */

vi.mock('../auth-service', () => ({
  getCurrentUserId: vi.fn(async () => null as string | null),
  requireUserId: vi.fn(async () => {
    throw new Error('Nicht angemeldet. Bitte zuerst einloggen.');
  }),
}));

import { getCurrentUserId } from '../auth-service';
import {
  BACKUP_VERSION,
  backupOwnershipFromError,
  backupService,
  classifyBackupOwnership,
  ForeignBackupError,
  type BackupData,
} from '../backup-service';

const KONTO_KENNUNG = 'konto-4711';

function backupVon(userId: string): BackupData {
  return {
    version: BACKUP_VERSION,
    timestamp: '2026-08-09T10:00:00.000Z',
    userId,
    data: { transactions: [], categories: [], accounts: [], settings: {} as UserSettings },
  };
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('ausgabentracker_locale_v1', 'de');
  vi.mocked(getCurrentUserId).mockResolvedValue(null);
});

describe('classifyBackupOwnership', () => {
  it('sollte dieselbe Kennung als „same" einstufen', () => {
    expect(classifyBackupOwnership({ userId: KONTO_KENNUNG }, KONTO_KENNUNG)).toBe('same');
    expect(classifyBackupOwnership({ userId: LOCAL_USER_ID }, LOCAL_USER_ID)).toBe('same');
  });

  it('[REGRESSION] sollte ein ohne Konto erstelltes Backup nicht als Fremdkonto einstufen', () => {
    expect(classifyBackupOwnership({ userId: LOCAL_USER_ID }, KONTO_KENNUNG)).toBe('localToAccount');
  });

  it('sollte eine echte fremde Konto-Kennung als Fremdkonto einstufen', () => {
    expect(classifyBackupOwnership({ userId: 'fremdes-konto' }, KONTO_KENNUNG)).toBe('otherAccount');
    // Umgekehrte Richtung: angemeldet erstellt, anonym eingespielt — bleibt fremd.
    expect(classifyBackupOwnership({ userId: KONTO_KENNUNG }, LOCAL_USER_ID)).toBe('otherAccount');
  });
});

describe('restoreBackup — Fehlersignal', () => {
  it('[REGRESSION] sollte beim eigenen lokalen Backup nach Anmeldung „localToAccount" melden', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(KONTO_KENNUNG);

    const fehler = await backupService.restoreBackup(backupVon(LOCAL_USER_ID)).catch((e: unknown) => e);

    expect(fehler).toBeInstanceOf(ForeignBackupError);
    expect(backupOwnershipFromError(fehler)).toBe('localToAccount');
  });

  it('[REGRESSION] sollte bei echt fremder Kennung weiterhin „otherAccount" melden', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(KONTO_KENNUNG);

    const fehler = await backupService.restoreBackup(backupVon('fremdes-konto')).catch((e: unknown) => e);

    expect(backupOwnershipFromError(fehler)).toBe('otherAccount');
  });

  it('sollte die Meldung „FOREIGN_BACKUP" beibehalten — bestehende Aufrufstellen prüfen sie', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(KONTO_KENNUNG);

    await expect(backupService.restoreBackup(backupVon(LOCAL_USER_ID))).rejects.toThrow('FOREIGN_BACKUP');
    await expect(backupService.restoreBackup(backupVon('fremdes-konto'))).rejects.toThrow('FOREIGN_BACKUP');
  });

  it('sollte einen fremden Fehler ohne Kennung als „nicht besitzbezogen" (null) einstufen', () => {
    expect(backupOwnershipFromError(new Error('irgendwas anderes'))).toBeNull();
    expect(backupOwnershipFromError(undefined)).toBeNull();
  });

  it('sollte ein altes, rohes FOREIGN_BACKUP weiterhin als Fremdkonto lesen (rückwärtskompatibel)', () => {
    expect(backupOwnershipFromError(new Error('FOREIGN_BACKUP'))).toBe('otherAccount');
  });
});

describe('restoreBackup — Erfolgsmeldung', () => {
  it('[REGRESSION] sollte das übernommene lokale Backup nicht als „aus anderem Benutzerkonto" melden', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(KONTO_KENNUNG);

    const ergebnis = await backupService.restoreBackup(backupVon(LOCAL_USER_ID), { allowForeign: true });

    expect(ergebnis.success).toBe(true);
    expect(ergebnis.message).not.toContain('anderem Benutzerkonto');
    expect(ergebnis.message).toContain('Konto');
  });

  it('sollte ein echt fremdes Backup weiterhin als solches melden', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(KONTO_KENNUNG);

    const ergebnis = await backupService.restoreBackup(backupVon('fremdes-konto'), { allowForeign: true });

    expect(ergebnis.message).toContain('anderem Benutzerkonto');
  });
});
