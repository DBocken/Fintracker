import { describe, it, expect } from 'vitest';
import { buildFlowLines, MAX_FLOW_LINES } from '../city-flow-lines';
import { buildCityLayout } from '../city-layout';
import { distinctMonthCount, isRecurring, RECURRING_MIN_MONTHS } from '../city-recurrence';
import type { CityModel } from '../city-model';

/**
 * WP-5.1 — Flusslinien für wiederkehrende Zahlungen.
 *
 * Die Stadt zeigte, WOHIN das Geld geht, aber nicht, welcher Teil davon jeden
 * Monat ohne weiteres Zutun abfließt. Genau der ist der interessante: Fixkosten
 * kann man kündigen, einmalige Ausgaben nur bereuen.
 */
function model(subcategories: Array<{ id: string; amount: number; recurringAmount?: number }>): CityModel {
  return {
    districts: [
      {
        id: 'living',
        label: 'Lebenshaltung',
        color: '#3b82f6',
        total: subcategories.reduce((sum, s) => sum + s.amount, 0),
        subcategories: subcategories.map((s) => ({ ...s, label: s.id })),
      },
    ],
  };
}

const VIEW = { level: 'city' } as const;

describe('city-recurrence', () => {
  it('sollte verschiedene Kalendermonate zählen, nicht Buchungen', () => {
    expect(distinctMonthCount(['2026-01-05', '2026-01-19', '2026-01-28'])).toBe(1);
    expect(distinctMonthCount(['2026-01-05', '2026-02-05', '2026-03-05'])).toBe(3);
  });

  it('sollte unparsbare Datumsangaben nicht als eigenen Monat zählen', () => {
    // Sonst zählte jede kaputte Zeile die Wiederkehr künstlich hoch.
    expect(distinctMonthCount(['2026-01-05', 'kaputt', ''])).toBe(1);
  });

  it('sollte ab drei verschiedenen Monaten als wiederkehrend gelten', () => {
    expect(isRecurring(['2026-01-05', '2026-02-05'])).toBe(false);
    expect(isRecurring(['2026-01-05', '2026-02-05', '2026-03-05'])).toBe(true);
    expect(RECURRING_MIN_MONTHS).toBe(3);
  });

  it('sollte eine vierteljährliche Zahlung erkennen', () => {
    // Versicherungen zahlen quartalsweise und sind Fixkosten wie jedes Abo —
    // eine Schwelle, die sie übersieht, verfehlt den Zweck.
    expect(isRecurring(['2026-01-05', '2026-04-05', '2026-07-05'])).toBe(true);
  });
});

describe('buildFlowLines', () => {
  it('sollte ohne wiederkehrende Anteile keine Linien liefern', () => {
    const m = model([{ id: 'food', amount: 300 }]);
    expect(buildFlowLines(m, buildCityLayout(m, VIEW))).toEqual([]);
  });

  it('sollte je Gebäude mit wiederkehrendem Anteil eine Linie liefern', () => {
    const m = model([
      { id: 'streaming', amount: 40, recurringAmount: 40 },
      { id: 'food', amount: 300 },
    ]);

    const lines = buildFlowLines(m, buildCityLayout(m, VIEW));

    expect(lines).toHaveLength(1);
    expect(lines[0].id).toBe('flow:living/streaming');
    expect(lines[0].amount).toBe(40);
  });

  it('sollte die Linie von der Plattenmitte zum Fuß des Gebäudes ziehen', () => {
    const m = model([{ id: 'streaming', amount: 40, recurringAmount: 40 }]);
    const layout = buildCityLayout(m, VIEW);

    const [line] = buildFlowLines(m, layout);

    expect(line.from.x).toBeCloseTo(layout.center.x, 10);
    expect(line.from.z).toBeCloseTo(layout.center.z, 10);
    // Am BODEN ankommen, nicht auf halber Gebäudehöhe.
    const bar = layout.boxes.find((b) => b.id === 'living/streaming')!;
    expect(line.to.x).toBeCloseTo(bar.center.x, 10);
    expect(line.to.z).toBeCloseTo(bar.center.z, 10);
    expect(line.to.y).toBeLessThan(bar.center.y);
    expect(line.from.y).toBeCloseTo(line.to.y, 10);
  });

  it('sollte den Anteil aus dem wiederkehrenden Betrag ableiten', () => {
    const m = model([
      { id: 'a', amount: 100, recurringAmount: 75 },
      { id: 'b', amount: 100, recurringAmount: 25 },
    ]);

    const lines = buildFlowLines(m, buildCityLayout(m, VIEW));

    expect(lines.map((l) => l.share)).toEqual([0.75, 0.25]);
    expect(lines.reduce((sum, l) => sum + l.share, 0)).toBeCloseTo(1, 10);
  });

  it('sollte die stärksten Linien behalten, wenn gedeckelt wird', () => {
    const many = Array.from({ length: MAX_FLOW_LINES + 4 }, (_, index) => ({
      id: `sub-${index}`,
      amount: 100,
      recurringAmount: index + 1, // aufsteigend: die letzten sind die stärksten
    }));
    const m = model(many);

    const lines = buildFlowLines(m, buildCityLayout(m, VIEW));

    expect(lines).toHaveLength(MAX_FLOW_LINES);
    // Absteigend sortiert, und die schwächsten sind gar nicht dabei.
    const amounts = lines.map((l) => l.amount);
    expect([...amounts].sort((a, b) => b - a)).toEqual(amounts);
    expect(Math.min(...amounts)).toBeGreaterThan(1);
  });

  it('[REGRESSION] sollte den Anteil auf die SICHTBAREN Linien beziehen', () => {
    // Sonst hinge die Stärke der wichtigsten Linie daran, wie viele andere es
    // gibt: dieselbe Zahlung sähe in einer großen Stadt dünner aus.
    const many = Array.from({ length: MAX_FLOW_LINES + 4 }, (_, index) => ({
      id: `sub-${index}`,
      amount: 100,
      recurringAmount: index + 1,
    }));
    const m = model(many);

    const lines = buildFlowLines(m, buildCityLayout(m, VIEW));

    expect(lines.reduce((sum, l) => sum + l.share, 0)).toBeCloseTo(1, 10);
  });

  it('sollte bei gleichen Beträgen eine stabile Auswahl treffen', () => {
    // Ohne Tie-Breaker wechselte die gedeckelte Auswahl zwischen zwei Renders.
    const many = Array.from({ length: MAX_FLOW_LINES + 2 }, (_, index) => ({
      id: `sub-${index}`,
      amount: 100,
      recurringAmount: 50,
    }));
    const m = model(many);
    const layout = buildCityLayout(m, VIEW);

    expect(buildFlowLines(m, layout).map((l) => l.id)).toEqual(buildFlowLines(m, layout).map((l) => l.id));
  });
});
