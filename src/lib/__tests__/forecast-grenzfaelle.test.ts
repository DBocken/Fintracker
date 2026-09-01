import { describe, it, expect } from 'vitest';
import { format } from 'date-fns';
import {
  calculateDeterministicForecast,
  calculateLiquidityRisk,
  calculateRequiredContribution,
  listFlowOccurrences,
  pickVariableExpenseAccount,
} from '@/lib/forecast';
import type {
  ForecastAccount,
  ForecastConfig,
  ForecastInput,
  RecurringCadence,
  ResolvedForecastConfig,
} from '@/lib/forecast-types';

/**
 * Grenzfälle der deterministischen Forecast-Engine — die Pfade, die erst
 * greifen, wenn Eingaben unvollständig, Beträge winzig oder Rhythmen
 * ungewöhnlich sind. Jeder Test nagelt einen Geldfall fest, bei dem die Engine
 * still eine falsche Zahl liefern könnte: verschwundene oder erfundene
 * Buchungen, ein Cent aus dem Nichts, eine Monatssumme, die sich beim
 * Verteilen verändert.
 */

const START = '2026-01-01';

function checking(openingBalance: number, id = 'giro'): ForecastAccount {
  return { id, name: 'Girokonto', kind: 'checking', openingBalance };
}

function tagesgeld(openingBalance: number, id = 'tg'): ForecastAccount {
  return { id, name: 'Tagesgeld', kind: 'savings', openingBalance };
}

function run(input: ForecastInput, config: ForecastConfig = {}) {
  return calculateDeterministicForecast(input, { startDate: START, months: 6, ...config });
}

function day(result: ReturnType<typeof run>, date: string) {
  const p = result.daily.find((d) => d.date === date);
  if (!p) throw new Error(`kein Tagespunkt für ${date}`);
  return p;
}

/** Summe eines Tagesfeldes über den gesamten Horizont. */
function total(result: ReturnType<typeof run>, field: 'variableExpenses' | 'fixedExpenses' | 'inflows' | 'events' | 'transfersIn' | 'transfersOut'): number {
  return Math.round(result.daily.reduce((s, p) => s + p[field], 0) * 100) / 100;
}

describe('Forecast — Eingaben, die auf kein Konto zeigen', () => {
  it('ignoriert Flows, Transfers und Posten mit unbekanntem Konto, statt sie irgendwo zu buchen', () => {
    // Ein Konto kann gelöscht werden, während Verträge und geplante Posten
    // darauf zeigen. Würde die Engine solche Buchungen auf ein beliebiges
    // Konto legen (oder in die Summen ohne Kontobezug), zeigte die Prognose
    // Ausgaben an, die nirgends abgehen — oder umgekehrt.
    const result = run({
      accounts: [checking(1000)],
      recurringFlows: [
        { id: 'f1', name: 'Miete Altkonto', amount: -800, cadence: 'monthly', anchorDate: '2026-01-03', accountId: 'geloescht' },
      ],
      transfers: [
        { id: 'tr1', amount: 100, fromAccountId: 'geloescht', toAccountId: 'giro', date: '2026-01-10' },
        { id: 'tr2', amount: 100, fromAccountId: 'giro', toAccountId: 'geloescht', date: '2026-01-11' },
      ],
      plannedEvents: [{ id: 'e1', name: 'Urlaub', amount: -500, date: '2026-01-20', accountId: 'geloescht' }],
    });

    expect(total(result, 'fixedExpenses')).toBe(0);
    expect(total(result, 'events')).toBe(0);
    expect(total(result, 'transfersIn')).toBe(0);
    expect(total(result, 'transfersOut')).toBe(0);
    expect(result.daily.at(-1)!.operatingCash).toBe(1000);
  });

  it('kommt ohne jedes Konto durch, statt ein Konto zu erfinden', () => {
    expect(pickVariableExpenseAccount([])).toBeNull();
    const result = run({
      accounts: [],
      variableExpenses: [{ category: 'Lebensmittel', monthlyAmount: 400 }],
    });
    // Ohne Konto gibt es keinen Ort für die variable Baseline — sie darf dann
    // auch nicht als Ausgabe erscheinen.
    expect(total(result, 'variableExpenses')).toBe(0);
    expect(result.daily.at(-1)!.netWorth).toBe(0);
  });

  it('meldet für eine leere Zeitreihe 0 statt Unendlich', () => {
    // `lowestBalance` startet bei +Infinity. Ohne die Endlichkeitsprüfung
    // stünde in der Risiko-Kachel „∞ €" — und jede Weiterrechnung damit
    // (Puffer-Differenz, Prozentanteil) wäre NaN.
    const config: ResolvedForecastConfig = run({ accounts: [checking(0)] }).config;
    const risk = calculateLiquidityRisk([], config);
    expect(risk.lowestBalance).toBe(0);
    expect(risk.minimumOperatingCash).toBe(0);
    expect(risk.minimumAvailableCash).toBe(0);
    expect(risk.daysBelowSafetyBuffer).toBe(0);
    expect(risk.firstBelowSafetyBufferDate).toBeNull();
  });
});

