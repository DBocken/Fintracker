import { describe, it, expect } from 'vitest';
import {
  entwicklung,
  fortschreiben,
  monatsSchluessel,
  type NetWorthSnapshot,
} from '../net-worth-history-types';

function stand(month: string, netWorth: number): NetWorthSnapshot {
  return {
    month,
    takenAt: `${month}-15`,
    netWorth,
    cash: netWorth,
    investments: 0,
    manualAssets: 0,
    receivables: 0,
    debts: 0,
  };
}

describe('Vermögens-Historie', () => {
  it('sollte den Monatsschlüssel bilden', () => {
    expect(monatsSchluessel(new Date('2026-08-27T10:00:00Z'))).toBe('2026-08');
  });

  it('sollte je Monat nur den ZULETZT genommenen Stand behalten', () => {
    // Zwei Punkte für denselben Monat wären eine Kurve, die in sich springt.
    const bestand = fortschreiben([stand('2026-08', 1000)], {
      ...stand('2026-08', 1500),
      takenAt: '2026-08-28',
    });
    expect(bestand).toHaveLength(1);
    expect(bestand[0].netWorth).toBe(1500);
  });

  it('sollte chronologisch sortiert bleiben, egal in welcher Reihenfolge geschrieben wird', () => {
    const bestand = fortschreiben(
      fortschreiben([stand('2026-08', 1000)], stand('2026-06', 500)),
      stand('2026-07', 800),
    );
    expect(bestand.map((s) => s.month)).toEqual(['2026-06', '2026-07', '2026-08']);
  });

  it('sollte ohne zwei Punkte KEINE Entwicklung behaupten', () => {
    expect(entwicklung([])).toBeNull();
    expect(entwicklung([stand('2026-08', 1000)])).toBeNull();
  });

  it('sollte Differenz, Quote und Monate über die Spanne rechnen', () => {
    const e = entwicklung([stand('2026-02', 1000), stand('2026-08', 1500)]);
    expect(e?.differenz).toBe(500);
    expect(e?.quote).toBeCloseTo(0.5, 6);
    expect(e?.monate).toBe(6);
  });

  it('[REGRESSION] sollte bei einem Vorzeichenwechsel KEINE Quote nennen', () => {
    // „+250 %" von −2.000 € auf +3.000 € ist arithmetisch richtig und als
    // Aussage wertlos: Der Weg aus den Schulden heraus ist keine Rendite.
    const e = entwicklung([stand('2026-02', -2000), stand('2026-08', 3000)]);
    expect(e?.differenz).toBe(5000);
    expect(e?.quote).toBeNull();
  });

  it('sollte bei Nullbasis keine Quote nennen', () => {
    expect(entwicklung([stand('2026-02', 0), stand('2026-08', 900)])?.quote).toBeNull();
  });
});
