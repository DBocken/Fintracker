/**
 * RES-7 (WP 1.6): `requestPersistentStorage()` wurde bisher fire-and-forget
 * aufgerufen — eine Verweigerung erreichte die Fläche nie. Dieser Test prüft
 * den dezenten Hinweis: kein Dauerbanner (nur sichtbar, wenn der Browser
 * tatsächlich verweigert hat), an der Stelle, an der er zählt (Backup
 * erstellen). Bilingual (de + en) über @/test-utils/render.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';
import type { Locale } from '@/i18n/translations';

const getBackupInfo = vi.fn();

vi.mock('@/services/backup-service', () => ({
  backupService: {
    getBackupInfo: () => getBackupInfo(),
    exportBackup: vi.fn(),
    importBackup: vi.fn(),
  },
}));

const deniedMock = vi.fn(() => false);
vi.mock('@/hooks/usePersistentStorageDenied', () => ({
  usePersistentStorageDenied: () => deniedMock(),
}));

import { BackupManager } from '../BackupManager';

const HINTS: Record<Locale, RegExp> = {
  de: /dauerhaften Speicher nicht zugesichert/i,
  en: /has not granted persistent storage/i,
  ru: /не подтвердил постоянное хранилище/i,
  tlh: /./,
};

describe('BackupManager — dezenter Persistenz-Hinweis', () => {
  beforeEach(() => {
    getBackupInfo.mockResolvedValue({
      transactions: 0,
      categories: 0,
      accounts: 0,
      estimatedSize: 0,
    });
  });

  for (const locale of ['de', 'en'] as const) {
    it(`[REGRESSION] sollte bei Verweigerung einen Hinweis zeigen (${locale})`, async () => {
      deniedMock.mockReturnValue(true);
      renderWithProviders(<BackupManager />, { query: true, locale });

      expect(await screen.findByText(HINTS[locale])).toBeInTheDocument();
    });

    it(`sollte ohne Verweigerung keinen Hinweis zeigen — kein Dauerbanner (${locale})`, async () => {
      deniedMock.mockReturnValue(false);
      renderWithProviders(<BackupManager />, { query: true, locale });

      // Auf das Laden der Karte warten, damit „nicht gefunden" nicht nur
      // heißt „noch nicht gerendert".
      await screen.findByText(locale === 'de' ? /Backup erstellen/i : /Create backup/i);
      expect(screen.queryByText(HINTS[locale])).not.toBeInTheDocument();
    });
  }
});