describe('Forecast — Rhythmen jenseits von monatlich', () => {
  it('bucht einen halbjährlichen Beitrag genau zweimal im Jahr', () => {
    const result = run(
      {
        accounts: [checking(5000)],
        recurringFlows: [
          { id: 'v', name: 'Hausrat', amount: -180, cadence: 'semiannual', anchorDate: '2026-01-15', accountId: 'giro' },
        ],
      },
      { months: 12 },
    );
    const treffer = result.daily.filter((p) => p.fixedExpenses > 0).map((p) => p.date);
    expect(treffer).toEqual(['2026-01-15', '2026-07-15']);
    expect(total(result, 'fixedExpenses')).toBe(360);
  });

  it('nimmt für einen custom-Rhythmus ohne Intervall 30 Tage an', () => {
    // Ohne Vorgabe würde ein Intervall von 0 oder NaN die Fälligkeitsschleife
    // entweder blockieren oder die Zahlung täglich buchen — beides erzeugt eine
    // Prognose, die mit dem echten Vertrag nichts zu tun hat.
    const result = run({
      accounts: [checking(5000)],
      recurringFlows: [
        { id: 'c', name: 'Abo', amount: -30, cadence: 'custom', anchorDate: START, accountId: 'giro' },
      ],
    });
    const treffer = result.daily.filter((p) => p.fixedExpenses > 0).map((p) => p.date);
    expect(treffer.slice(0, 3)).toEqual(['2026-01-01', '2026-01-31', '2026-03-02']);
  });

  it('behandelt ein Intervall von 0 Tagen als 1 Tag, statt endlos zu buchen', () => {
    const result = run(
      {
        accounts: [checking(5000)],
        recurringFlows: [
          { id: 'c0', name: 'Tagessatz', amount: -1, cadence: 'custom', intervalDays: 0, anchorDate: START, accountId: 'giro' },
        ],
      },
      { months: 6 },
    );
    // 181 Tage im Horizont, täglich 1 € = 181 €.
    expect(total(result, 'fixedExpenses')).toBe(181);
  });

  it('fällt bei einem unbekannten Rhythmus auf monatlich zurück', () => {
    const result = run({
      accounts: [checking(5000)],
      recurringFlows: [
        {
          id: 'x',
          name: 'Unbekannt',
          amount: -50,
          cadence: 'vierteljaehrlich-neu' as RecurringCadence,
          anchorDate: '2026-01-10',
          accountId: 'giro',
        },
      ],
    });
    expect(result.daily.filter((p) => p.fixedExpenses > 0)).toHaveLength(6);
  });

  it('listet Fälligkeiten eines Flows ohne Start-/Enddatum über den ganzen Bereich', () => {
    const treffer = listFlowOccurrences(
      { id: 'f', name: 'Miete', amount: -800, cadence: 'monthly', anchorDate: '2026-01-03', accountId: 'giro' },
      '2026-01-01',
      '2026-03-31',
    );
    expect(treffer).toEqual(['2026-01-03', '2026-02-03', '2026-03-03']);
  });
});

