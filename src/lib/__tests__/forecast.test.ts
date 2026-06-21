import { describe, it, expect } from 'vitest';
import {
  calculateDeterministicForecast,
  calculateRequiredContribution,
} from '@/lib/forecast';
import type {
  ForecastAccount,
  ForecastInput,
  RecurringFlow,
  SinkingFund,
} from '@/lib/forecast-types';

const START = '2026-01-01';

function checking(openingBalance: number, id = 'giro'): ForecastAccount {
  return { id, name: 'Girokonto', kind: 'checking', openingBalance };
}

function tagesgeld(openingBalance: number, id = 'tg'): ForecastAccount {
  return { id, name: 'Tagesgeld', kind: 'savings', openingBalance };
}

function run(input: ForecastInput, config = {}) {
  return calculateDeterministicForecast(input, { startDate: START, months: 6, ...config });
}

/** Findet den Tagespunkt zu einem ISO-Datum. */
function day(result: ReturnType<typeof run>, date: string) {
  const p = result.daily.find((d) => d.date === date);
  if (!p) throw new Error(`no daily point for ${date}`);
  return p;
}

describe('calculateDeterministicForecast – Horizont & Grundlagen', () => {
  it('rechnet tagesgenau und erzwingt mindestens 6 Monate', () => {
    const result = calculateDeterministicForecast(
      { accounts: [checking(1000)] },
      { startDate: START, months: 1 },
    );
    // Min. 6 Monate ab 01.01.2026 -> bis 30.06.2026 = 181 Tage.
    expect(result.config.months).toBe(6);
    expect(result.daily).toHaveLength(181);
    expect(result.daily[0].date).toBe('2026-01-01');
    expect(result.daily.at(-1)!.date).toBe('2026-06-30');
    expect(result.monthly).toHaveLength(6);
  });

  it('hält den Saldo ohne Cashflows konstant', () => {
    const result = run({ accounts: [checking(1000)] });
    expect(result.daily[0].operatingCash).toBe(1000);
    expect(result.daily.at(-1)!.operatingCash).toBe(1000);
    expect(result.risk.lowestBalance).toBe(1000);
  });
});

describe('zykluskorrekte wiederkehrende Zahlungen', () => {
  it('bucht eine monatliche Miete jeden Monat am richtigen Tag', () => {
    const miete: RecurringFlow = {
      id: 'rent',
      name: 'Miete',
      amount: -800,
      cadence: 'monthly',
      anchorDate: '2026-01-01',
      accountId: 'giro',
    };
    const result = run({ accounts: [checking(10_000)], recurringFlows: [miete] });

    for (const d of ['2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01', '2026-06-01']) {
      expect(day(result, d).fixedExpenses).toBe(800);
    }
    // 6 Mieten -> 10_000 - 4800 = 5200
    expect(result.daily.at(-1)!.operatingCash).toBe(5200);
  });

  it('bucht eine jährliche Versicherung nur einmal im Jahr', () => {
    const versicherung: RecurringFlow = {
      id: 'ins',
      name: 'Kfz-Versicherung',
      amount: -1200,
      cadence: 'annual',
      anchorDate: '2026-03-15',
      accountId: 'giro',
    };
    const result = run({ accounts: [checking(5000)], recurringFlows: [versicherung] });

    const charged = result.daily.filter((d) => d.fixedExpenses > 0);
    expect(charged).toHaveLength(1);
    expect(charged[0].date).toBe('2026-03-15');
    expect(charged[0].fixedExpenses).toBe(1200);
    expect(result.daily.at(-1)!.operatingCash).toBe(3800);
  });

  it('bucht eine Quartalszahlung im 6-Monats-Horizont zweimal', () => {
    const quartal: RecurringFlow = {
      id: 'q',
      name: 'Quartalsbeitrag',
      amount: -300,
      cadence: 'quarterly',
      anchorDate: '2026-01-10',
      accountId: 'giro',
    };
    const result = run({ accounts: [checking(2000)], recurringFlows: [quartal] });
    const charged = result.daily.filter((d) => d.fixedExpenses > 0).map((d) => d.date);
    // 10.01 und 10.04 liegen im Horizont; 10.07 nicht mehr.
    expect(charged).toEqual(['2026-01-10', '2026-04-10']);
  });

  it('verteilt eine zweiwöchentliche Zahlung alle 14 Tage', () => {
    const flow: RecurringFlow = {
      id: 'bw',
      name: 'Zweiwöchentlich',
      amount: -50,
      cadence: 'biweekly',
      anchorDate: '2026-01-02',
      accountId: 'giro',
    };
    const result = run({ accounts: [checking(1000)], recurringFlows: [flow] });
    const charged = result.daily.filter((d) => d.fixedExpenses > 0).map((d) => d.date);
    expect(charged.slice(0, 3)).toEqual(['2026-01-02', '2026-01-16', '2026-01-30']);
  });

  it('verbucht Einnahmen als inflow und erhöht den Saldo', () => {
    const gehalt: RecurringFlow = {
      id: 'salary',
      name: 'Gehalt',
      amount: 2500,
      cadence: 'monthly',
      anchorDate: '2026-01-28',
      accountId: 'giro',
    };
    const result = run({ accounts: [checking(0)], recurringFlows: [gehalt] });
    expect(day(result, '2026-01-28').inflows).toBe(2500);
    expect(day(result, '2026-01-28').fixedExpenses).toBe(0);
    // 6 Gehälter (Jan-Jun)
    expect(result.daily.at(-1)!.operatingCash).toBe(15_000);
  });

  it('stoppt eine Zahlung am Enddatum', () => {
    const flow: RecurringFlow = {
      id: 'sub',
      name: 'Abo',
      amount: -20,
      cadence: 'monthly',
      anchorDate: '2026-01-05',
      accountId: 'giro',
      endDate: '2026-03-31',
    };
    const result = run({ accounts: [checking(1000)], recurringFlows: [flow] });
    const charged = result.daily.filter((d) => d.fixedExpenses > 0).map((d) => d.date);
    expect(charged).toEqual(['2026-01-05', '2026-02-05', '2026-03-05']);
  });

  it('startet eine Zahlung erst ab dem Startdatum', () => {
    const flow: RecurringFlow = {
      id: 'new',
      name: 'Neuer Vertrag',
      amount: -100,
      cadence: 'monthly',
      anchorDate: '2026-01-15',
      accountId: 'giro',
      startDate: '2026-04-01',
    };
    const result = run({ accounts: [checking(1000)], recurringFlows: [flow] });
    const charged = result.daily.filter((d) => d.fixedExpenses > 0).map((d) => d.date);
    expect(charged).toEqual(['2026-04-15', '2026-05-15', '2026-06-15']);
  });
});

