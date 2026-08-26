import { describe, it, expect } from 'vitest';
import { evaluateAffordability, hoechsterTragbarerBetrag } from '../affordability';
import type { ForecastAccount, ForecastConfig, ForecastInput, RecurringFlow } from '../../forecast-types';

/**
 * „Frag dein Geld": Inverse Monte-Carlo. Aus der Vorwärts-Engine wird per Suche
 * ein Trade-off-Menü – kann ich mir X leisten, und wenn nicht, wie am ehesten?
 */

const START = '2026-01-01';
// Schlank halten: die inverse Suche macht viele MC-Läufe; 80 Trials reichen für
// die klar getrennten Testfälle und halten die Laufzeit im Rahmen.
const MC = { trials: 80, seed: 1 };

function checking(openingBalance: number): ForecastAccount {
  return { id: 'giro', name: 'Giro', kind: 'checking', openingBalance };
}

const salary: RecurringFlow = { id: 'salary', name: 'Gehalt', amount: 2000, cadence: 'monthly', anchorDate: START, accountId: 'giro' };
const rent: RecurringFlow = { id: 'rent', name: 'Miete', amount: -1000, cadence: 'monthly', anchorDate: START, accountId: 'giro' };

function input(opening: number, variableMonthly: number): ForecastInput {
  return {
    accounts: [checking(opening)],
    recurringFlows: [salary, rent],
    variableExpenses: [{ category: 'Shopping', monthlyAmount: variableMonthly, volatility: 0.25 }],
  };
}

const config: ForecastConfig = { startDate: START, safetyBuffer: 1200 };

describe('evaluateAffordability', () => {
  describe('Normal Behavior', () => {
    it('gesund + günstig → ohne Änderung leistbar (kein Menü)', () => {
      const r = evaluateAffordability(
        input(10000, 400),
        { startDate: START, safetyBuffer: 1000 },
        { amount: 300, dayIndex: 30 },
        { monteCarlo: MC },
      );
      expect(r.affordableAsIs).toBe(true);
      expect(r.options).toHaveLength(1);
      expect(r.options[0].lever).toBe('asis');
      expect(r.options[0].meetsTarget).toBe(true);
      expect(r.baseSuccess).toBeGreaterThanOrEqual(0.9);
    });

    it('knapp + teuer → Menü mit Sparen UND Mehr-verdienen', () => {
      const r = evaluateAffordability(input(2500, 600), config, { amount: 2500, dayIndex: 45 }, { monteCarlo: MC });

      expect(r.affordableAsIs).toBe(false);
      expect(r.baseSuccess).toBeLessThan(0.9);
      expect(r.options[0].lever).toBe('asis');

      const cut = r.options.find((o) => o.lever === 'cut');
      const earn = r.options.find((o) => o.lever === 'earn');
      expect(cut).toBeDefined();
      expect(earn).toBeDefined();
      expect(cut!.detail).toMatchObject({ kind: 'cut' });
      expect(earn!.detail).toMatchObject({ kind: 'earn' });
      if (cut!.detail.kind === 'cut') expect(cut!.detail.perMonth).toBeGreaterThan(0);
      if (earn!.detail.kind === 'earn') expect(earn!.detail.perMonth).toBeGreaterThan(0);

      // Jede vorgeschlagene Option erreicht wirklich die Zielsicherheit.
      for (const o of r.options.slice(1)) {
        expect(o.meetsTarget).toBe(true);
        expect(o.successProbability).toBeGreaterThanOrEqual(0.9);
      }
    }, 20000);

    it('alle Wahrscheinlichkeiten liegen in [0,1]', () => {
      const r = evaluateAffordability(input(2500, 600), config, { amount: 2500, dayIndex: 45 }, { monteCarlo: MC });
      for (const o of r.options) {
        expect(o.successProbability).toBeGreaterThanOrEqual(0);
        expect(o.successProbability).toBeLessThanOrEqual(1);
      }
    }, 20000);
  });

  describe('Edge Cases', () => {
    it('ohne Zahlungskonto → keine Aussage', () => {
      const r = evaluateAffordability(
        { accounts: [] },
        { startDate: START },
        { amount: 100, dayIndex: 10 },
        { monteCarlo: MC },
      );
      expect(r.options).toEqual([]);
      expect(r.affordableAsIs).toBe(false);
    });
  });

  describe('Regression Protection', () => {
    it('[REGRESSION] ist mit festem Seed reproduzierbar', () => {
      const goal = { amount: 2500, dayIndex: 45 };
      const a = evaluateAffordability(input(2500, 600), config, goal, { monteCarlo: MC });
      const b = evaluateAffordability(input(2500, 600), config, goal, { monteCarlo: MC });
      expect(a).toEqual(b);
    }, 30000);
  });
});

