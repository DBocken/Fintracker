import { describe, it, expect } from 'vitest';
import { addDays, getDay, getDaysInMonth } from 'date-fns';
import {
  buildOccurrenceModel,
  sampleOccurrenceMonth,
  type OccurrenceModel,
} from '../occurrence-amount';
import type { Transaction } from '@/types';

/** Seedbarer PRNG + Box-Muller-Normal für deterministische Tests. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeNormal(rng: () => number): () => number {
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const v = spare;
      spare = null;
      return v;
    }
    let u = 0;
    let v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    const mag = Math.sqrt(-2 * Math.log(u));
    spare = mag * Math.sin(2 * Math.PI * v);
    return mag * Math.cos(2 * Math.PI * v);
  };
}

function tx(date: string, amount: number, category: string): Transaction {
  return {
    date,
    amount,
    payee: 'Test',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: true,
    category,
  };
}

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthWeekdays(year: number, monthIndex0: number): number[] {
  const first = new Date(year, monthIndex0, 1);
  return Array.from({ length: getDaysInMonth(first) }, (_, i) => getDay(addDays(first, i)));
}

describe('buildOccurrenceModel', () => {
  const NOW = new Date(2026, 5, 15); // 15. Juni 2026

  it('sollte die beobachtete Ereignishäufigkeit je Wochentag reproduzieren', () => {
    // An jedem Samstag eine Ausgabe, sonst nie.
    const data: Transaction[] = [];
    let d = new Date(2025, 6, 1);
    while (d <= NOW) {
      if (getDay(d) === 6) data.push(tx(isoOf(d), -50, 'Restaurant'));
      d = addDays(d, 1);
    }
    const models = buildOccurrenceModel(data, { now: NOW });
    const model = models.get('Restaurant');
    expect(model).toBeDefined();
    // Samstag fast sicher (jeder Kalender-Samstag aktiv), Montag nie.
    expect(model!.weekdayProb[6]).toBeGreaterThan(0.9);
    expect(model!.weekdayProb[1]).toBe(0);
  });

  it('sollte Kategorien mit zu wenigen aktiven Tagen auslassen', () => {
    const data = [
      tx('2026-05-02', -50, 'Selten'),
      tx('2026-05-09', -50, 'Selten'),
      tx('2026-05-16', -50, 'Selten'),
    ];
    const models = buildOccurrenceModel(data, { now: NOW, minActiveDays: 12 });
    expect(models.has('Selten')).toBe(false);
  });
});

describe('sampleOccurrenceMonth', () => {
  const weekdays = monthWeekdays(2026, 0); // Januar 2026 (31 Tage)

  it('[REGRESSION] sollte über viele Trials erwartungstreu die Zielsumme treffen', () => {
    const model: OccurrenceModel = {
      weekdayProb: [0.2, 0.3, 0.3, 0.3, 0.3, 0.4, 0.5],
      amountCv: 0.6,
    };
    const target = 600;
    const rng = mulberry32(123);
    const normal = makeNormal(rng);

    const trials = 6000;
    let sum = 0;
    for (let i = 0; i < trials; i++) {
      const daily = sampleOccurrenceMonth(model, weekdays, weekdays, target, normal, rng);
      sum += daily.reduce((s, v) => s + v, 0);
    }
    const mean = sum / trials;
    // Erwartungstreu: Mittel der Monatssumme ≈ Ziel (±4 %).
    expect(Math.abs(mean - target) / target).toBeLessThan(0.04);
  });

  it('sollte bei seltenen Ereignissen wenige, dafür größere Spikes liefern', () => {
    const model: OccurrenceModel = {
      weekdayProb: [0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05],
      amountCv: 0.3,
    };
    const target = 600;
    const rng = mulberry32(7);
    const normal = makeNormal(rng);

    let totalNonzero = 0;
    const runs = 200;
    for (let i = 0; i < runs; i++) {
      const daily = sampleOccurrenceMonth(model, weekdays, weekdays, target, normal, rng);
      const nonzero = daily.filter((v) => v > 0);
      totalNonzero += nonzero.length;
      // Wenn etwas gebucht wird, ist es ein echter Spike – kein Mini-Tagesbetrag.
      for (const v of nonzero) expect(v).toBeGreaterThan(target / weekdays.length);
    }
    // Im Schnitt nur wenige aktive Tage pro Monat (≈ 31 · 0.05 ≈ 1.5).
    expect(totalNonzero / runs).toBeLessThan(weekdays.length * 0.25);
  });

  it('sollte bei einem Teilfenster anteilig (nicht voll) buchen', () => {
    const model: OccurrenceModel = {
      weekdayProb: [1, 1, 1, 1, 1, 1, 1],
      amountCv: 0,
    };
    const target = 310; // 31 Tage -> 10 pro Ereignistag bei vollem Monat
    const rng = mulberry32(1);
    const normal = makeNormal(rng);
    // Nur die ersten 10 Tage emittieren, aber über den vollen Monat kalibrieren.
    const emit = weekdays.slice(0, 10);
    const daily = sampleOccurrenceMonth(model, weekdays, emit, target, normal, rng);
    const sum = daily.reduce((s, v) => s + v, 0);
    // ~10 Tage × 10 € = 100 €, also klar weniger als das volle Monatsziel.
    expect(sum).toBeCloseTo(100, 5);
  });
});
