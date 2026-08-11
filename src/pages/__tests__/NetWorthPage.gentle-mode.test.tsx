/**
 * Issue #296 — Der Sanfte Modus wirkt jetzt auch auf der Vermögensseite.
 *
 * Das Nettovermögen ist die Fläche, vor der jemand mit Vermeidungsverhalten am
 * ehesten zurückschreckt — und sie war die mit den meisten ungeschützten
 * Beträgen: zwölf Aufrufe eines eigenen `Intl`-Formatierers, keiner davon
 * maskiert. Wer den Modus einschaltete, bekam hier trotzdem jede Zahl.
 *
 * Geprüft wird an der echten Fläche, nicht am Hook: Dass `useMoneyFormat()`
 * maskiert, weiß sein eigener Test. Dass diese Seite ihn auch BENUTZT, weiß
 * nur dieser.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test-utils/render';
import { GENTLE_AMOUNT_MASK, type GentleLevel } from '@/lib/gentle-mode';
import type { NetWorthBreakdown } from '@/services/net-worth-service';

const gentleLevel = vi.fn<() => GentleLevel>(() => 0);

vi.mock('@/components/providers/GentleModeProvider', () => ({
  useGentleMode: () => ({ level: gentleLevel(), enabled: gentleLevel() > 0, setLevel: vi.fn() }),
}));

const BREAKDOWN = {
  netWorth: 51234,
  cash: 12345,
  investments: 40111,
  receivables: 778,
  debts: 2000,
  accountSources: [{ id: 'a1', name: 'Girokonto', balance: 12345 }],
  portfolioSources: [{ id: 'p1', name: 'Depot', value: 40111 }],
  receivableSources: [{ id: 'r1', name: 'Freundin', amount: 778 }],
  debtSources: [{ id: 'd1', name: 'Ratenkredit', balance: 2000 }],
  unconvertedInvestments: [],
} as unknown as NetWorthBreakdown;

vi.mock('@/services/net-worth-service', () => ({
  getNetWorthBreakdown: () => Promise.resolve(BREAKDOWN),
}));

describe('NetWorthPage — Sanfter Modus (Issue #296)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sollte die Beträge ohne Sanften Modus zeigen', async () => {
    gentleLevel.mockReturnValue(0);
    const { default: NetWorthPage } = await import('../NetWorthPage');
    renderWithProviders(<NetWorthPage />, { query: true });

    expect(await screen.findByText(/51\.234/)).toBeInTheDocument();
    expect(screen.getAllByText(/12\.345/).length).toBeGreaterThan(0);
  });

  it('[REGRESSION] sollte auf der verdecktesten Stufe KEINEN Betrag durchlassen', async () => {
    gentleLevel.mockReturnValue(3);
    const { default: NetWorthPage } = await import('../NetWorthPage');
    renderWithProviders(<NetWorthPage />, { query: true });

    expect(await screen.findAllByText(GENTLE_AMOUNT_MASK)).not.toHaveLength(0);
    // Keine der vier Kernzahlen darf irgendwo stehen — auch nicht in einer
    // Detailzeile, die man beim Umstellen leicht übersieht.
    for (const zahl of [/51\.234/, /12\.345/, /40\.111/, /2\.000/]) {
      expect(screen.queryByText(zahl)).toBeNull();
    }
  });
});
