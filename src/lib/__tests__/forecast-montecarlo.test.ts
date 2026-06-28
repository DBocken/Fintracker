import { describe, it, expect } from 'vitest';
import { runMonteCarloForecast, percentile } from '@/lib/forecast-montecarlo';
import { calculateDeterministicForecast } from '@/lib/forecast';
import { applyScenario } from '@/lib/forecast-scenario';
import type { ForecastAccount, ForecastInput, RecurringFlow } from '@/lib/forecast-types';

const START = '2026-01-01';
const CONFIG = { startDate: START, months: 6 };

function checking(openingBalance: number, id = 'giro'): ForecastAccount {
  return { id, name: 'Girokonto', kind: 'checking', openingBalance };
}

const salary: RecurringFlow = {
  id: 'salary',
  name: 'Gehalt',
  amount: 2500,
  cadence: 'monthly',
  anchorDate: '2026-01-01',
  accountId: 'giro',
};

const rent: RecurringFlow = {
  id: 'rent',
  name: 'Miete',
  amount: -1000,
  cadence: 'monthly',
  anchorDate: '2026-01-01',
  accountId: 'giro',
};

function input(volatility = 0.3): ForecastInput {
  return {
    accounts: [checking(5000)],
    recurringFlows: [salary, rent],
    variableExpenses: [{ category: 'Lebensmittel', monthlyAmount: 400, volatility }],
  };
}

describe('runMonteCarloForecast – Grundlagen', () => {
  it('ist bei gleichem Seed reproduzierbar', () => {
    const a = runMonteCarloForecast(input(), CONFIG, { trials: 200, seed: 42 });
    const b = runMonteCarloForecast(input(), CONFIG, { trials: 200, seed: 42 });
    expect(a.lowestBalance).toEqual(b.lowestBalance);
    expect(a.breachProbability).toBe(b.breachProbability);
    expect(a.band).toEqual(b.band);
  });

  it('liefert unterschiedliche Ergebnisse bei anderem Seed', () => {
    const a = runMonteCarloForecast(input(), CONFIG, { trials: 200, seed: 1 });
    const b = runMonteCarloForecast(input(), CONFIG, { trials: 200, seed: 2 });
    // Zumindest die Verteilung des Tiefststands sollte sich unterscheiden.
    expect(a.lowestBalance.p10).not.toBe(b.lowestBalance.p10);
  });

  it('hält die Perzentil-Ordnung P10 <= P50 <= P90 je Tag ein', () => {
    const res = runMonteCarloForecast(input(0.5), CONFIG, { trials: 300, seed: 7 });
    for (const point of res.band) {
      expect(point.p10).toBeLessThanOrEqual(point.p50);
      expect(point.p50).toBeLessThanOrEqual(point.p90);
    }
    expect(res.lowestBalance.p10).toBeLessThanOrEqual(res.lowestBalance.p90);
  });

  it('begrenzt die Pufferbruch-Wahrscheinlichkeit auf [0, 1]', () => {
    const res = runMonteCarloForecast(input(0.5), { ...CONFIG, safetyBuffer: 3000 }, {
      trials: 200,
      seed: 3,
    });
    expect(res.breachProbability).toBeGreaterThanOrEqual(0);
    expect(res.breachProbability).toBeLessThanOrEqual(1);
  });

  it('hat genauso viele Bandpunkte wie die deterministische Projektion Tage', () => {
    const det = calculateDeterministicForecast(input(), CONFIG);
    const res = runMonteCarloForecast(input(), CONFIG, { trials: 50, seed: 1 });
    expect(res.band).toHaveLength(det.daily.length);
    expect(res.band[0].date).toBe(det.daily[0].date);
  });
});

