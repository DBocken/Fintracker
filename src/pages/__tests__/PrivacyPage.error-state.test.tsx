/**
 * Fehlerzustand der Datenschutz-Fläche (WP-12.1).
 *
 * Diese Seite sagt, was mit den Daten geschieht. Kann sie den
 * Einwilligungsstand nicht lesen, darf sie ihn nicht raten — eine falsche
 * Angabe wäre hier ein gebrochenes Versprechen, keine Unbequemlichkeit.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

// Die Einwilligungs-Abfrage laeuft nur fuer angemeldete Nutzer
// (`enabled: tier !== 'anonymous'`) — anonym gibt es keinen Zustand, der
// scheitern koennte, und der Test pruefte ins Leere.
vi.mock('@/hooks/useTier', () => ({ useTier: () => 'free' }));

// Der Verschluesselungs-Kontext ist fuer diese Frage ohne Belang, seine
// Abwesenheit wuerde die Seite aber vor dem ersten Render abbrechen lassen.
vi.mock('@/hooks/useLocalEncryption', () => ({
  useLocalEncryption: () => ({ enabled: false, unlocked: true }),
}));

vi.mock('@/services/analytics-consent-service', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getAnalyticsConsent: () => Promise.reject(new Error('IndexedDB nicht erreichbar')),
}));

import PrivacyPage from '../PrivacyPage';

describe('Fehlerzustand der Datenschutz-Fläche', () => {
  it('[ZUSTAND /privacy:fehler] sollte den Ladefehler benennen statt einen Einwilligungsstand zu raten', async () => {
    renderWithProviders(<PrivacyPage />, { query: true, router: true });

    await screen.findByRole('alert', {}, { timeout: 4000 });

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
