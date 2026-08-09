/**
 * Fremdwährung im Nettovermögen (VE-1, WP 7.7).
 *
 * `getNetWorthBreakdown` übernahm bis WP 7.7 den Depotwert unverändert — eine
 * USD-Position erhöhte das Euro-Vermögen 1:1. Jetzt zählt nur, was in Euro
 * notiert; der Rest steht sichtbar daneben. Bilingual (de + en), ohne Mocks:
 * der Testspeicher wird mit echten Positionen gefüllt.
 */
import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';
import { createPortfolio, createPosition } from '@/services/portfolio-service';

import NetWorthPage from '../NetWorthPage';

const EXPECTED = {
  de: 'Fremdwährung nicht verrechnet',
  en: 'Foreign currency not included',
} as const;

async function seedMixedPortfolio() {
  const portfolio = await createPortfolio({ name: 'Depot', currency: 'EUR', type: 'manual' });
  await createPosition({ portfolio_id: portfolio.id, symbol: 'SAP', quantity: 10, entry_price: 100, currency: 'EUR' });
  await createPosition({ portfolio_id: portfolio.id, symbol: 'AAPL', quantity: 5, entry_price: 178.5, currency: 'USD' });
}

describe('NetWorthPage — Fremdwährung wird ausgewiesen', () => {
  it.each(['de', 'en'] as const)(
    '[ZUSTAND /net-worth:geladen] sollte in %s die nicht verrechneten Bestände benennen',
    async (locale) => {
      await seedMixedPortfolio();

      renderWithProviders(<NetWorthPage />, { query: true, router: true, locale });

      await waitFor(() => expect(screen.getByText(EXPECTED[locale])).toBeInTheDocument(), { timeout: 4000 });
    },
  );

  it('[REGRESSION] sollte das Nettovermögen ohne den USD-Bestand ausweisen', async () => {
    await seedMixedPortfolio();

    renderWithProviders(<NetWorthPage />, { query: true, router: true });

    // 1.000 € aus der EUR-Position; die 892,50 $ sind bewusst NICHT enthalten
    // (vor WP 7.7 stand hier 1.893 € — 1.892,50 gerundet).
    await waitFor(() => expect(screen.getAllByText('1.000 €').length).toBeGreaterThan(0), { timeout: 4000 });
    expect(screen.queryByText(/1\.89[23]\s*€/)).toBeNull();
  });
});
