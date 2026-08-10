import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test-utils/render';

/**
 * WP 7.3 (`4dcfa86`) hat das anonyme Backup repariert — und damit erstmals
 * erreichbar gemacht, dass jemand SEIN EIGENES, ohne Konto erstelltes Backup
 * nach einer Anmeldung einspielt. Die App sagte dazu „Dieses Backup wurde mit
 * einem anderen Benutzerkonto erstellt". Das ist falsch, und die Falschaussage
 * ist von uns erzeugt (vorher warf die anonyme Sicherung, der Pfad war tot).
 *
 * Die Bestätigung bleibt — es ist ein Merge in vorhandene Daten —, nur der
 * Wortlaut wird wahr. Die Fläche entscheidet ihn nicht selbst: sie liest das
 * Besitzverhältnis aus dem Fehler, den der Service wirft (nur er kennt beide
 * Kennungen).
 */

const stubs = vi.hoisted(() => ({
  getBackupInfo: vi.fn(),
  readBackupFile: vi.fn(),
  restoreBackup: vi.fn(),
}));

vi.mock('@/services/backup-service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/backup-service')>();
  return {
    ...actual,
    backupService: {
      getBackupInfo: stubs.getBackupInfo,
      readBackupFile: stubs.readBackupFile,
      restoreBackup: stubs.restoreBackup,
    },
  };
});

vi.mock('@/hooks/usePersistentStorageDenied', () => ({
  usePersistentStorageDenied: () => false,
}));

import { BackupManager } from '../BackupManager';
import { ForeignBackupError, type BackupData } from '@/services/backup-service';

const BACKUP = { userId: 'local' } as BackupData;

beforeEach(() => {
  vi.clearAllMocks();
  stubs.getBackupInfo.mockResolvedValue({
    date: '2026-08-09T10:00:00.000Z',
    transactionCount: 3,
    categoryCount: 2,
    accountCount: 1,
    estimatedSize: 2048,
  });
  stubs.readBackupFile.mockResolvedValue(BACKUP);
});

/** Führt die Wiederherstellung bis zur Rückfrage — Datei wählen, „Wiederherstellen". */
async function bisZurRueckfrage(locale: 'de' | 'en') {
  const nutzer = userEvent.setup();
  renderWithProviders(<BackupManager />, { locale, query: true });

  await nutzer.click(await screen.findByRole('button', { name: locale === 'de' ? 'Backup hochladen' : 'Upload backup' }));

  // Direkt am (versteckten) Dateifeld: der sichtbare Knopf löst nur dessen
  // Klick aus, und ein echter Dateidialog existiert in jsdom nicht. Gesucht
  // wird im ganzen Dokument, weil der Dialog in einem Portal liegt.
  const dateiFeld = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(dateiFeld, {
    target: { files: [new File(['{}'], 'backup.json', { type: 'application/json' })] },
  });

  await nutzer.click(await screen.findByRole('button', { name: locale === 'de' ? 'Wiederherstellen' : 'Restore' }));
}

describe('BackupManager — Rückfrage vor dem Zusammenführen', () => {
  it.each([
    ['de', 'Backup ohne Konto übernehmen', 'ohne angemeldetes Konto erstellt'],
    ['en', 'Adopt backup created without an account', 'without a signed-in account'],
  ] as const)(
    '[REGRESSION] sollte in %s beim eigenen lokalen Backup nicht von einem anderen Konto sprechen',
    async (locale, titel, kernaussage) => {
      stubs.restoreBackup.mockRejectedValue(new ForeignBackupError('localToAccount'));

      await bisZurRueckfrage(locale);

      expect(await screen.findByText(titel)).toBeInTheDocument();
      expect(screen.getByText(new RegExp(kernaussage))).toBeInTheDocument();
      // Die Falschaussage darf nirgends mehr stehen.
      expect(screen.queryByText(/anderen Benutzerkonto|different user account/)).toBeNull();
    },
  );

  it.each([
    ['de', 'Backup aus anderem Konto'],
    ['en', 'Backup from different account'],
  ] as const)(
    '[REGRESSION] sollte in %s bei echt fremder Kennung weiterhin vor dem Fremdkonto warnen',
    async (locale, titel) => {
      stubs.restoreBackup.mockRejectedValue(new ForeignBackupError('otherAccount'));

      await bisZurRueckfrage(locale);

      expect(await screen.findByText(titel)).toBeInTheDocument();
    },
  );

  it('sollte die bestätigte Wiederherstellung als Zusammenführung ausführen (allowForeign)', async () => {
    stubs.restoreBackup.mockRejectedValueOnce(new ForeignBackupError('localToAccount'));

    await bisZurRueckfrage('de');
    await screen.findByText('Backup ohne Konto übernehmen');

    stubs.restoreBackup.mockResolvedValueOnce({
      success: true,
      message: 'ok',
      warnings: [],
      details: { transactions: 0, categories: 0, accounts: 0, settings: false, collections: 0, skippedItems: 0 },
    });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Dem Konto zuordnen' }));

    await waitFor(() => {
      expect(stubs.restoreBackup).toHaveBeenLastCalledWith(BACKUP, { allowForeign: true });
    });
  });
});
