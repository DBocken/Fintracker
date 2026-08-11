/**
 * Issue #296 — Der Sanfte Modus wirkt jetzt auch in den Smart Insights.
 *
 * Die Fläche nennt die grösste Ausgabe und die grösste Einnahme beim Betrag.
 * Beides sind genau die Zahlen, vor denen der Modus schützen soll — und beide
 * standen hier ungeschützt, weil sich die Komponente einen eigenen
 * `Intl`-Formatierer gebaut hat.
 *
 * Geprüft wird an der Fläche, nicht am Hook: Dass `useMoneyFormat()` maskiert,
 * weiß sein eigener Test. Dass diese Fläche ihn BENUTZT, weiß nur dieser.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/render';
import { GENTLE_AMOUNT_MASK, type GentleLevel } from '@/lib/gentle-mode';

const gentleLevel = vi.fn<() => GentleLevel>(() => 0);

vi.mock('@/components/providers/GentleModeProvider', () => ({
  useGentleMode: () => ({ level: gentleLevel(), enabled: gentleLevel() > 0, setLevel: vi.fn() }),
}));

import { SmartInsightsPanel } from '../SmartInsightsPanel';

function setup() {
  renderWithI18n(
    <SmartInsightsPanel
      totalIncome={4000}
      totalExpenses={3000}
      topExpense={{ name: 'Miete', amount: 1234 }}
      topIncome={{ name: 'Gehalt', amount: 4000 }}
    />,
  );
}

describe('SmartInsightsPanel — Sanfter Modus (Issue #296)', () => {
  it('sollte die Beträge ohne Sanften Modus zeigen', () => {
    gentleLevel.mockReturnValue(0);
    setup();
    expect(screen.getByText(/1\.234/)).toBeInTheDocument();
  });

  it('[REGRESSION] sollte im Sanften Modus keinen Betrag durchlassen', () => {
    gentleLevel.mockReturnValue(3);
    setup();
    expect(screen.queryByText(/1\.234/)).toBeNull();
    expect(screen.queryByText(/4\.000/)).toBeNull();
    expect(screen.getAllByText(GENTLE_AMOUNT_MASK).length).toBeGreaterThan(0);
  });
});
