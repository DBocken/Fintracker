/**
 * WP-9.6 — EINE Ursache, EINE Aussage (Gegenstück zu
 * `AccountsPage.error-state.test.tsx`). Verschärft in WP 7.1 (TEST-4).
 *
 * Fällt der lokale Speicher als Ganzes aus, scheitern auf `/tax` sowohl die
 * Abfragen der Seite (Buchungen, Kategorien, Jahresprofil) als auch die der
 * Vorschlagsrubrik (Automatisierungs-Vorschläge, Konten). Nimmt jede Fläche
 * den Fehler für sich in die Hand, steht zweimal derselbe Satz untereinander.
 *
 * Die Vorschlagsrubrik behält ihren eigenen Fehlerzustand — sie kann auch
 * allein scheitern, und dann ist er richtig. Sie tritt nur zurück, wenn die
 * Seite bereits dasselbe sagt.
 *
 * **[REGRESSION] Der Befund, den die Verschärfung freigelegt hat (WP 7.1).**
 * Der Test zählte `role="alert"` und den Knopf, fragte aber nie nach dem, was
 * daneben stand. Über dem Fehlerhinweis lief die Kennzahlenreihe weiter:
 * „Markierte Ausgaben 0,00 €", „Steuerermäßigung 0,00 €", „Buchungen 0". Der
 * Leerzustand „Noch nichts markiert" war längst richtig unterdrückt — die
 * Zahlen, die dasselbe schärfer behaupten, waren es nicht. Dieselbe
 * Gleichzeitigkeit wie in `AccountManager` (WP 6.5a), nur auf einer Fläche,
 * auf der Nullen bares Geld kosten.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

// Die Ablehnung steht INLINE in den Fabriken: `vi.mock` wird an den Dateianfang
// gehoben, eine Konstante davor waere zur Aufrufzeit noch nicht initialisiert.
vi.mock('@/services/transaction-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getAllTransactions: () => Promise.reject(new Error('IndexedDB nicht erreichbar')),
  getCategories: () => Promise.reject(new Error('IndexedDB nicht erreichbar')),
}));

vi.mock('@/services/automation-suggestion-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getAutomationSuggestions: () => Promise.reject(new Error('IndexedDB nicht erreichbar')),
}));

vi.mock('@/services/account-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getAccounts: () => Promise.reject(new Error('IndexedDB nicht erreichbar')),
}));

import TaxReportPage from '../TaxReportPage';

describe('Fehlerzustand auf dem Steuer-Screen (WP-9.6)', () => {
  it('[REGRESSION] [ZUSTAND /tax:fehler] sollte (de) den Ladefehler genau EINMAL benennen — ohne Nullen daneben', async () => {
    renderWithProviders(<TaxReportPage />, { query: true, router: true, locale: 'de' });

    await screen.findByRole('alert');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Erneut versuchen' })).toHaveLength(1);
    // Kein Leerzustand …
    expect(screen.queryByText('Noch nichts markiert')).toBeNull();
    // … und keine Kennzahlenreihe, die dasselbe in Zahlen behauptet.
    expect(screen.queryByText('Markierte Ausgaben')).toBeNull();
    expect(screen.queryByText('Steuerermäßigung (§35a/§35c)')).toBeNull();
  });

  it('[ZUSTAND /tax:fehler] sollte (en) den Ladefehler benennen — ohne Nullen daneben', async () => {
    renderWithProviders(<TaxReportPage />, { query: true, router: true, locale: 'en' });

    await screen.findByRole('alert');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.queryByText('Nothing marked yet')).toBeNull();
    expect(screen.queryByText('Marked expenses')).toBeNull();
  });
});
