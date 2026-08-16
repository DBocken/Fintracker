/**
 * Zustände der Kauf-Fläche `/billing` (WP 6.3).
 *
 * **Warum diese Fläche die Zustände besonders sauber trennen muss.** „Kein
 * Abo" und „Status nicht prüfbar" sehen einander zum Verwechseln ähnlich,
 * sagen aber das Gegenteil. Bei `/debts` hat genau diese Verwechslung einmal
 * behauptet, es gebe keine Schulden; hier wäre sie teurer — sie behauptet
 * gegenüber einem **zahlenden** Nutzer, er habe kein Abo, und bietet ihm an,
 * noch einmal zu kaufen.
 *
 * Der dritte Zustand ist der heutige Normalfall: Ohne konfigurierten Dienst
 * gibt es nichts zu kaufen. Auch das wird benannt statt mit einer
 * Kauf-Schaltfläche überspielt, die ins Leere führt.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

const entitlementMock = vi.hoisted(() => ({
  fetchSubscription: vi.fn(),
  isBillingConfigured: vi.fn(() => true),
}));

vi.mock('@/services/entitlement-service', () => ({
  fetchSubscription: entitlementMock.fetchSubscription,
  startCheckout: vi.fn(),
}));

// Die Konfigurationsfrage liegt in `lib/` und nicht im Service: Sie liest nur
// `import.meta.env` und macht kein I/O (§3) — laege sie im Service, muesste
// jede Flaeche, die nur wissen will, ob es etwas zu kaufen gibt, einen
// I/O-Service importieren, und `check:view-data` zaehlt genau das.
vi.mock('@/lib/billing-config', () => ({
  isBillingConfigured: entitlementMock.isBillingConfigured,
  entitlementBaseUrl: () => 'https://dienst.beispiel.invalid',
}));

vi.mock('@/components/providers/AuthProvider', () => ({
  useAuth: () => ({
    identity: { userId: 'user-a', email: 'a@example.com', claims: {} },
    status: 'authenticated',
  }),
}));

import BillingPage from '../BillingPage';

beforeEach(() => {
  entitlementMock.fetchSubscription.mockReset();
  entitlementMock.isBillingConfigured.mockReturnValue(true);
});

describe('Zustände der Kauf-Fläche', () => {
  it('[ZUSTAND /billing:leer] sollte (de) ohne Abo das Kaufangebot zeigen statt eines Fehlers', async () => {
    entitlementMock.fetchSubscription.mockResolvedValue({ status: 'none' });

    renderWithProviders(<BillingPage />, { query: true, router: true, locale: 'de' });

    expect(await screen.findByText('Alles freischalten', {}, { timeout: 4000 })).toBeInTheDocument();
    // Und ausdrücklich NICHT der Fehlersatz: Ein Kaufangebot ist kein Defekt.
    expect(screen.queryByText('Wir konnten gerade nicht nachsehen')).not.toBeInTheDocument();
  });

  it('[ZUSTAND /billing:leer] sollte (en) ohne Abo das Kaufangebot zeigen', async () => {
    entitlementMock.fetchSubscription.mockResolvedValue({ status: 'none' });

    renderWithProviders(<BillingPage />, { query: true, router: true, locale: 'en' });

    expect(await screen.findByText('Unlock Premium', {}, { timeout: 4000 })).toBeInTheDocument();
  });

  it('[ZUSTAND /billing:fehler] sollte (de) den Prüffehler benennen statt „kein Abo" zu behaupten', async () => {
    entitlementMock.fetchSubscription.mockRejectedValue(new Error('Dienst nicht erreichbar'));

    renderWithProviders(<BillingPage />, { query: true, router: true, locale: 'de' });

    expect(await screen.findByText('Wir konnten gerade nicht nachsehen', {}, { timeout: 4000 })).toBeInTheDocument();
    // Die irreführende Aussage muss WEG sein, nicht nur der Fehler zusätzlich
    // dastehen — beides gleichzeitig war der reale Befund in AccountManager.
    expect(screen.queryByText('Alles freischalten')).not.toBeInTheDocument();
  });

  it('[ZUSTAND /billing:fehler] sollte (en) den Prüffehler benennen', async () => {
    entitlementMock.fetchSubscription.mockRejectedValue(new Error('Dienst nicht erreichbar'));

    renderWithProviders(<BillingPage />, { query: true, router: true, locale: 'en' });

    expect(
      await screen.findByText('We could not check just now', {}, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Unlock Premium')).not.toBeInTheDocument();
  });

  it('sollte beruhigen, dass die eigenen Daten vom Prüffehler unberührt sind', async () => {
    // Für eine Finanz-App der wichtigste Satz am Fehler: Ein Lesefehler liest
    // sich sonst wie ein Datenverlust.
    entitlementMock.fetchSubscription.mockRejectedValue(new Error('Dienst nicht erreichbar'));

    renderWithProviders(<BillingPage />, { query: true, router: true, locale: 'de' });

    expect(await screen.findByText(/liegen auf deinem Gerät/, {}, { timeout: 4000 })).toBeInTheDocument();
  });

  it('sollte ohne konfigurierten Zahlungsweg keine Kauf-Schaltfläche anbieten', async () => {
    // Heutiger Normalfall: Der Dienst ist nicht deployt. Eine Schaltfläche,
    // die ins Leere führt, wäre schlimmer als ihr Fehlen.
    entitlementMock.isBillingConfigured.mockReturnValue(false);

    renderWithProviders(<BillingPage />, { query: true, router: true, locale: 'de' });

    expect(
      await screen.findByText('Kaufen geht hier noch nicht', {}, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Freischalten')).not.toBeInTheDocument();
    expect(entitlementMock.fetchSubscription).not.toHaveBeenCalled();
  });

  it('sollte ein aktives Abo mit Gültigkeitsdatum zeigen', async () => {
    entitlementMock.fetchSubscription.mockResolvedValue({
      status: 'active',
      product: 'premium_monthly',
      validUntil: new Date('2026-09-01T00:00:00Z'),
      source: 'mollie',
    });

    renderWithProviders(<BillingPage />, { query: true, router: true, locale: 'de' });

    expect(await screen.findByText('Du hast alles freigeschaltet', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.queryByText('Alles freischalten')).not.toBeInTheDocument();
  });
});
