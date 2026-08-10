/**
 * Fehlerzustand der Import-Fläche (WP-12.1, verschärft WP 7.1).
 *
 * Der Import ordnet Buchungen bestehenden Konten und Kategorien zu. Sind die
 * nicht lesbar, sieht die Zuordnung leer aus — und der Nutzer legt beim
 * Importieren Konten neu an, die es schon gibt.
 *
 * **Warum die Anwesenheit des Fehlers nicht reicht (WP 7.1, TEST-4).** Der
 * Test fragte bis hierher nur nach einem `role="alert"`. Grün wäre er damit
 * auch dann, wenn direkt darunter weiter „Bitte erstelle zuerst ein Konto"
 * stünde — zwei widersprechende Aussagen nebeneinander, so wie sie in
 * `AccountManager` real nebeneinander standen (WP 6.5a). Die Weiche dagegen
 * steht in `CsvUploader.tsx` (`!accountsError`); dieser Test ist ihr Wächter.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

vi.mock('@/services/account-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getAccounts: () => Promise.reject(new Error('IndexedDB nicht erreichbar')),
}));

import CsvPage from '../CsvPage';

describe('Fehlerzustand der Import-Fläche', () => {
  it('[ZUSTAND /csv:fehler] sollte (de) den Ladefehler benennen statt eine leere Zuordnung anzubieten', async () => {
    renderWithProviders(<CsvPage />, { query: true, router: true, locale: 'de' });

    await screen.findByText('Deine Daten konnten nicht geladen werden', {}, { timeout: 4000 });

    // Bewusst `getAllBy…`: Der irreführende Hinweis „erstelle zuerst ein
    // Konto" ist selbst ein `<Alert>` (role="alert"). Ein `getBy…` würde bei
    // beiden Aussagen an der Mehrdeutigkeit scheitern statt an der Sache —
    // die Aussage darüber trifft die Zusicherung darunter.
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    // „Erstelle zuerst ein Konto" ist die Aufforderung, etwas anzulegen, das
    // es längst gibt — nur eben gerade nicht lesbar ist.
    expect(screen.queryByText('Bitte erstelle zuerst ein Konto in den Einstellungen.')).toBeNull();
  });

  it('[ZUSTAND /csv:fehler] sollte (en) den Ladefehler benennen statt eine leere Zuordnung anzubieten', async () => {
    renderWithProviders(<CsvPage />, { query: true, router: true, locale: 'en' });

    await screen.findByText('Your data could not be loaded', {}, { timeout: 4000 });

    // Bewusst `getAllBy…`: Der irreführende Hinweis „erstelle zuerst ein
    // Konto" ist selbst ein `<Alert>` (role="alert"). Ein `getBy…` würde bei
    // beiden Aussagen an der Mehrdeutigkeit scheitern statt an der Sache —
    // die Aussage darüber trifft die Zusicherung darunter.
    expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    expect(screen.queryByText('Please create an account in Settings first.')).toBeNull();
  });
});