/**
 * Zielrückrechnung (Welle 3): die andere Richtung derselben Frage.
 *
 * `evaluateAffordability` nimmt einen Betrag und sucht die Änderung, die ihn
 * tragbar macht. Wer fragt „Wie hoch darf mein Urlaubsbudget höchstens sein?",
 * hat den Betrag noch nicht — er IST die Antwort.
 */
describe('hoechsterTragbarerBetrag', () => {
  it('sollte eine Grenze finden, die trägt — und knapp darüber nicht mehr', () => {
    // Der eigentliche Prüfpunkt: nicht die Zahl selbst (die hängt am
    // Zufallsstrom), sondern dass sie GRENZE ist. Genau bei ihr wird die
    // Zielsicherheit gehalten, bei deutlich mehr nicht.
    const ergebnis = hoechsterTragbarerBetrag(input(8000, 400), config, 60, { monteCarlo: MC });

    expect(ergebnis.bereitsUnterDeckung).toBe(false);
    expect(ergebnis.betrag).toBeGreaterThan(0);
    expect(ergebnis.successProbability).toBeGreaterThanOrEqual(ergebnis.targetConfidence);

    const drueber = evaluateAffordability(
      input(8000, 400),
      config,
      { amount: ergebnis.betrag * 2, dayIndex: 60 },
      { monteCarlo: MC },
    );
    expect(drueber.affordableAsIs).toBe(false);
  });

  it('sollte monoton sein: mehr Guthaben erlaubt nie weniger', () => {
    // Die Voraussetzung der Binärsuche. Ohne Monotonie fände sie irgendeinen
    // Punkt statt der Grenze — dann wäre sie nicht ungenau, sondern falsch.
    const wenig = hoechsterTragbarerBetrag(input(5000, 400), config, 60, { monteCarlo: MC });
    const viel = hoechsterTragbarerBetrag(input(15000, 400), config, 60, { monteCarlo: MC });
    expect(viel.betrag).toBeGreaterThanOrEqual(wenig.betrag);
  });

  it('[REGRESSION] sollte „schon ohne Ausgabe unter Deckung" BENENNEN statt 0 € zu antworten', () => {
    // „0 €" liest sich wie „du darfst nichts ausgeben" — die Lage ist aber
    // eine andere: Nicht die Anschaffung ist das Problem, sondern der Stand
    // davor. Eine Antwort, die das verwischt, schickt jemanden auf die
    // falsche Suche.
    const ergebnis = hoechsterTragbarerBetrag(
      input(0, 1500),
      { startDate: START, safetyBuffer: 3000 },
      30,
      { monteCarlo: MC },
    );
    expect(ergebnis.bereitsUnterDeckung).toBe(true);
    expect(ergebnis.betrag).toBe(0);
  });

  it('sollte die Obergrenze der Frage zurückgeben, wenn selbst sie trägt', () => {
    // Dann ist die Grenze nicht die Liquidität, sondern die Frage. Eine
    // grössere Zahl zu erfinden wäre eine Behauptung über Geld, nach dem
    // niemand gefragt hat.
    const ergebnis = hoechsterTragbarerBetrag(input(50000, 200), config, 30, {
      monteCarlo: MC,
      obergrenze: 500,
    });
    expect(ergebnis.betrag).toBe(500);
    expect(ergebnis.bereitsUnterDeckung).toBe(false);
  });
});