describe('Kontoarten & Cash-Sichten', () => {
  it('unterscheidet operatingCash, availableCash und netWorth', () => {
    const result = run({ accounts: [checking(300), tagesgeld(8000)] });
    const first = result.daily[0];
    expect(first.operatingCash).toBe(300); // nur Giro
    expect(first.availableCash).toBe(8300); // Giro + Tagesgeld-Reserve
    expect(first.netWorth).toBe(8300);
  });

  it('zählt eine Kreditkartenschuld nur ins Net Worth, nicht in operating/available', () => {
    const result = run({
      accounts: [
        checking(2000),
        { id: 'cc', name: 'Kreditkarte', kind: 'credit_card', openingBalance: -1200 },
      ],
    });
    const first = result.daily[0];
    expect(first.operatingCash).toBe(2000);
    expect(first.availableCash).toBe(2000);
    expect(first.netWorth).toBe(800);
  });
});

describe('interne Transfers', () => {
  it('lässt das Net Worth unverändert, senkt aber operatingCash (Giro -> Tagesgeld)', () => {
    const result = run({
      accounts: [checking(1000), tagesgeld(0)],
      transfers: [
        { id: 't1', amount: 600, fromAccountId: 'giro', toAccountId: 'tg', date: '2026-01-10' },
      ],
    });
    const before = day(result, '2026-01-09');
    const after = day(result, '2026-01-10');

    expect(before.operatingCash).toBe(1000);
    expect(after.operatingCash).toBe(400); // Giro gesunken
    expect(after.availableCash).toBe(1000); // Reserve unverändert
    expect(after.netWorth).toBe(1000); // Net Worth neutral
    expect(after.transfersOut).toBe(600);
    expect(after.transfersIn).toBe(0);
  });

  it('zählt einen Transfer zwischen zwei operativen Konten nicht als Grenzübertritt', () => {
    const result = run({
      accounts: [checking(1000, 'giro'), { id: 'bar', name: 'Bargeld', kind: 'cash', openingBalance: 0 }],
      transfers: [
        { id: 't', amount: 100, fromAccountId: 'giro', toAccountId: 'bar', date: '2026-01-05' },
      ],
    });
    const after = day(result, '2026-01-05');
    expect(after.operatingCash).toBe(1000); // bleibt, beide operativ
    expect(after.transfersIn).toBe(0);
    expect(after.transfersOut).toBe(0);
  });

  it('unterstützt wiederkehrende Sparraten als Transfer', () => {
    const result = run({
      accounts: [checking(5000), tagesgeld(0)],
      transfers: [
        {
          id: 'save',
          amount: 200,
          fromAccountId: 'giro',
          toAccountId: 'tg',
          cadence: 'monthly',
          anchorDate: '2026-01-01',
        },
      ],
    });
    // 6 Sparraten -> Giro 5000-1200=3800, Tagesgeld 1200, Net Worth 5000
    const last = result.daily.at(-1)!;
    expect(last.accountBalances.giro).toBe(3800);
    expect(last.accountBalances.tg).toBe(1200);
    expect(last.netWorth).toBe(5000);
  });
});

