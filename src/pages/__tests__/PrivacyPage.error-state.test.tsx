/**
 * Fehlerzustand der Datenschutz-Fläche (WP-12.1, verschärft WP 7.1).
 *
 * Diese Seite sagt, was mit den Daten geschieht. Kann sie den
 * Einwilligungsstand nicht lesen, darf sie ihn nicht raten — eine falsche
 * Angabe wäre hier ein gebrochenes Versprechen, keine Unbequemlichkeit.
 *
 * **[REGRESSION] Der Befund, den die Verschärfung freigelegt hat (WP 7.1,
 * TEST-4).** Der Test fragte bis hierher nur nach einem `role="alert"`. Grün
 * war er deshalb auch, während die Karte „Dein aktueller Server-Kontakt"
 * direkt darunter weiter behauptete, es gehe nur „Konto, Bank-Anbindung" zum
 * Server — die aggregierte Statistik fehlte in der Aufzählung, weil
 * `consent?.opted_in ?? false` einen ungelesenen Wert stillschweigend zu
 * „nicht zugestimmt" macht. Der Kommentar in `PrivacyPage.tsx` benannte genau
 * das, behoben war nur die Hälfte: Der Fehlerhinweis stand NEBEN der geratenen
 * Aussage statt an ihrer Stelle — dieselbe Gleichzeitigkeit wie in
 * `AccountManager` (WP 6.5a).
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
  it('[REGRESSION] [ZUSTAND /privacy:fehler] sollte (de) den Ladefehler benennen statt einen Einwilligungsstand zu raten', async () => {
    renderWithProviders(<PrivacyPage />, { query: true, router: true, locale: 'de' });

    await screen.findByText('Deine Daten konnten nicht geladen werden', {}, { timeout: 4000 });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    // Die geratene Aussage: eine Aufzählung dessen, was zum Server geht,
    // gebaut aus einem Wert, den die Seite nie gelesen hat.
    expect(screen.queryByText('Dein aktueller Server-Kontakt')).toBeNull();
    expect(screen.queryByText(/Server-Kontakt: Konto, Bank-Anbindung/)).toBeNull();
    // Was NICHT vom Einwilligungsstand abhängt, bleibt stehen — der Nutzer
    // verliert die Seite nicht, nur die ungedeckte Behauptung.
    expect(screen.getByText('So funktioniert das Modell')).toBeInTheDocument();
  });

  it('[ZUSTAND /privacy:fehler] sollte (en) den Ladefehler benennen statt einen Einwilligungsstand zu raten', async () => {
    renderWithProviders(<PrivacyPage />, { query: true, router: true, locale: 'en' });

    await screen.findByText('Your data could not be loaded', {}, { timeout: 4000 });

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('Your current server contact')).toBeNull();
  });
});
