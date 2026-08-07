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
import { GENTLE_AMOUNT_MASK, type GentleLevel } from '@/lib/gentle-mode';

const gentleLevel = vi.fn<() => GentleLevel>(() => 0);

vi.mock('@/components/providers/GentleModeProvider', () => ({
  useGentleMode: () => ({ level: gentleLevel(), enabled: gentleLevel() > 0, setLevel: vi.fn() }),
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
    gentleLevel.mockReturnValue(0);
    setup();
    expect(screen.getByText(/4\.820/)).toBeInTheDocument();
  });

  it('sollte den Saldo im Sanften Modus maskieren', () => {
    gentleLevel.mockReturnValue(3);
    setup();
    expect(screen.queryByText(/4\.820/)).toBeNull();
    expect(screen.getAllByText(GENTLE_AMOUNT_MASK).length).toBeGreaterThan(0);
  });

  it('sollte auf der verdecktesten Stufe auch die Rate maskieren', () => {
    // Stufe 3 ist die Ankunft: Hier soll gar keine Zahl entgegenspringen, auch
    // nicht die, die den Alltag bestimmt.
    gentleLevel.mockReturnValue(3);
    setup();
    expect(screen.queryByText(/150/)).toBeNull();
  });

  it('sollte auf Stufe 2 die Rate zeigen und den Saldo verdeckt lassen', () => {
    // Der Kern der Annaeherungsleiter (`docs/debt-avoidance-recovery.md`): Wer
    // handeln will, braucht die naechste Rate — nicht die Gesamtsumme. Genau
    // auf dieser Flaeche entscheidet sich, ob die Leiter mehr ist als eine
    // Einstellung.
    gentleLevel.mockReturnValue(2);
    setup();
    expect(screen.getByText(/150/)).toBeInTheDocument();
    expect(screen.queryByText(/4\.820/)).toBeNull();
  });

  it('sollte den Namen der Schuld weiterhin zeigen', () => {
    // Gegenprobe: Maskiert werden BETRAEGE, nicht die Orientierung. Eine Karte
    // ohne Namen waere unbenutzbar statt sanft.
    gentleLevel.mockReturnValue(3);
    setup();
    expect(screen.getByText('Ratenkredit')).toBeInTheDocument();
  });
});
