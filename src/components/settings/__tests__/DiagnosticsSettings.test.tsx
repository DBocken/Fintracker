import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithI18n } from '@/test-utils/render';
import { translations } from '@/i18n/translations';
import DiagnosticsSettings from '../DiagnosticsSettings';
import { appendErrorLogEntry, clearErrorLog, getErrorLog } from '@/services/error-log-service';

beforeEach(async () => {
  window.localStorage.clear();
  await clearErrorLog();
});

describe('DiagnosticsSettings', () => {
  describe('Normal Behavior (Deutsch)', () => {
    it('sollte den leeren Zustand deutsch rendern', async () => {
      renderWithI18n(<DiagnosticsSettings />, 'de');
      expect(await screen.findByText('Keine Fehler protokolliert.')).toBeInTheDocument();
      expect(screen.getByText('Fehlerprotokoll')).toBeInTheDocument();
    });

    it('sollte vorhandene Einträge mit Anzahl anzeigen', async () => {
      await appendErrorLogEntry({ level: 'error', source: 'window', message: 'Testfehler A' });
      renderWithI18n(<DiagnosticsSettings />, 'de');
      expect(await screen.findByText(/Testfehler A/)).toBeInTheDocument();
      expect(screen.getByText('1 Einträge')).toBeInTheDocument();
    });

    it('sollte den Stacktrace erst nach Klick auf den Eintrag zeigen (Akkordion)', async () => {
      await appendErrorLogEntry({
        level: 'error',
        source: 'window',
        message: 'Mit Stack',
        stack: 'at kaputteFunktion (chunk.js:1:2)',
      });
      renderWithI18n(<DiagnosticsSettings />, 'de');
      const row = await screen.findByRole('button', { name: /Mit Stack/ });
      expect(screen.queryByText(/kaputteFunktion/)).not.toBeInTheDocument();
      await userEvent.click(row);
      expect(await screen.findByText(/kaputteFunktion/)).toBeInTheDocument();
    });

    it('sollte das Protokoll nach Bestätigung im Dialog leeren', async () => {
      await appendErrorLogEntry({ level: 'error', source: 'manual', message: 'weg damit' });
      renderWithI18n(<DiagnosticsSettings />, 'de');
      await userEvent.click(await screen.findByRole('button', { name: 'Leeren' }));
      await userEvent.click(await screen.findByRole('button', { name: 'Endgültig leeren' }));
      await waitFor(async () => expect(await getErrorLog()).toHaveLength(0));
      expect(await screen.findByText('Keine Fehler protokolliert.')).toBeInTheDocument();
    });

    it('sollte das Protokoll als JSON in die Zwischenablage kopieren', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });
      await appendErrorLogEntry({ level: 'error', source: 'manual', message: 'kopier mich' });
      renderWithI18n(<DiagnosticsSettings />, 'de');
      await userEvent.click(await screen.findByRole('button', { name: 'Kopieren' }));
      await waitFor(() => expect(writeText).toHaveBeenCalled());
      expect(writeText.mock.calls[0][0]).toContain('kopier mich');
    });
  });

  describe('English locale', () => {
    it('should render the empty state in English', async () => {
      renderWithI18n(<DiagnosticsSettings />, 'en');
      expect(await screen.findByText('No errors logged.')).toBeInTheDocument();
      expect(screen.getByText('Error log')).toBeInTheDocument();
    });
  });

  describe('Regression Protection', () => {
    it('[REGRESSION] sollte alle i18n-Keys in beiden Sprachen haben', () => {
      const keys = [
        'title',
        'description',
        'empty',
        'entryCount',
        'lastError',
        'copyButton',
        'exportButton',
        'clearButton',
        'copySuccess',
        'copyError',
        'clearSuccess',
        'clearConfirmTitle',
        'clearConfirmMessage',
        'clearConfirmAction',
        'clearConfirmCancel',
        'showStack',
      ];
      const de = translations.de.settings.diagnostics as Record<string, string>;
      const en = translations.en.settings.diagnostics as Record<string, string>;
      keys.forEach((key) => {
        expect(de[key], `de: settings.diagnostics.${key}`).toBeDefined();
        expect(en[key], `en: settings.diagnostics.${key}`).toBeDefined();
      });
    });
  });
});
