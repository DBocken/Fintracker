/**
 * WP-9.6 — EINE Ursache, EINE Aussage. Verschärft in WP 7.1 (TEST-4).
 *
 * `AccountsPage` setzt zwei Karten übereinander, und beide lesen dieselbe
 * Abfrage `["accounts"]`. Nimmt jede Karte den Fehlerfall für sich in die
 * Hand, steht nach einem einzigen fehlgeschlagenen Lesevorgang zweimal
 * dasselbe auf dem Bildschirm — zwei „Erneut versuchen" für ein Problem.
 *
 * Das ist derselbe Befund, der auf `/debts` schon einmal aufgetreten ist:
 * Der Wächter zählt Aufrufstellen, er sieht die Fläche nicht. Deshalb steht
 * die Regel hier als Test.
 *
 * **Was WP 7.1 ergänzt.** Die Einmaligkeit war geprüft, die Abwesenheit des
 * Leerzustands nicht — dabei ist genau DAS der Befund, den WP 6.5a in
 * `AccountManager` real gefunden hat: Fehlertext und „Noch keine Konten
 * angelegt" standen gleichzeitig da, weil ein Lesefehler dieselbe leere Liste
 * hinterlässt wie ein leerer Speicher. Die Trennung (`isEmpty` statt
 * `rows.length === 0`, siehe `features/accounts/presentation/AccountList.tsx`)
 * bekommt hier ihren Wächter.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

// Ohne das bleibt `FeatureGate` im Ladezustand und rendert `AccountManager`
// gar nicht — der Test waere gruen, ohne die Doppelung je zu sehen.
vi.mock('@/components/providers/AuthProvider', () => ({
  useAuth: () => ({ status: 'authenticated' }),
}));

vi.mock('@/services/account-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getAccounts: () => Promise.reject(new Error('IndexedDB nicht erreichbar')),
}));

import AccountsPage from '../AccountsPage';

describe('Fehlerzustand auf dem Konten-Screen (WP-9.6)', () => {
  it('[REGRESSION] [ZUSTAND /accounts:fehler] sollte (de) den Ladefehler genau EINMAL benennen — und keinen Leerzustand daneben', async () => {
    renderWithProviders(<AccountsPage />, { query: true });

    await screen.findByText('Deine Daten konnten nicht geladen werden');
    expect(screen.getAllByText('Deine Daten konnten nicht geladen werden')).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Erneut versuchen' })).toHaveLength(1);
    // Der Befund aus WP 6.5a: Fehlertext UND „Noch keine Konten angelegt"
    // gleichzeitig. Ein Lesefehler ist kein leerer Kontenbestand.
    expect(screen.queryByText('Noch keine Konten angelegt')).toBeNull();
  });

  it('[ZUSTAND /accounts:fehler] sollte (en) den Ladefehler benennen — und keinen Leerzustand daneben', async () => {
    renderWithProviders(<AccountsPage />, { query: true, locale: 'en' });

    await screen.findByText('Your data could not be loaded');
    expect(screen.getAllByText('Your data could not be loaded')).toHaveLength(1);
    expect(screen.queryByText('No accounts yet')).toBeNull();
  });
});
