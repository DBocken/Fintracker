/**
 * Kennzahlenreihe der Trading-Fläche (WP 6.3).
 *
 * Zwei Aussagen: Die vier Werte bleiben vollständig sichtbar (das ist die
 * Umschichtung), und sie stehen NICHT mehr in vier toten Karten-Rahmen (das ist
 * die Korrektur — AGENTS.md §9, „Karten sind Aktionen"). Der zweite Teil war
 * bis WP 6.3 unsichtbar: Solange die Kacheln in derselben Datei wie die
 * Aktionsleiste standen, sah `pnpm check:card-rule` dort `onClick=` und hielt
 * die Fläche für interaktiv.
 *
 * Bilingual (de + en) über `@/test-utils/render`.
 */
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/render';
import type { PortfolioSummary } from '@/types';
import TradingSummaryStats from '../TradingSummaryStats';

const SUMMARY: PortfolioSummary = {
  total_value: 1250,
  total_cost: 1000,
  unrealized_gain_loss: 250,
  unrealized_gain_loss_percent: 25,
  positions_count: 3,
  currency: 'EUR',
  unconverted_positions: [],
};

// Beschriftungen im Standard-Sprachstil (`everyday`) — „Rendite"/„Return"
// heisst dort „Gewinn in Prozent"/„Gain as a percentage".
const LABELS = {
  de: ['Gesamtwert', 'Investiert', 'Gewinn/Verlust', 'Gewinn in Prozent'],
  en: ['Total value', 'Invested', 'Gain/Loss', 'Gain as a percentage'],
} as const;

describe('TradingSummaryStats', () => {
  it.each(['de', 'en'] as const)('sollte in %s alle vier Kennzahlen benennen', (locale) => {
    renderWithI18n(<TradingSummaryStats summary={SUMMARY} isEtoro={false} />, locale);

    for (const label of LABELS[locale]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getAllByText('+25.00%').length).toBeGreaterThan(0);
  });

  it('[REGRESSION] sollte die Werte ohne Karten-Chrome zeigen — Karten sind Aktionen (§9)', () => {
    const { container } = renderWithI18n(<TradingSummaryStats summary={SUMMARY} isEtoro={false} />);

    // Readout-Bauform statt vier Kacheln: eine Beschreibungsliste, kein Rahmen,
    // kein Schatten, nichts, was faelschlich antippbar aussieht.
    const list = container.querySelector('dl');
    expect(list).not.toBeNull();
    expect(container.querySelector('.shadow, .border')).toBeNull();
  });

  it('sollte den Verlust farblich als Warnung führen, nicht nur mit Vorzeichen', () => {
    const { container } = renderWithI18n(
      <TradingSummaryStats
        summary={{ ...SUMMARY, unrealized_gain_loss: -250, unrealized_gain_loss_percent: -20 }}
        isEtoro={false}
      />,
    );

    expect(container.querySelectorAll('.text-warning').length).toBeGreaterThan(0);
    expect(screen.getAllByText('-20.00%').length).toBeGreaterThan(0);
  });

  it('sollte für ein eToro-Depot den Herkunftshinweis statt der Positionszahl zeigen', () => {
    renderWithI18n(<TradingSummaryStats summary={SUMMARY} isEtoro />);

    expect(screen.queryByText('3 Positionen')).toBeNull();
  });
});
