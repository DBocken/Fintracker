/**
 * WP-9.5 — Der Sanfte Modus als Eigenschaft des Formatierers.
 *
 * Befund: 78 Dateien geben Beträge aus, acht berücksichtigen den Sanften
 * Modus — und diese acht mit drei verschiedenen Masken (`***`, `••`, leer).
 * Das ist kein Schludern der Aufrufstellen, sondern eine Folge davon, dass
 * Maskieren dort überhaupt eine Entscheidung ist.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { GENTLE_AMOUNT_MASK } from '@/lib/gentle-mode';
import { useMoneyFormat } from '../useMoneyFormat';

const gentle = vi.fn(() => false);

vi.mock('@/components/providers/GentleModeProvider', () => ({
  useGentleMode: () => ({ enabled: gentle(), toggle: vi.fn() }),
}));

describe('useMoneyFormat (WP-9.5)', () => {
  it('sollte im Normalfall formatieren', () => {
    gentle.mockReturnValue(false);
    const { result } = renderHook(() => useMoneyFormat());
    expect(result.current.format(1234.5)).toContain('1.234,50');
    expect(result.current.masked).toBe(false);
  });

  it('sollte im Sanften Modus maskieren', () => {
    gentle.mockReturnValue(true);
    const { result } = renderHook(() => useMoneyFormat());
    expect(result.current.format(1234.5)).toBe(GENTLE_AMOUNT_MASK);
    expect(result.current.masked).toBe(true);
  });

  it('sollte die Groessenordnung nicht durchscheinen lassen', () => {
    // Der eigentliche Zweck. Eine Maske, die die Stellenzahl nachbildet
    // (`****,**` vs `**.***,**`), verraet genau das, was ruhen soll.
    gentle.mockReturnValue(true);
    const { result } = renderHook(() => useMoneyFormat());
    expect(result.current.format(12)).toBe(result.current.format(1234567.89));
  });

  it('sollte fremd formatierte Betraege ebenfalls verdecken', () => {
    // Fuer Stellen mit eigenem Formatierer — Recharts-Achsen etwa bekommen
    // eine Funktion hereingereicht und sollen nicht umgestellt werden muessen,
    // nur um verdeckt zu werden.
    gentle.mockReturnValue(true);
    const { result } = renderHook(() => useMoneyFormat());
    expect(result.current.mask('1.234 €')).toBe(GENTLE_AMOUNT_MASK);
  });

  it('sollte fremde Formatierung im Normalfall unveraendert lassen', () => {
    gentle.mockReturnValue(false);
    const { result } = renderHook(() => useMoneyFormat());
    expect(result.current.mask('1.234 €')).toBe('1.234 €');
  });

  it('sollte eine andere Waehrung durchreichen', () => {
    gentle.mockReturnValue(false);
    const { result } = renderHook(() => useMoneyFormat());
    expect(result.current.format(10, 'USD')).toContain('$');
  });
});
