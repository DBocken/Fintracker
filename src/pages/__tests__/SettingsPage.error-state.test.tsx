/**
 * Fehlerzustand der Einstellungen (WP-12.1, verschärft WP 7.1).
 *
 * Ohne gelesene Kategorien zeigte die Fläche „0 Kategorien" und eine leere
 * Verwaltung. Wer daraufhin neu anlegt, erzeugt Duplikate zu Kategorien, die
 * es längst gibt — ein Lesefehler, der Daten erzeugt.
 *
 * **Warum die Anwesenheit des Fehlers nicht reicht (WP 7.1, TEST-4).** Der
 * Test fragte bis hierher nur nach einem `role="alert"`. Grün wäre er damit
 * auch dann, wenn die Kennzahlenreihe „Kategorien 0" daneben stünde — genau
 * die Gleichzeitigkeit, die `AccountManager` real hatte (WP 6.5a). Die Weiche
 * dagegen ist der frühe `return` in `EnhancedSettings.tsx`; dieser Test ist
 * ihr Wächter.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

// Der Verschluesselungs-Kontext ist fuer diese Frage ohne Belang, seine
// Abwesenheit wuerde die Seite aber vor dem ersten Render abbrechen lassen.
vi.mock('@/hooks/useLocalEncryption', () => ({
  useLocalEncryption: () => ({ enabled: false, unlocked: true }),
}));

vi.mock('@/services/transaction-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getHierarchicalCategories: () => Promise.reject(new Error('IndexedDB nicht erreichbar')),
}));

import SettingsPage from '../SettingsPage';

describe('Fehlerzustand der Einstellungen', () => {
  it('[ZUSTAND /settings:fehler] sollte (de) den Ladefehler benennen statt „0 Kategorien"', async () => {
    renderWithProviders(<SettingsPage />, { query: true, router: true, locale: 'de' });

    await screen.findByText('Deine Daten konnten nicht geladen werden', {}, { timeout: 4000 });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    // Die Kennzahl „Kategorien 0" ist die irreführende Aussage — sie liest
    // sich wie ein Bestand und ist in Wahrheit ein ungelesener Wert.
    expect(screen.queryByText('Kategorien')).toBeNull();
    expect(screen.queryByText('Einstellungen')).toBeNull();
  });

  it('[ZUSTAND /settings:fehler] sollte (en) den Ladefehler benennen statt „0 Kategorien"', async () => {
    renderWithProviders(<SettingsPage />, { query: true, router: true, locale: 'en' });

    await screen.findByText('Your data could not be loaded', {}, { timeout: 4000 });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Categories')).toBeNull();
    expect(screen.queryByText('Settings')).toBeNull();
  });
});
