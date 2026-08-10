/**
 * Fehlerzustand der Export-Fläche (WP-12.1, verschärft WP 7.1).
 *
 * Ein Export aus unlesbaren Daten ist die gefährlichste Datei der App: Sie
 * sieht aus wie ein Backup und ist leer.
 *
 * **[REGRESSION] Der Befund, den die Verschärfung freigelegt hat (WP 7.1,
 * TEST-4).** Der Test fragte bis hierher nur nach einem `role="alert"` — und
 * war deshalb grün, obwohl unter dem Fehlerhinweis das vollständige
 * Exportformular weiterlief: „Anzahl Transaktionen: 0", „0 Transaktionen
 * exportieren" und der Satz „Keine Transaktionen zum Exportieren verfügbar.
 * Importiere zuerst Daten …". Zwei widersprechende Aussagen auf einer Fläche,
 * und die untere schickt den Nutzer los, Daten neu zu erfassen, die es längst
 * gibt. Dieselbe Gleichzeitigkeit wie in `AccountManager` (WP 6.5a).
 * `DataExport.tsx` setzt den Fehlerzustand jetzt an die STELLE des Formulars.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

vi.mock('@/services/transaction-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getTransactions: () => Promise.reject(new Error('IndexedDB nicht erreichbar')),
}));

import ExportPage from '../ExportPage';

describe('Fehlerzustand der Export-Fläche', () => {
  it('[REGRESSION] [ZUSTAND /export:fehler] sollte (de) den Ladefehler benennen statt einen leeren Export anzubieten', async () => {
    renderWithProviders(<ExportPage />, { query: true, router: true, locale: 'de' });

    await screen.findByText('Deine Buchungen konnten nicht geladen werden', {}, { timeout: 4000 });

    // Bewusst `getAllBy…`: Der irreführende Satz „Keine Transaktionen zum
    // Exportieren verfügbar" ist selbst ein `<Alert>` (role="alert"). Ein
    // `getBy…` würde bei beiden Aussagen an der Mehrdeutigkeit scheitern
    // statt an der Sache — die Aussage darüber trifft die Zusicherung darunter.
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    // Die irreführende Aussage: „nichts zu exportieren, importiere zuerst".
    expect(
      screen.queryByText(
        'Keine Transaktionen zum Exportieren verfügbar. Importiere zuerst Daten oder wähle einen anderen Zeitraum.',
      ),
    ).toBeNull();
    // Und die Zahl, die dasselbe schärfer behauptet.
    expect(screen.queryByText('Anzahl Transaktionen:')).toBeNull();
    expect(screen.queryByRole('button', { name: /Transaktionen exportieren/ })).toBeNull();
  });

  it('[REGRESSION] [ZUSTAND /export:fehler] sollte (en) den Ladefehler benennen statt einen leeren Export anzubieten', async () => {
    renderWithProviders(<ExportPage />, { query: true, router: true, locale: 'en' });

    await screen.findByText('Your transactions could not be loaded', {}, { timeout: 4000 });

    // Bewusst `getAllBy…`: Der irreführende Satz „Keine Transaktionen zum
    // Exportieren verfügbar" ist selbst ein `<Alert>` (role="alert"). Ein
    // `getBy…` würde bei beiden Aussagen an der Mehrdeutigkeit scheitern
    // statt an der Sache — die Aussage darüber trifft die Zusicherung darunter.
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    expect(
      screen.queryByText(
        'No transactions available for export. Import data first or select a different time range.',
      ),
    ).toBeNull();
    expect(screen.queryByRole('button', { name: /Export .* transactions/i })).toBeNull();
  });
});
