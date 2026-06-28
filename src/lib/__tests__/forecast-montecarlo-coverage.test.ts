import { describe, it, expect } from 'vitest';
import { runMonteCarloForecast } from '@/lib/forecast-montecarlo';
import type { ForecastConfig, ForecastInput } from '@/lib/forecast-types';

/**
 * Coverage-Backtest (Kalibrier-Messlatte für Fine-Tuning).
 *
 * Bestehende Tests prüfen Reihenfolge (P10≤P50≤P90) und Erwartungstreue – aber
 * NICHT, ob das P10–P90-Band die Realität trifft. Ein 80-%-Band ist nur korrekt,
 * wenn ~80 % der tatsächlichen Ausgänge hineinfallen.
 *
 * Aufbau: Die „wahre Welt" zieht Monatsausgaben aus derselben lognormalen Familie,
 * die das Modell annimmt. Bei korrekter Streuung (gleiches CV) muss die empirische
 * Coverage ≈ 80 % sein. Der Test ist bewusst SENSITIV: zu enge Streuung
 * (Under-Dispersion) lässt die Coverage einbrechen, zu weite sprengt sie nach oben –
 * so schlägt er an, falls jemand die Sigma-Formel oder die Aggregation verstellt.
 */

const START = '2026-01-01';
const MONTHS = 6;
const OPENING = 0;
const INCOME = 1500; // fix, ohne Volatilität – einzige Streuung kommt aus „Shopping"
const MEAN = 1000; // Zielwert der variablen Monatsausgabe

const CONFIG: ForecastConfig = { startDate: START, months: MONTHS };

/** mulberry32 – derselbe PRNG-Typ wie die Engine, hier für die „wahre Welt". */
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
  return function () {
    let u = 0;
    let v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
}

/** Lognormaler Multiplikator E=1, CV=cv – identisch zur Engine-Konvention. */
function lognormal(normal: () => number, cv: number): number {
  if (cv <= 0) return 1;
  const sigma = Math.sqrt(Math.log(1 + cv * cv));
  return Math.exp(sigma * normal() - (sigma * sigma) / 2);
}

const round2 = (v: number) => Math.round(v * 100) / 100;

function input(modelCv: number): ForecastInput {
  return {
    accounts: [{ id: 'giro', name: 'Giro', kind: 'checking', openingBalance: OPENING }],
    recurringFlows: [
      { id: 'salary', name: 'Gehalt', amount: INCOME, cadence: 'monthly', anchorDate: START, accountId: 'giro' },
    ],
    // confidence 0.9 -> Floor 0.1; für modelCv >= 0.1 bleibt cv = modelCv.
    variableExpenses: [{ category: 'Shopping', monthlyAmount: MEAN, volatility: modelCv, confidence: 0.9 }],
  };
}

/** Endsaldo-Band (letzter Tag) des Modells. */
function modelBandEnd(modelCv: number) {
  const res = runMonteCarloForecast(input(modelCv), CONFIG, { trials: 1500, seed: 1 });
  return res.band.at(-1)!;
}

/**
 * Zieht `count` unabhängige „wahre" Endsalden: Endsaldo = Start + ΣEinnahmen −
 * Σ(6 lognormale Monatsausgaben). Eigener Seed → fair out-of-sample.
 */
function realizedEndCash(trueCv: number, count: number, seed: number): number[] {
  const normal = makeNormal(mulberry32(seed));
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    let spend = 0;
    for (let m = 0; m < MONTHS; m++) spend += round2(MEAN * lognormal(normal, trueCv));
    out.push(OPENING + MONTHS * INCOME - spend);
  }
  return out;
}

function coverage(modelCv: number, trueCv: number): number {
  const band = modelBandEnd(modelCv);
  const realized = realizedEndCash(trueCv, 6000, 987654);
  const inside = realized.filter((v) => v >= band.p10 && v <= band.p90).length;
  return inside / realized.length;
}

describe('Monte-Carlo Coverage-Backtest', () => {
  describe('Kalibrierung', () => {
    it('trifft ~80 % Coverage, wenn das Modell-CV der Realität entspricht', () => {
      const cov = coverage(0.4, 0.4);
      // P10–P90 = zentrale 80 %. Toleranz für endliche Trials/Ziehungen.
      expect(cov).toBeGreaterThan(0.75);
      expect(cov).toBeLessThan(0.85);
    }, 30000);
  });

  describe('Sensitivität (Schutz vor falscher Streuung)', () => {
    it('[REGRESSION] schlägt an, wenn das Band zu ENG ist (Under-Dispersion)', () => {
      // Modell unterschätzt die Streuung stark -> deutlich zu wenig Coverage.
      expect(coverage(0.15, 0.45)).toBeLessThan(0.7);
    }, 30000);

    it('[REGRESSION] schlägt an, wenn das Band zu WEIT ist (Over-Dispersion)', () => {
      // Modell überschätzt die Streuung stark -> Band fängt fast alles ein.
      expect(coverage(0.8, 0.4)).toBeGreaterThan(0.9);
    }, 30000);
  });
});