describe('Forecast — variable Baseline in den Randlagen', () => {
  it('bucht nichts für eine Baseline von 0 €', () => {
    const result = run({
      accounts: [checking(1000)],
      variableExpenses: [{ category: 'Leer', monthlyAmount: 0 }],
    });
    expect(total(result, 'variableExpenses')).toBe(0);
    expect(result.daily.at(-1)!.operatingCash).toBe(1000);
  });

  it('verteilt einen Kleinstbetrag cent-genau, ohne ihn aufzurunden', () => {
    // 20 Cent auf 31 Januartage: 20 Tage bekommen 1 Cent, 11 Tage gar nichts.
    // Würde jeder Tag aufgerundet, entstünden aus 0,20 € über den Horizont
    // mehrere Euro.
    const result = run(
      { accounts: [checking(100)], variableExpenses: [{ category: 'Kleinkram', monthlyAmount: 0.2 }] },
      { months: 6 },
    );
    const januar = result.daily.filter((p) => p.date.startsWith('2026-01'));
    expect(januar.filter((p) => p.variableExpenses > 0)).toHaveLength(20);
    expect(Math.round(januar.reduce((s, p) => s + p.variableExpenses, 0) * 100) / 100).toBe(0.2);
    expect(result.monthly[0].variableExpenses).toBe(0.2);
  });

  it('verschiebt mit Tagesprofil nur das WANN, nie die Monatssumme', () => {
    // Das Wochentagsprofil gewichtet die Tage (Wochenende teurer). Die
    // Monatssumme ist ein Planwert und muss exakt erhalten bleiben — sonst
    // weicht die Prognose allein durch das Einschalten der Profilverteilung
    // vom Budget ab.
    const baseline = {
      category: 'Lebensmittel',
      monthlyAmount: 620,
      // Index 0 = Sonntag … 6 = Samstag, Mittel 1.0 (Summe 7).
      dailyProfile: { weekdayWeights: [1.5, 0.5, 0.5, 0.5, 0.5, 1.5, 2.0] },
    };
    const linear = run({ accounts: [checking(10000)], variableExpenses: [baseline] });
    const profil = run({ accounts: [checking(10000)], variableExpenses: [baseline] }, { useDailyProfile: true });

    expect(profil.monthly[0].variableExpenses).toBe(linear.monthly[0].variableExpenses);
    expect(total(profil, 'variableExpenses')).toBe(total(linear, 'variableExpenses'));
    // 2026-01-03 ist ein Samstag (Gewicht 2.0), 2026-01-05 ein Montag (0.5).
    expect(day(profil, '2026-01-03').variableExpenses).toBeGreaterThan(day(profil, '2026-01-05').variableExpenses);
    expect(day(linear, '2026-01-03').variableExpenses).toBe(day(linear, '2026-01-05').variableExpenses);
  });
});

