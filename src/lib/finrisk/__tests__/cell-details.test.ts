import { describe, it, expect } from 'vitest';
import { buildDensityField } from '../density';
import { computeCellDetail } from '../cell-details';
import type { TrialAssumptions } from '../../forecast-montecarlo-types';
import type { CompositionItem } from '../scenario-payload-types';

/**
 * Zell-Details (Heatmap-Klick): aus den gezogenen Annahmen je Pfad ableiten,
 * welche konkreten Werte einen Saldo in einer Zelle (Tag × Wert-Bin) erzeugt
 * haben. Reine Logik – hier mit handgebauten Pfaden/Annahmen getestet.
 */

/** Tägliche ISO-Datumsachse (wie in Produktion: ein Eintrag pro Tag). */
function dailyDates(startISO: string, count: number): string[] {
  const out: string[] = [];
  const start = new Date(`${startISO}T00:00:00Z`);
  for (let i = 0; i < count; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

// Jan(31) + Feb(28) + März(31) = 90 Tage; Index 73 = 15. März.
const DATES = dailyDates('2026-01-01', 90);
const MID_MARCH = 73;

/** Baut eine Annahme mit konstantem Monatsbetrag für eine Kategorie. */
function assume(category: string, monthly: number, planned = monthly): TrialAssumptions {
  return {
    variableByCategory: [
      {
        category,
        plannedMonthly: planned,
        monthly: { '2026-01': monthly, '2026-02': monthly, '2026-03': monthly },
      },
    ],
    income: [],
  };
}

/**
 * Erzeugt ein abgestimmtes Set aus Pfaden, Annahmen, Dichtefeld und der
 * repräsentativen Zell-Zuordnung – analog zum Scenario-Engine, nur deterministisch.
 */
function fixture(spend: number[]) {
  // Hoher Konsum -> niedriger Saldo: Saldo = 6000 - 3 * monatlicher Konsum.
  const paths = spend.map((s) => DATES.map(() => 6000 - 3 * s));
  const assumptions = spend.map((s) => assume('Lebensmittel', s));
  const density = buildDensityField(paths, DATES, { bins: 16, include: [0] });
  const { bins, binSize, valueMin } = density;
  // representativeByCell wie im Engine: pro (Tag, Bin) der nächste Pfad am Zentrum.
  const representativeByCell = DATES.map((_, d) => {
    const reps = new Array<number>(bins).fill(-1);
    const best = new Array<number>(bins).fill(Infinity);
    paths.forEach((p, trial) => {
      let b = Math.floor((p[d] - valueMin) / binSize);
      b = Math.max(0, Math.min(bins - 1, b));
      const center = valueMin + (b + 0.5) * binSize;
      const dist = Math.abs(p[d] - center);
      if (dist < best[b]) {
        best[b] = dist;
        reps[b] = trial;
      }
    });
    return reps;
  });
  return { paths, assumptions, density, representativeByCell };
}

/** Findet den Bin, in dem ein bestimmter Pfad an einem Tag liegt. */
function binOf(density: ReturnType<typeof buildDensityField>, value: number): number {
  const b = Math.floor((value - density.valueMin) / density.binSize);
  return Math.max(0, Math.min(density.bins - 1, b));
}

describe('computeCellDetail', () => {
  describe('Normal Behavior', () => {
    it('sollte den repräsentativen Pfad und seine kumulierte Ausgabe je Kategorie liefern', () => {
      // 20 sparsame (200/Monat), 20 verschwenderische (600/Monat) Pfade.
      const spend = [...Array(20).fill(200), ...Array(20).fill(600)];
      const { assumptions, density, representativeByCell } = fixture(spend);
      // Zelle des verschwenderischen Clusters (niedriger Saldo).
      const lowValue = 6000 - 3 * 600;
      const bin = binOf(density, lowValue);
      const detail = computeCellDetail({ density, assumptions, representativeByCell, day: MID_MARCH, bin });

      expect(detail).not.toBeNull();
      expect(detail!.representative).not.toBeNull();
      const cat = detail!.representative!.variableByCategory[0];
      expect(cat.category).toBe('Lebensmittel');
      // Kumuliert bis 15. März: voller Jan + voller Feb + halber März ≈ 2,48 × 600.
      expect(cat.amount).toBeGreaterThan(1300);
      expect(cat.amount).toBeLessThan(1700);
      // Median liegt zwischen sparsam (≈500) und verschwenderisch (≈1500).
      expect(cat.deltaPct).toBeGreaterThan(0);
    });

    it('sollte das Perzentil des Bin-Zentrums an diesem Tag schätzen', () => {
      const spend = Array.from({ length: 50 }, (_, i) => 100 + i * 10);
      const { assumptions, density, representativeByCell } = fixture(spend);
      // Hoher Saldo (sparsamster Pfad) -> hohes Perzentil.
      const highValue = 6000 - 3 * 100;
      const detail = computeCellDetail({
        density,
        assumptions,
        representativeByCell,
        day: 2,
        bin: binOf(density, highValue),
      });
      expect(detail!.percentile).toBeGreaterThan(80);

      // Niedriger Saldo (verschwenderischster Pfad) -> niedriges Perzentil.
      const lowValue = 6000 - 3 * (100 + 49 * 10);
      const detailLow = computeCellDetail({
        density,
        assumptions,
        representativeByCell,
        day: 2,
        bin: binOf(density, lowValue),
      });
      expect(detailLow!.percentile).toBeLessThan(20);
    });

    it('sollte Anteil und Pfadanzahl der Zelle ausweisen', () => {
      const spend = [...Array(30).fill(200), ...Array(10).fill(600)];
      const { assumptions, density, representativeByCell } = fixture(spend);
      const bin = binOf(density, 6000 - 3 * 200);
      const detail = computeCellDetail({ density, assumptions, representativeByCell, day: 1, bin });
      expect(detail!.totalPaths).toBe(40);
      expect(detail!.pathsInCell).toBe(30);
      expect(detail!.share).toBeCloseTo(0.75, 2);
    });

    it('sollte den größten Abweichungstreiber benennen', () => {
      // Zwei Kategorien; nur eine streut stark.
      const paths = Array.from({ length: 20 }, (_, i) => DATES.map(() => 5000 - i * 50));
      const assumptions: TrialAssumptions[] = paths.map((_, i) => ({
        variableByCategory: [
          { category: 'Miete-Anteil', plannedMonthly: 300, monthly: { '2026-01': 300, '2026-02': 300, '2026-03': 300 } },
          { category: 'Freizeit', plannedMonthly: 200, monthly: { '2026-01': 100 + i * 20, '2026-02': 100 + i * 20, '2026-03': 100 + i * 20 } },
        ],
        income: [],
      }));
      const density = buildDensityField(paths, DATES, { bins: 16, include: [0] });
      const representativeByCell = DATES.map((_, d) => {
        const reps = new Array<number>(density.bins).fill(-1);
        const best = new Array<number>(density.bins).fill(Infinity);
        paths.forEach((p, trial) => {
          const b = binOf(density, p[d]);
          const center = density.valueMin + (b + 0.5) * density.binSize;
          const dist = Math.abs(p[d] - center);
          if (dist < best[b]) { best[b] = dist; reps[b] = trial; }
        });
        return reps;
      });
      const lastBin = binOf(density, paths[19][2]); // verschwenderischster
      const detail = computeCellDetail({ density, assumptions, representativeByCell, day: 2, bin: lastBin });
      expect(detail!.representative!.topDriver?.category).toBe('Freizeit');
    });
  });

  describe('Edge Cases', () => {
    it('sollte bei leerem Dichtefeld null liefern', () => {
      const density = buildDensityField([], [], { bins: 16 });
      const detail = computeCellDetail({ density, assumptions: [], representativeByCell: [], day: 0, bin: 0 });
      expect(detail).toBeNull();
    });

    it('sollte bei Tag/Bin außerhalb des Bereichs null liefern', () => {
      const { assumptions, density, representativeByCell } = fixture([200, 600]);
      expect(
        computeCellDetail({ density, assumptions, representativeByCell, day: 99, bin: 0 }),
      ).toBeNull();
      expect(
        computeCellDetail({ density, assumptions, representativeByCell, day: 0, bin: 999 }),
      ).toBeNull();
    });

    it('sollte für eine leere Zelle die Kennzahlen, aber keinen Repräsentanten liefern', () => {
      const { assumptions, density, representativeByCell } = fixture([200, 600]);
      // Mitte zwischen den beiden Clustern (Saldo 4200 bzw. 5400) ist leer.
      const emptyBin = binOf(density, 4800);
      const detail = computeCellDetail({ density, assumptions, representativeByCell, day: 0, bin: emptyBin });
      expect(detail).not.toBeNull();
      expect(detail!.pathsInCell).toBe(0);
      expect(detail!.representative).toBeNull();
    });

    it('sollte ohne Annahmen keinen Repräsentanten liefern', () => {
      const { density, representativeByCell } = fixture([200, 600]);
      const bin = binOf(density, 6000 - 3 * 200);
      const detail = computeCellDetail({ density, assumptions: [], representativeByCell, day: 0, bin });
      expect(detail).not.toBeNull();
      expect(detail!.representative).toBeNull();
    });
  });

  describe('Vollständige Zusammensetzung (composition)', () => {
    // 10 Pfade mit eindeutigem Saldo; je Pfad gezogene Shopping- und Gehalts-Werte.
    function compositionFixture() {
      const N = 10;
      const paths = Array.from({ length: N }, (_, i) => DATES.map(() => 5000 - i * 120));
      const assumptions: TrialAssumptions[] = Array.from({ length: N }, (_, i) => ({
        variableByCategory: [
          {
            category: 'Shopping',
            plannedMonthly: 300,
            monthly: { '2026-01': 200 + i * 30, '2026-02': 200 + i * 30, '2026-03': 200 + i * 30 },
          },
        ],
        income: [{ name: 'Gehalt', planned: 2500, sampled: 2400 + i * 20 }],
      }));
      const density = buildDensityField(paths, DATES, { bins: 32, include: [0] });
      const representativeByCell = DATES.map((_, d) => {
        const reps = new Array<number>(density.bins).fill(-1);
        const best = new Array<number>(density.bins).fill(Infinity);
        paths.forEach((p, trial) => {
          const b = binOf(density, p[d]);
          const center = density.valueMin + (b + 0.5) * density.binSize;
          const dist = Math.abs(p[d] - center);
          if (dist < best[b]) { best[b] = dist; reps[b] = trial; }
        });
        return reps;
      });
      // Monatliche Buchungen ~ Monatsanfänge (Index 0/31/59), Anschaffung am Tag 40.
      const compositionSchedule: CompositionItem[] = [
        { name: 'Gehalt', group: 'income', bookings: [0, 31, 59].map((day) => ({ day, amount: 2500 })) },
        { name: 'Miete', group: 'fixed', bookings: [0, 31, 59].map((day) => ({ day, amount: -1000 })) },
        { name: 'Anschaffung', group: 'event', bookings: [{ day: 40, amount: -3000 }] },
      ];
      return { paths, assumptions, density, representativeByCell, compositionSchedule };
    }

    it('sollte benannte Posten aller Gruppen kumuliert bis zum Tag liefern', () => {
      const f = compositionFixture();
      const bin = binOf(f.density, f.paths[0][MID_MARCH]); // sparsamster Pfad (Trial 0)
      const detail = computeCellDetail({
        density: f.density,
        assumptions: f.assumptions,
        representativeByCell: f.representativeByCell,
        compositionSchedule: f.compositionSchedule,
        day: MID_MARCH,
        bin,
      })!;
      const comp = detail.representative!.composition;
      const byName = (n: string) => comp.find((c) => c.name === n);

      // Gruppen-Reihenfolge: income → fixed → variable → event.
      const groups = comp.map((c) => c.group);
      expect(groups.indexOf('income')).toBeLessThan(groups.indexOf('fixed'));
      expect(groups.indexOf('fixed')).toBeLessThan(groups.indexOf('variable'));
      expect(groups.indexOf('variable')).toBeLessThan(groups.indexOf('event'));

      // Gehalt (perturbiert): 3 Buchungen × 2500 × (2400/2500) = 7200.
      const gehalt = byName('Gehalt')!;
      expect(gehalt.varies).toBe(true);
      expect(gehalt.amount).toBeCloseTo(7200, 0);
      expect(gehalt.median).toBeDefined();

      // Miete (deterministisch): 3 × −1000 = −3000, kein vs-Median.
      const miete = byName('Miete')!;
      expect(miete.varies).toBe(false);
      expect(miete.amount).toBeCloseTo(-3000, 0);
      expect(miete.median).toBeUndefined();

      // Variable Shopping: negativ, streut.
      const shopping = byName('Shopping')!;
      expect(shopping.group).toBe('variable');
      expect(shopping.amount).toBeLessThan(0);
      expect(shopping.varies).toBe(true);

      // Anschaffung (Einmalposten am Tag 40 ≤ MID_MARCH): −3000, deterministisch.
      const ansch = byName('Anschaffung')!;
      expect(ansch.group).toBe('event');
      expect(ansch.amount).toBeCloseTo(-3000, 0);
      expect(ansch.varies).toBe(false);
    });

    it('sollte noch nicht aufgetretene Posten weglassen', () => {
      const f = compositionFixture();
      // Tag 20: 2. Gehalt (Tag 31) und Anschaffung (Tag 40) noch nicht gebucht.
      const bin = binOf(f.density, f.paths[0][20]);
      const detail = computeCellDetail({
        density: f.density,
        assumptions: f.assumptions,
        representativeByCell: f.representativeByCell,
        compositionSchedule: f.compositionSchedule,
        day: 20,
        bin,
      })!;
      const comp = detail.representative!.composition;
      expect(comp.find((c) => c.name === 'Anschaffung')).toBeUndefined();
      // Gehalt: nur die erste Buchung (Tag 0) → 1 × 2500 × Verhältnis.
      const gehalt = comp.find((c) => c.name === 'Gehalt')!;
      expect(gehalt.amount).toBeLessThan(2600);
    });

    it('sollte ohne Schedule nur variable Kategorien als Zusammensetzung führen', () => {
      const f = compositionFixture();
      const bin = binOf(f.density, f.paths[0][MID_MARCH]);
      const detail = computeCellDetail({
        density: f.density,
        assumptions: f.assumptions,
        representativeByCell: f.representativeByCell,
        day: MID_MARCH,
        bin,
      })!;
      const comp = detail.representative!.composition;
      expect(comp.every((c) => c.group === 'variable')).toBe(true);
      expect(comp.length).toBe(1);
    });
  });

  describe('Regression Protection', () => {
    it('[REGRESSION] sollte Einnahme-Annahmen relativ zum Median ausweisen', () => {
      const paths = Array.from({ length: 10 }, (_, i) => DATES.map(() => 4000 + i * 100));
      const assumptions: TrialAssumptions[] = paths.map((_, i) => ({
        variableByCategory: [
          { category: 'Lebensmittel', plannedMonthly: 400, monthly: { '2026-01': 400, '2026-02': 400, '2026-03': 400 } },
        ],
        income: [{ name: 'Gehalt', planned: 2500, sampled: 2000 + i * 100 }],
      }));
      const density = buildDensityField(paths, DATES, { bins: 16, include: [0] });
      const representativeByCell = DATES.map((_, d) => {
        const reps = new Array<number>(density.bins).fill(-1);
        const best = new Array<number>(density.bins).fill(Infinity);
        paths.forEach((p, trial) => {
          const b = binOf(density, p[d]);
          const center = density.valueMin + (b + 0.5) * density.binSize;
          const dist = Math.abs(p[d] - center);
          if (dist < best[b]) { best[b] = dist; reps[b] = trial; }
        });
        return reps;
      });
      // Höchster Saldo -> höchstes Gehalt (i=9 -> 2900).
      const bin = binOf(density, paths[9][2]);
      const detail = computeCellDetail({ density, assumptions, representativeByCell, day: 2, bin });
      const income = detail!.representative!.income[0];
      expect(income.name).toBe('Gehalt');
      expect(income.amount).toBe(2900);
      expect(income.deltaPct).toBeGreaterThan(0);
    });
  });
});
