/**
 * WP-9.5 — Der Sanfte Modus als Eigenschaft des Formatierers.
 *
 * Befund: 78 Dateien geben Beträge aus, acht berücksichtigen den Sanften
 * Modus — und diese acht mit drei verschiedenen Masken (`***`, `••`, leer).
 * Das ist kein Schludern der Aufrufstellen, sondern eine Folge davon, dass
 * Maskieren dort überhaupt eine Entscheidung ist.
 *
 * Seit der Annäherungsleiter (`docs/debt-avoidance-recovery.md`) hängt das
 * Verdecken zusätzlich an der **Klasse** des Betrags. Geprüft wird deshalb
 * hier vor allem, dass die Voreinstellung die geschützteste ist.
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { GENTLE_AMOUNT_MASK, type GentleLevel } from '@/lib/gentle-mode';
import { useMoneyFormat } from '../useMoneyFormat';

const gentleLevel = vi.fn<() => GentleLevel>(() => 0);

vi.mock('@/components/providers/GentleModeProvider', () => ({
  useGentleMode: () => ({ level: gentleLevel(), enabled: gentleLevel() > 0, setLevel: vi.fn() }),
}));

describe('useMoneyFormat (WP-9.5)', () => {
  it('sollte im Normalfall formatieren', () => {
    gentleLevel.mockReturnValue(0);
    const { result } = renderHook(() => useMoneyFormat());
    expect(result.current.format(1234.5)).toContain('1.234,50');
    expect(result.current.masked).toBe(false);
  });

  it('sollte im Sanften Modus maskieren', () => {
    gentleLevel.mockReturnValue(3);
    const { result } = renderHook(() => useMoneyFormat());
    expect(result.current.format(1234.5)).toBe(GENTLE_AMOUNT_MASK);
    expect(result.current.masked).toBe(true);
  });

  it('sollte die Groessenordnung nicht durchscheinen lassen', () => {
    // Der eigentliche Zweck. Eine Maske, die die Stellenzahl nachbildet
    // (`****,**` vs `**.***,**`), verraet genau das, was ruhen soll.
    gentleLevel.mockReturnValue(3);
    const { result } = renderHook(() => useMoneyFormat());
    expect(result.current.format(12)).toBe(result.current.format(1234567.89));
  });

  it('sollte fremd formatierte Betraege ebenfalls verdecken', () => {
    // Fuer Stellen mit eigenem Formatierer — Recharts-Achsen etwa bekommen
    // eine Funktion hereingereicht und sollen nicht umgestellt werden muessen,
    // nur um verdeckt zu werden.
    gentleLevel.mockReturnValue(3);
    const { result } = renderHook(() => useMoneyFormat());
    expect(result.current.mask('1.234 €')).toBe(GENTLE_AMOUNT_MASK);
  });

  it('sollte fremde Formatierung im Normalfall unveraendert lassen', () => {
    gentleLevel.mockReturnValue(0);
    const { result } = renderHook(() => useMoneyFormat());
    expect(result.current.mask('1.234 €')).toBe('1.234 €');
  });

  it('sollte eine andere Waehrung durchreichen', () => {
    gentleLevel.mockReturnValue(0);
    const { result } = renderHook(() => useMoneyFormat());
    expect(result.current.format(10, 'USD')).toContain('$');
  });

  it('sollte auf Stufe 2 die naechste Rate zeigen und die Summe verdecken', () => {
    // Die Zahl, die man zum Handeln braucht — und nur sie.
    gentleLevel.mockReturnValue(2);
    const { result } = renderHook(() => useMoneyFormat());
    expect(result.current.formatInstallment(120)).toContain('120,00');
    expect(result.current.format(12400)).toBe(GENTLE_AMOUNT_MASK);
    expect(result.current.formatProgress(2100)).toBe(GENTLE_AMOUNT_MASK);
  });

  it('sollte auf Stufe 1 zusaetzlich den Fortschritt zeigen', () => {
    gentleLevel.mockReturnValue(1);
    const { result } = renderHook(() => useMoneyFormat());
    expect(result.current.formatProgress(2100)).toContain('2.100,00');
    expect(result.current.format(12400)).toBe(GENTLE_AMOUNT_MASK);
  });

  it('sollte auf Stufe 3 auch die naechste Rate verdecken', () => {
    gentleLevel.mockReturnValue(3);
    const { result } = renderHook(() => useMoneyFormat());
    expect(result.current.formatInstallment(120)).toBe(GENTLE_AMOUNT_MASK);
  });

  it('sollte die Klasse auch fuer fremd formatierte Betraege beruecksichtigen', () => {
    gentleLevel.mockReturnValue(2);
    const { result } = renderHook(() => useMoneyFormat());
    expect(result.current.mask('120 €', 'installment')).toBe('120 €');
    expect(result.current.mask('12.400 €')).toBe(GENTLE_AMOUNT_MASK);
  });

  it('sollte je Klasse Auskunft geben, ob verdeckt wird', () => {
    // Fuer Flaechen, die nicht den Text, sondern die Aussage wechseln muessen
    // („deine naechste Rate" statt „deine Gesamtschuld").
    gentleLevel.mockReturnValue(2);
    const { result } = renderHook(() => useMoneyFormat());
    expect(result.current.isMasked('installment')).toBe(false);
    expect(result.current.isMasked('total')).toBe(true);
    expect(result.current.isMasked()).toBe(true);
    expect(result.current.level).toBe(2);
  });
});
