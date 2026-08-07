/**
 * WP-9.6 — EINE Ursache, EINE Aussage.
 *
 * `AccountsPage` setzt zwei Karten übereinander, und beide lesen dieselbe
 * Abfrage `["accounts"]`. Nimmt jede Karte den Fehlerfall für sich in die
 * Hand, steht nach einem einzigen fehlgeschlagenen Lesevorgang zweimal
 * dasselbe auf dem Bildschirm — zwei „Erneut versuchen" für ein Problem.
 *
 * Das ist derselbe Befund, der auf `/debts` schon einmal aufgetreten ist:
 * Der Wächter zählt Aufrufstellen, er sieht die Fläche nicht. Deshalb steht
 * die Regel hier als Test.
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
  it('[REGRESSION] sollte den Ladefehler genau EINMAL benennen', async () => {
    renderWithProviders(<AccountsPage />, { query: true });

    await screen.findByText('Deine Daten konnten nicht geladen werden');
    expect(screen.getAllByText('Deine Daten konnten nicht geladen werden')).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Erneut versuchen' })).toHaveLength(1);
  });
});