describe('Forecast — Transfers und geplante Posten an den Bereichsgrenzen', () => {
  it('bucht einen einmaligen Transfer außerhalb des Horizonts nicht', () => {
    const result = run({
      accounts: [checking(1000), tagesgeld(0)],
      transfers: [
        { id: 'vor', amount: 100, fromAccountId: 'giro', toAccountId: 'tg', date: '2025-12-31' },
        { id: 'nach', amount: 100, fromAccountId: 'giro', toAccountId: 'tg', date: '2026-07-01' },
      ],
    });
    expect(total(result, 'transfersOut')).toBe(0);
    expect(result.daily.at(-1)!.accountBalances.giro).toBe(1000);
  });

  it('bucht einen geplanten Posten außerhalb des Horizonts nicht', () => {
    const result = run({
      accounts: [checking(1000)],
      plannedEvents: [
        { id: 'alt', name: 'Alt', amount: -100, date: '2025-12-15', accountId: 'giro' },
        { id: 'spaet', name: 'Später', amount: -100, date: '2026-08-15', accountId: 'giro' },
      ],
    });
    expect(total(result, 'events')).toBe(0);
    expect(result.daily.at(-1)!.operatingCash).toBe(1000);
  });

  it('zählt Geld vom Sparkonto aufs Girokonto als Zufluss in die Liquidität', () => {
    // Die Richtung entscheidet über die Liquiditätsaussage: aus der Reserve
    // aufs Girokonto ist ein Zufluss (transfersIn), umgekehrt ein Abfluss.
    // Eine Verwechslung dreht das Vorzeichen der Monats-Transferzeile.
    const result = run({
      accounts: [checking(0), tagesgeld(5000), tagesgeld(0, 'tg2')],
      transfers: [
        { id: 'auf', amount: 300, fromAccountId: 'tg', toAccountId: 'giro', date: '2026-01-10' },
        { id: 'ab', amount: 200, fromAccountId: 'giro', toAccountId: 'tg', date: '2026-01-20' },
        { id: 'intern', amount: 100, fromAccountId: 'tg', toAccountId: 'tg2', date: '2026-01-25' },
      ],
    });
    expect(day(result, '2026-01-10').transfersIn).toBe(300);
    expect(day(result, '2026-01-20').transfersOut).toBe(200);
    // Reserve zu Reserve berührt die operative Liquidität nicht.
    expect(day(result, '2026-01-25').transfersIn).toBe(0);
    expect(day(result, '2026-01-25').transfersOut).toBe(0);
    expect(result.monthly[0].transfersIn).toBe(300);
    expect(result.monthly[0].transfersOut).toBe(200);
  });

  it('respektiert das Startdatum eines wiederkehrenden Transfers', () => {
    const result = run({
      accounts: [checking(5000), tagesgeld(0)],
      transfers: [
        {
          id: 'sparrate',
          amount: 100,
          fromAccountId: 'giro',
          toAccountId: 'tg',
          cadence: 'monthly',
          anchorDate: '2026-01-05',
          startDate: '2026-03-01',
          endDate: '2026-04-30',
        },
      ],
    });
    const treffer = result.daily.filter((p) => p.transfersOut > 0).map((p) => p.date);
    expect(treffer).toEqual(['2026-03-05', '2026-04-05']);
  });
});

describe('Forecast — Rücklagen', () => {
  it('legt keine Beiträge mehr an, wenn die Fälligkeit vor dem Start liegt', () => {
    // Eine bereits fällige Rücklage darf nicht rückwirkend angespart werden —
    // sonst zöge die Prognose Beiträge vom Girokonto für eine Ausgabe, die
    // längst gebucht ist.
    const fund = {
      id: 'kfz',
      name: 'Kfz-Steuer',
      targetAmount: 240,
      dueDate: '2025-11-01',
      accountId: 'tg',
    };
    expect(calculateRequiredContribution(fund, START)).toBe(240);

    const result = run({ accounts: [checking(2000), tagesgeld(0)], sinkingFunds: [fund] });
    expect(total(result, 'transfersOut')).toBe(0);
    expect(result.daily.at(-1)!.accountBalances.giro).toBe(2000);
  });

  it('zieht die Beiträge vom ausdrücklich benannten Konto ab, nicht vom Girokonto', () => {
    const bar: ForecastAccount = { id: 'bar', name: 'Bargeld', kind: 'cash', openingBalance: 1200 };
    const result = run({
      accounts: [checking(1000), bar, tagesgeld(0)],
      sinkingFunds: [
        {
          id: 'urlaub',
          name: 'Urlaub',
          targetAmount: 600,
          dueDate: '2026-07-01',
          accountId: 'tg',
          fundedFromAccountId: 'bar',
          bookExpenseAtDue: false,
        },
      ],
    });
    expect(result.daily.at(-1)!.accountBalances.giro).toBe(1000);
    expect(result.daily.at(-1)!.accountBalances.bar).toBeLessThan(1200);
    expect(result.daily.at(-1)!.accountBalances.tg).toBeGreaterThan(0);
  });
});

