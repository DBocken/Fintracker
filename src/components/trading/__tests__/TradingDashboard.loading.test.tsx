/**
 * WP-8.4 — Restmigration: Ladezustände des Trading-Bereichs.
 *
 * Der Bereich hatte als einziger Screen noch inhaltsersetzende Spinner: einer
 * für den ganzen Screen, einer für die Positionsliste. Die Regel aus WP-7.3
 * gilt auch hier — ein Spinner sagt „es passiert etwas", ein Skelett sagt
 * „hier kommen Kennzahlen und eine Positionsliste".
 *
 * Geprüft wird BEIDES: dass das Skelett da ist UND dass das kreisende Symbol
 * weg ist. Ohne die Gegenprobe bestünde der Test auch, wenn beides gleichzeitig
 * gerendert würde.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';

const never = () => new Promise<never>(() => {});

const PORTFOLIO = { id: 'p1', name: 'Depot', type: 'manual', currency: 'EUR' };

const getActivePortfolio = vi.fn();
const initializeDemoPortfolio = vi.fn();

vi.mock('@/services/portfolio-service', () => ({
  initializeDemoPortfolio: () => initializeDemoPortfolio(),
  getActivePortfolio: () => getActivePortfolio(),
  // Die Positionen bleiben in JEDEM Fall ausstehend — sie sind in beiden
  // Tests der Ladezustand, der geprueft wird.
  getPositions: () => never(),
  getPortfolioSummary: () => never(),
  batchUpdatePrices: vi.fn(),
  deletePosition: vi.fn(),
}));

vi.mock('@/hooks/useLocalEncryption', () => ({
  useLocalEncryption: () => ({ unlocked: false }),
}));

import TradingDashboard from '../TradingDashboard';

describe('TradingDashboard — Ladezustand (WP-8.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sollte den Screen mit einem Skelett statt eines Spinners aufbauen', async () => {
    initializeDemoPortfolio.mockReturnValue(never());
    getActivePortfolio.mockReturnValue(never());

    const { container } = renderWithProviders(<TradingDashboard />, { query: true });

    // Erst nach der Schwelle aus der Choreografie (150 ms) — darunter wäre
    // ein gezeigtes Skelett ein Blinzeln.
    expect(await screen.findByTestId('trading-dashboard-skeleton')).toBeInTheDocument();
    expect(container.querySelector('.animate-spin')).toBeNull();
  });

  it('sollte auch die Positionsliste als Zeilen-Skelett anlegen', async () => {
    // Das Depot ist da, nur die Positionen fehlen noch. Das ist der zweite,
    // haeufigere Ladezustand — beim Wechsel des Depots steht der Rahmen
    // bereits und nur die Liste laedt nach.
    initializeDemoPortfolio.mockResolvedValue(PORTFOLIO);
    getActivePortfolio.mockResolvedValue(PORTFOLIO);

    const { container } = renderWithProviders(<TradingDashboard />, { query: true });

    expect(await screen.findByTestId('trading-positions-skeleton')).toBeInTheDocument();
    // Gegenprobe: kein kreisendes Symbol mehr im Positionsbereich.
    expect(container.querySelector('.animate-spin')).toBeNull();
  });
});