describe('Kalibrierung der Streuung', () => {
  it('kollabiert ohne Volatilität auf den deterministischen Pfad', () => {
    const det = calculateDeterministicForecast(input(0), CONFIG);
    const res = runMonteCarloForecast(input(0), CONFIG, {
      trials: 100,
      seed: 5,
      variableVolatility: 0,
      incomeVolatility: 0,
    });
    // Alle Durchläufe identisch -> Band ist ein Strich (P10 == P50 == P90).
    const detBasis = det.daily.map((d) => d.operatingCash);
    res.band.forEach((point, i) => {
      expect(point.p10).toBeCloseTo(detBasis[i], 2);
      expect(point.p50).toBeCloseTo(detBasis[i], 2);
      expect(point.p90).toBeCloseTo(detBasis[i], 2);
    });
    expect(res.lowestBalance.p10).toBeCloseTo(det.risk.lowestBalance, 2);
  });

  it('verbreitert das Band mit steigender Volatilität', () => {
    const low = runMonteCarloForecast(input(0.1), CONFIG, { trials: 300, seed: 9 });
    const high = runMonteCarloForecast(input(0.8), CONFIG, { trials: 300, seed: 9 });
    const spread = (r: typeof low) => r.band.at(-1)!.p90 - r.band.at(-1)!.p10;
    expect(spread(high)).toBeGreaterThan(spread(low));
  });

  it('erlaubt eine globale Volatilitäts-Annahme, die die Baseline überschreibt', () => {
    // Baseline-Volatilität 0, aber globale Annahme 0.4 -> trotzdem Streuung.
    const res = runMonteCarloForecast(input(0), CONFIG, {
      trials: 200,
      seed: 11,
      variableVolatility: 0.4,
    });
    const spread = res.band.at(-1)!.p90 - res.band.at(-1)!.p10;
    expect(spread).toBeGreaterThan(0);
  });

  it('hält die mittlere Projektion nahe am deterministischen Pfad (erwartungstreu)', () => {
    const det = calculateDeterministicForecast(input(0.3), CONFIG);
    const res = runMonteCarloForecast(input(0.3), CONFIG, { trials: 1000, seed: 13 });
    const detEnd = det.daily.at(-1)!.operatingCash;
    // Median am Ende sollte – über viele Läufe – nahe am deterministischen Wert liegen.
    expect(Math.abs(res.band.at(-1)!.p50 - detEnd)).toBeLessThan(300);
  });

  it('nutzt bei geringer Datenqualität eine konservative Mindeststreuung', () => {
    const sparse = input(0);
    sparse.variableExpenses![0].confidence = 0.5;
    const res = runMonteCarloForecast(sparse, CONFIG, { trials: 200, seed: 17 });
    expect(res.band.at(-1)!.p90 - res.band.at(-1)!.p10).toBeGreaterThan(0);
  });
});

describe('Szenario + Monte Carlo', () => {
  it('bewertet das ausgewählte Szenario statt weiterhin die Basisplanung', () => {
    const base = input(0);
    const config = { ...CONFIG, safetyBuffer: 1000 };
    const baselineRisk = runMonteCarloForecast(base, config, { trials: 50, seed: 1 });
    const jobLossInput = applyScenario(base, {
      id: 'job-loss-now',
      name: 'Jobverlust sofort',
      modifiers: [{ id: 'income-off', type: 'income', percentChange: -100 }],
    });
    const scenarioRisk = runMonteCarloForecast(jobLossInput, config, { trials: 50, seed: 1 });

    expect(baselineRisk.breachProbability).toBe(0);
    expect(scenarioRisk.breachProbability).toBe(1);
  });
});

describe('Trial-Pfade exponieren (collectPaths)', () => {
  it('liefert ohne Flag keine Pfade', () => {
    const res = runMonteCarloForecast(input(0.4), CONFIG, { trials: 50, seed: 1 });
    expect(res.paths).toBeUndefined();
  });

  it('liefert mit Flag genau so viele Pfade wie Trials, je in Tageslänge', () => {
    const res = runMonteCarloForecast(input(0.4), CONFIG, {
      trials: 80,
      seed: 1,
      collectPaths: true,
    });
    expect(res.paths).toBeDefined();
    expect(res.paths).toHaveLength(80);
    for (const path of res.paths!) {
      expect(path).toHaveLength(res.band.length);
    }
  });

  it('[REGRESSION] pro-Tag-Perzentile der Pfade entsprechen dem Band (Konsistenz alt/neu)', () => {
    const res = runMonteCarloForecast(input(0.5), CONFIG, {
      trials: 200,
      seed: 7,
      collectPaths: true,
    });
    const paths = res.paths!;
    const round2 = (v: number) => Math.round(v * 100) / 100;
    res.band.forEach((point, day) => {
      const sorted = paths.map((p) => p[day]).sort((a, b) => a - b);
      expect(round2(percentile(sorted, 10))).toBeCloseTo(point.p10, 6);
      expect(round2(percentile(sorted, 50))).toBeCloseTo(point.p50, 6);
      expect(round2(percentile(sorted, 90))).toBeCloseTo(point.p90, 6);
    });
  });

  it('verändert die übrigen Kennzahlen nicht (additive Erweiterung)', () => {
    const without = runMonteCarloForecast(input(0.4), CONFIG, { trials: 100, seed: 3 });
    const withPaths = runMonteCarloForecast(input(0.4), CONFIG, {
      trials: 100,
      seed: 3,
      collectPaths: true,
    });
    expect(withPaths.band).toEqual(without.band);
    expect(withPaths.lowestBalance).toEqual(without.lowestBalance);
    expect(withPaths.breachProbability).toBe(without.breachProbability);
  });
});

