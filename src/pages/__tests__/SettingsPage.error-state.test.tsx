/**
 * Fehlerzustand der Einstellungen (WP-12.1).
 *
 * Ohne gelesene Kategorien zeigte die Fläche „0 Kategorien" und eine leere
 * Verwaltung. Wer daraufhin neu anlegt, erzeugt Duplikate zu Kategorien, die
 * es längst gibt — ein Lesefehler, der Daten erzeugt.
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
  it('[ZUSTAND /settings:fehler] sollte den Ladefehler benennen statt „0 Kategorien"', async () => {
    renderWithProviders(<SettingsPage />, { query: true, router: true });

    await screen.findByRole('alert', {}, { timeout: 4000 });

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
