/**
 * WP-9.6 — EINE Ursache, EINE Aussage (Gegenstück zu
 * `AccountsPage.error-state.test.tsx`).
 *
 * Fällt der lokale Speicher als Ganzes aus, scheitern auf `/tax` sowohl die
 * Abfragen der Seite (Buchungen, Kategorien, Jahresprofil) als auch die der
 * Vorschlagsrubrik (Automatisierungs-Vorschläge, Konten). Nimmt jede Fläche
 * den Fehler für sich in die Hand, steht zweimal derselbe Satz untereinander.
 *
 * Die Vorschlagsrubrik behält ihren eigenen Fehlerzustand — sie kann auch
 * allein scheitern, und dann ist er richtig. Sie tritt nur zurück, wenn die
 * Seite bereits dasselbe sagt.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

// Die Ablehnung steht INLINE in den Fabriken: `vi.mock` wird an den Dateianfang
// gehoben, eine Konstante davor waere zur Aufrufzeit noch nicht initialisiert.
vi.mock('@/services/transaction-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getTransactions: () => Promise.reject(new Error('IndexedDB nicht erreichbar')),
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
  it('[REGRESSION] sollte den Ladefehler genau EINMAL benennen', async () => {
    renderWithProviders(<TaxReportPage />, { query: true, router: true });

    await screen.findByRole('alert');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Erneut versuchen' })).toHaveLength(1);
  });
});
