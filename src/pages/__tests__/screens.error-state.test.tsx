/**
 * WP-9.6 — „nicht ladbar" ≠ „nichts erfasst", jetzt auch auf den Screens, die
 * ein Fehlschlag am unbarmherzigsten trifft.
 *
 * Der Wächter (`pnpm check:query-errors`) stellt sicher, dass der Fehlerfall
 * überhaupt in die Hand genommen wird. Was daraus WIRD, kann er nicht wissen —
 * das prüfen diese Tests, und zwar durch das echte ViewModel: Nur die
 * Datenquelle scheitert, alles andere bleibt echt.
 *
 * Die Auswahl ist nicht zufällig. Schulden und Vermögen sind die beiden
 * Screens, auf denen ein „du hast noch nichts" nach einem Lesefehler am
 * meisten anrichtet — der eine, weil er nach Entwarnung aussieht, wo keine
 * ist; der andere, weil er wie Verlust aussieht.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

// Die Ablehnung steht INLINE in den Fabriken: `vi.mock` wird an den Dateianfang
// gehoben, eine Konstante davor waere zur Aufrufzeit noch nicht initialisiert.
vi.mock('@/services/debt-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getDebts: () => Promise.reject(new Error('IndexedDB nicht erreichbar')),
}));

vi.mock('@/services/net-worth-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getNetWorthBreakdown: () => Promise.reject(new Error('IndexedDB nicht erreichbar')),
}));

import DebtsPage from '../DebtsPage';
import NetWorthPage from '../NetWorthPage';

describe('Fehlerzustand auf den Screens (WP-9.6)', () => {
  it('[REGRESSION] [ZUSTAND /debts:fehler] Schulden: sollte den Ladefehler benennen statt „noch keine Schulden"', async () => {
    renderWithProviders(<DebtsPage />, { query: true });

    expect(await screen.findByText('Deine Daten konnten nicht geladen werden')).toBeInTheDocument();
    // Gegenprobe: Ein leerer Schulden-Screen liest sich wie Entwarnung. Genau
    // die darf ein Lesefehler nicht geben.
    expect(screen.queryByText(/Noch keine Schulden/i)).toBeNull();
  });

  it('[ZUSTAND /debts:fehler] Schulden (en): sollte den Ladefehler benennen statt „noch keine Schulden"', async () => {
    renderWithProviders(<DebtsPage />, { query: true, locale: 'en' });

    expect(await screen.findByText('Your data could not be loaded')).toBeInTheDocument();
    expect(screen.queryByText(/No debts recorded yet/i)).toBeNull();
  });

  it('[REGRESSION] [ZUSTAND /net-worth:fehler] Vermögen: sollte den Ladefehler benennen statt eines Leerzustands', async () => {
    renderWithProviders(<NetWorthPage />, { query: true });

    expect(await screen.findByText('Deine Daten konnten nicht geladen werden')).toBeInTheDocument();
    // WP 7.1: Der Satz „statt eines Leerzustands" im Titel war bis hierher
    // eine Behauptung ÜBER den Test, keine Zusicherung IM Test — beide
    // Aussagen hätten gleichzeitig dastehen können (WP 6.5a,
    // `AccountManager`). Ein leeres Vermögen liest sich wie Verlust.
    expect(screen.queryByText('Noch keine Transaktionen')).toBeNull();
  });

  it('[ZUSTAND /net-worth:fehler] Vermögen (en): sollte den Ladefehler benennen statt eines Leerzustands', async () => {
    renderWithProviders(<NetWorthPage />, { query: true, locale: 'en' });

    expect(await screen.findByText('Your data could not be loaded')).toBeInTheDocument();
    expect(screen.queryByText('No transactions yet')).toBeNull();
  });

  it('sollte den Fehler ansagbar auszeichnen', async () => {
    // `role="alert"` ist der Unterschied zwischen „steht auf der Seite" und
    // „wird angesagt".
    renderWithProviders(<NetWorthPage />, { query: true });
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('sollte einen Weg aus dem Fehler anbieten', async () => {
    renderWithProviders(<DebtsPage />, { query: true });
    expect(await screen.findByRole('button', { name: 'Erneut versuchen' })).toBeInTheDocument();
  });
});