describe('Forecast — Zinsen, die keinen Cent ergeben', () => {
  it('bucht keinen Zins, wenn der Monatsbetrag unter einem Cent liegt', () => {
    // Aufgerundete Kleinstzinsen erzeugten jeden Monatsletzten einen Cent aus
    // dem Nichts — über den Horizont ein sichtbarer Betrag, den es nicht gibt.
    const result = run({
      accounts: [{ id: 'giro', name: 'Girokonto', kind: 'checking', openingBalance: 1, annualInterestRate: 1 }],
    });
    expect(day(result, '2026-01-31').interest).toBe(0);
    expect(result.daily.at(-1)!.operatingCash).toBe(1);
  });

  it('belastet keinen Dispozins, wenn die Belastung unter einem Cent liegt', () => {
    const result = run(
      { accounts: [checking(-0.01)] },
      { overdraftAnnualRate: 10 },
    );
    expect(day(result, '2026-01-31').interest).toBe(0);
    expect(result.daily.at(-1)!.operatingCash).toBe(-0.01);
  });
});

describe('Forecast — Voreinstellungen der Konfiguration', () => {
  it('setzt ohne Startdatum den heutigen Tag und ohne Horizont sechs Monate', () => {
    const result = calculateDeterministicForecast({ accounts: [checking(100)] }, {});
    expect(result.config.startDate).toBe(format(new Date(), 'yyyy-MM-dd'));
    expect(result.config.months).toBe(6);
    // Die Monatsliste zählt die BERÜHRTEN Kalendermonate von [Start, Start+6M).
    // Am Monatsersten sind das genau sechs, an jedem anderen Tag sieben (der
    // angebrochene erste plus sechs). Eine feste 7 war deshalb ein Test, der
    // an 30 von 31 Tagen zufällig recht hatte.
    const laeuftAbMonatserstem = new Date().getDate() === 1;
    expect(result.monthly).toHaveLength(laeuftAbMonatserstem ? 6 : 7);
  });

  it('[REGRESSION] zählt am Monatsersten sechs Monatsblöcke und mitten im Monat sieben', () => {
    // Der Test darüber war datumsabhängig und fiel am 2026-09-01 rot aus,
    // ohne dass sich an der Engine etwas geändert hatte. Hier steht dieselbe
    // Regel mit festen Daten — sie kann an keinem Tag zufällig recht haben.
    const amErsten = calculateDeterministicForecast(
      { accounts: [checking(100)] },
      { startDate: '2026-09-01', months: 6 },
    );
    expect(amErsten.monthly.map((m) => m.month)).toEqual([
      '2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02',
    ]);

    const mittenImMonat = calculateDeterministicForecast(
      { accounts: [checking(100)] },
      { startDate: '2026-09-15', months: 6 },
    );
    expect(mittenImMonat.monthly.map((m) => m.month)).toEqual([
      '2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03',
    ]);
  });

  it('drosselt beim Gegensteuern ohne eigene Vorgabe höchstens die Hälfte der Tagesausgabe', () => {
    // Der Standard-Deckel bestimmt, wie viel Geld die Simulation zurückhält.
    // Ein anderer Wert verschiebt jeden Saldo der Was-wäre-wenn-Rechnung.
    const input: ForecastInput = {
      accounts: [checking(100)],
      variableExpenses: [{ category: 'Lebensmittel', monthlyAmount: 620 }],
    };
    const result = run(input, { adaptiveSpending: { threshold: 1000 } });
    expect(result.config.adaptiveSpending).toEqual({ threshold: 1000, maxReductionPct: 0.5 });
    // 620 € auf 31 Januartage = 20 €/Tag; höchstens die Hälfte wird zurückgehalten.
    expect(day(result, '2026-01-02').variableExpenses).toBe(10);
  });
});