describe('variable Ausgaben-Baseline', () => {
  it('verteilt variable Ausgaben über die Tage des Monats', () => {
    const result = run({
      accounts: [checking(10_000)],
      variableExpenses: [{ category: 'groceries', monthlyAmount: 310 }],
    });
    // Januar hat 31 Tage -> 10 €/Tag.
    expect(day(result, '2026-01-01').variableExpenses).toBeCloseTo(10, 2);
    expect(day(result, '2026-01-15').variableExpenses).toBeCloseTo(10, 2);
    // Summe Januar ~ 310 €.
    const jan = result.monthly.find((m) => m.month === '2026-01')!;
    expect(jan.variableExpenses).toBeCloseTo(310, 1);
  });

  it('verteilt Monatsbeträge centgenau und akzeptiert unterschiedliche Monatspläne', () => {
    const result = run({
      accounts: [checking(1000)],
      variableExpenses: [{
        category: 'groceries',
        monthlyAmount: 100,
        monthlyAmounts: { '2026-01': 100.01, '2026-02': 200.02 },
      }],
    });
    expect(result.monthly[0].variableExpenses).toBe(100.01);
    expect(result.monthly[1].variableExpenses).toBe(200.02);
  });

  it('nutzt den Budget-Override statt der historischen Baseline', () => {
    const result = run({
      accounts: [checking(10_000)],
      variableExpenses: [{ category: 'dining', monthlyAmount: 360, budgetOverride: 220 }],
    });
    const jan = result.monthly.find((m) => m.month === '2026-01')!;
    // Gleichverteilung über 31 Tage erzeugt einen Cent-Rundungsrest (~220,10).
    expect(jan.variableExpenses).toBeCloseTo(220, 0);
  });
});

describe('geplante Einmalposten', () => {
  it('bucht einen Einmalposten am Datum und beeinflusst den Saldo', () => {
    const result = run({
      accounts: [checking(1000)],
      plannedEvents: [
        { id: 'tax', name: 'Steuererstattung', amount: 900, date: '2026-02-20', accountId: 'giro' },
      ],
    });
    expect(day(result, '2026-02-20').events).toBe(900);
    expect(result.daily.at(-1)!.operatingCash).toBe(1900);
  });
});

describe('Sicherheitspuffer, Monatstief & Risiko', () => {
  it('erkennt das Monatstief korrekt (Miete früh, Gehalt spät)', () => {
    const result = run({
      accounts: [checking(1000)],
      recurringFlows: [
        { id: 'rent', name: 'Miete', amount: -900, cadence: 'monthly', anchorDate: '2026-01-01', accountId: 'giro' },
        { id: 'pay', name: 'Gehalt', amount: 2000, cadence: 'monthly', anchorDate: '2026-01-28', accountId: 'giro' },
      ],
    });
    const jan = result.monthly.find((m) => m.month === '2026-01')!;
    // Tief liegt zwischen Miete (01.) und Gehalt (28.): 1000-900 = 100.
    expect(jan.lowestBalance).toBe(100);
    expect(jan.lowestBalanceDate).toBe('2026-01-01');
    // Monatsende deutlich höher als Tief.
    expect(jan.closingBalance).toBe(2100);
  });

  it('findet den ersten Tag unter dem Sicherheitspuffer', () => {
    const result = run(
      {
        accounts: [checking(1000)],
        recurringFlows: [
          { id: 'rent', name: 'Miete', amount: -600, cadence: 'monthly', anchorDate: '2026-01-05', accountId: 'giro' },
        ],
      },
      { safetyBuffer: 500 },
    );
    // 05.01: 1000-600=400 < 500 -> erster Pufferbruch.
    expect(result.risk.firstBelowSafetyBufferDate).toBe('2026-01-05');
    expect(day(result, '2026-01-04').belowSafetyBuffer).toBe(false);
    expect(day(result, '2026-01-05').belowSafetyBuffer).toBe(true);
    expect(result.insights[0].kind).toBe('below_buffer');
  });

  it('bezieht den Puffer auf availableCash, wenn so konfiguriert', () => {
    const result = run(
      { accounts: [checking(100), tagesgeld(5000)] },
      { safetyBuffer: 1000, bufferBasis: 'available' },
    );
    // operating=100 < 1000, aber available=5100 -> kein Bruch.
    expect(result.risk.firstBelowSafetyBufferDate).toBeNull();
    expect(result.insights[0].kind).toBe('ok');
  });

  it('liefert minimumOperatingCash und minimumAvailableCash', () => {
    const result = run({
      accounts: [checking(1000), tagesgeld(2000)],
      recurringFlows: [
        { id: 'rent', name: 'Miete', amount: -800, cadence: 'monthly', anchorDate: '2026-01-10', accountId: 'giro' },
      ],
    });
    expect(result.risk.minimumOperatingCash).toBeLessThan(1000);
    expect(result.risk.minimumAvailableCash).toBe(result.risk.minimumOperatingCash + 2000);
  });
});