describe('Gezogene Annahmen exponieren (collectAssumptions)', () => {
  describe('Normal Behavior', () => {
    it('liefert ohne Flag keine Annahmen', () => {
      const res = runMonteCarloForecast(input(0.4), CONFIG, { trials: 50, seed: 1 });
      expect(res.assumptions).toBeUndefined();
    });

    it('liefert je Trial die gezogene variable Ausgabe je Kategorie', () => {
      const res = runMonteCarloForecast(input(0.4), CONFIG, {
        trials: 60,
        seed: 1,
        collectAssumptions: true,
      });
      expect(res.assumptions).toHaveLength(60);
      const first = res.assumptions![0];
      const cat = first.variableByCategory.find((c) => c.category === 'Lebensmittel');
      expect(cat).toBeDefined();
      expect(cat!.plannedMonthly).toBe(400);
      // Sechs Monate Horizont -> sechs realisierte Monatsbeträge.
      expect(Object.keys(cat!.monthly)).toHaveLength(6);
      for (const amount of Object.values(cat!.monthly)) {
        expect(amount).toBeGreaterThan(0);
      }
    });

    it('streut die gezogenen Beträge über die Trials (echter Treiber)', () => {
      const res = runMonteCarloForecast(input(0.5), CONFIG, {
        trials: 100,
        seed: 1,
        collectAssumptions: true,
      });
      const month = Object.keys(res.assumptions![0].variableByCategory[0].monthly)[0];
      const sampled = res.assumptions!.map(
        (a) => a.variableByCategory[0].monthly[month],
      );
      const uniqueValues = new Set(sampled.map((v) => Math.round(v)));
      expect(uniqueValues.size).toBeGreaterThan(1);
    });

    it('erfasst perturbierte Einnahmen bei incomeVolatility > 0', () => {
      const res = runMonteCarloForecast(input(0), CONFIG, {
        trials: 40,
        seed: 1,
        incomeVolatility: 0.2,
        collectAssumptions: true,
      });
      const salaryAssumption = res.assumptions![0].income.find((i) => i.name === 'Gehalt');
      expect(salaryAssumption).toBeDefined();
      expect(salaryAssumption!.planned).toBe(2500);
      const sampled = res.assumptions!.map(
        (a) => a.income.find((i) => i.name === 'Gehalt')!.sampled,
      );
      expect(new Set(sampled.map((v) => Math.round(v))).size).toBeGreaterThan(1);
    });
  });

  describe('Edge Cases', () => {
    it('hält Annahmen und Pfade gleich lang und ausgerichtet', () => {
      const res = runMonteCarloForecast(input(0.4), CONFIG, {
        trials: 30,
        seed: 2,
        collectPaths: true,
        collectAssumptions: true,
      });
      expect(res.assumptions).toHaveLength(res.paths!.length);
    });

    it('lässt Einnahmen leer, wenn keine Income-Volatilität gezogen wird', () => {
      const res = runMonteCarloForecast(input(0.4), CONFIG, {
        trials: 20,
        seed: 1,
        incomeVolatility: 0,
        collectAssumptions: true,
      });
      expect(res.assumptions![0].income).toEqual([]);
    });
  });

  describe('Regression Protection', () => {
    it('[REGRESSION] verändert Band/Kennzahlen nicht (rein additiv)', () => {
      const without = runMonteCarloForecast(input(0.4), CONFIG, { trials: 80, seed: 5 });
      const withAssumptions = runMonteCarloForecast(input(0.4), CONFIG, {
        trials: 80,
        seed: 5,
        collectAssumptions: true,
      });
      expect(withAssumptions.band).toEqual(without.band);
      expect(withAssumptions.lowestBalance).toEqual(without.lowestBalance);
      expect(withAssumptions.breachProbability).toBe(without.breachProbability);
    });
  });
});
