/**
 * WP-9.5 — Der Sanfte Modus wirkt jetzt auch dort, wo er am meisten zählt.
 *
 * Der Modus wird laut `docs/onboarding-life-situations.md` unter anderem für
 * `debt_focus` vorgeschlagen — für Menschen, die gerade Schulden abbauen. Bis
 * hierher zeigte ausgerechnet die Schuldenübersicht jeden Betrag ungefiltert:
 * Von 78 Dateien, die Beträge ausgeben, berücksichtigten acht den Modus, und
 * keine davon lag im Schulden-Bereich.
 *
 * Geprüft wird an einer echten Aufrufstelle statt am Hook: Dass
 * `useMoneyFormat()` maskiert, weiß der Hook-Test. Dass die Schuldenkarte ihn
 * auch BENUTZT, weiß nur dieser.
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/render';
import type { Debt } from '@/types';
import { GENTLE_AMOUNT_MASK } from '@/lib/gentle-mode';

const gentle = vi.fn(() => false);

vi.mock('@/components/providers/GentleModeProvider', () => ({
  useGentleMode: () => ({ enabled: gentle(), toggle: vi.fn() }),
}));

import { DebtCard } from '../DebtCard';

const DEBT = {
  id: 'd1',
  name: 'Ratenkredit',
  type: 'loan',
  balance: 4820,
  min_payment: 150,
  interest_rate: 6.9,
  is_paid_off: false,
} as unknown as Debt;

function setup() {
  renderWithI18n(<DebtCard debt={DEBT} onTogglePaid={vi.fn()} onOpenDetails={vi.fn()} />);
}

describe('DebtCard — Sanfter Modus (WP-9.5)', () => {
  it('sollte den Saldo normal zeigen', () => {
    gentle.mockReturnValue(false);
    setup();
    expect(screen.getByText(/4\.820/)).toBeInTheDocument();
  });

  it('sollte den Saldo im Sanften Modus maskieren', () => {
    gentle.mockReturnValue(true);
    setup();
    expect(screen.queryByText(/4\.820/)).toBeNull();
    expect(screen.getAllByText(GENTLE_AMOUNT_MASK).length).toBeGreaterThan(0);
  });

  it('sollte auch die Rate maskieren', () => {
    // Die Rate ist die Zahl, die den Alltag bestimmt — sie stehen zu lassen,
    // waehrend der Saldo verdeckt ist, waere ein halbes Versprechen.
    gentle.mockReturnValue(true);
    setup();
    expect(screen.queryByText(/150/)).toBeNull();
  });

  it('sollte den Namen der Schuld weiterhin zeigen', () => {
    // Gegenprobe: Maskiert werden BETRAEGE, nicht die Orientierung. Eine Karte
    // ohne Namen waere unbenutzbar statt sanft.
    gentle.mockReturnValue(true);
    setup();
    expect(screen.getByText('Ratenkredit')).toBeInTheDocument();
  });
});