describe('Endsaldo-Korrektheit über mehrere Monate', () => {
  it('stimmt nach 3 Monaten bei gemischten Cashflows', () => {
    const result = run({
      accounts: [checking(1000)],
      recurringFlows: [
        { id: 'pay', name: 'Gehalt', amount: 2000, cadence: 'monthly', anchorDate: '2026-01-25', accountId: 'giro' },
        { id: 'rent', name: 'Miete', amount: -800, cadence: 'monthly', anchorDate: '2026-01-01', accountId: 'giro' },
      ],
    });
    // Ende März (31.03.): Start 1000 + 3*2000 - 3*800 = 4600.
    const march = day(result, '2026-03-31');
    expect(march.operatingCash).toBe(4600);
  });
});

describe('Tagesgeld-Zinsen', () => {
  it('schreibt am Monatsende Zinsen auf den positiven Saldo gut', () => {
    const result = run({
      accounts: [
        checking(0),
        { id: 'tg', name: 'Tagesgeld', kind: 'savings', openingBalance: 10_000, annualInterestRate: 3 },
      ],
    });
    // 3 % p.a. auf 10.000 -> 25 €/Monat (10000*3/1200).
    const jan31 = day(result, '2026-01-31');
    expect(jan31.interest).toBeCloseTo(25, 2);
    expect(jan31.accountBalances.tg).toBeCloseTo(10_025, 2);
    // verfügbar steigt, Giro (operativ) unverändert.
    expect(jan31.operatingCash).toBe(0);
    expect(jan31.availableCash).toBeCloseTo(10_025, 2);
  });

  it('verzinst negative Salden nicht', () => {
    const result = run({
      accounts: [
        { id: 'cc', name: 'Kreditkarte', kind: 'credit_card', openingBalance: -500, annualInterestRate: 5 },
      ],
    });
    expect(day(result, '2026-01-31').interest).toBe(0);
  });

  it('summiert Zinsen in der Monatszusammenfassung', () => {
    const result = run({
      accounts: [
        checking(0),
        { id: 'tg', name: 'Tagesgeld', kind: 'savings', openingBalance: 10_000, annualInterestRate: 3 },
      ],
    });
    const jan = result.monthly.find((m) => m.month === '2026-01')!;
    expect(jan.interest).toBeCloseTo(25, 2);
  });
});

describe('Rücklagen (Sinking Funds)', () => {
  it('berechnet den erforderlichen Monatsbeitrag', () => {
    const fund: SinkingFund = {
      id: 'kfz',
      name: 'Kfz-Versicherung',
      targetAmount: 1200,
      dueDate: '2026-07-01',
      accountId: 'tg',
    };
    // 01.01 -> 01.07 = 6 Monate, 1200/6 = 200.
    expect(calculateRequiredContribution(fund, '2026-01-01')).toBe(200);
  });

  it('berücksichtigt bereits Zurückgelegtes', () => {
    const fund: SinkingFund = {
      id: 'urlaub',
      name: 'Urlaub',
      targetAmount: 1200,
      currentSaved: 600,
      dueDate: '2026-07-01',
      accountId: 'tg',
    };
    expect(calculateRequiredContribution(fund, '2026-01-01')).toBe(100);
  });

  it('spart über Transfers an und bucht die Ausgabe – Net Worth sinkt nur einmal', () => {
    const result = run({
      accounts: [
        checking(3000),
        { id: 'tg', name: 'Tagesgeld', kind: 'savings', openingBalance: 0 },
      ],
      sinkingFunds: [
        {
          id: 'kfz',
          name: 'Kfz-Versicherung',
          targetAmount: 600,
          dueDate: '2026-04-15',
          accountId: 'tg',
          fundedFromAccountId: 'giro',
        },
      ],
    });
    // Beiträge: 600/3 Monate = 200/Monat, vom Giro aufs Tagesgeld.
    // Am 15.04. wird die 600-€-Ausgabe vom Tagesgeld gebucht.
    const last = result.daily.at(-1)!;
    // Giro: 3000 - 3*200 (Jan/Feb/Mär Beiträge) = 2400.
    expect(last.accountBalances.giro).toBe(2400);
    // Tagesgeld: 3*200 angespart - 600 Ausgabe = 0.
    expect(last.accountBalances.tg).toBe(0);
    // Net Worth: 3000 - 600 = 2400 (Ausgabe genau einmal wirksam).
    expect(last.netWorth).toBe(2400);
  });
});
