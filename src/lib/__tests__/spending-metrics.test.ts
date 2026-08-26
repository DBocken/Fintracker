import { describe, expect, it } from 'vitest';
import {
  anteilAnGesamt,
  durchschnittJeVorgang,
  extremwertMonat,
  extremwertVorgang,
  monateImBestand,
  monatsDurchschnitt,
  monatsReihe,
  trendRichtung,
  vergleicheMengen,
} from '../spending-metrics';
import type { Transaction } from '@/types';
import { asTransactionId } from '@/lib/ids';

let seq = 0;
function tx(date: string, amount: number, extra: Partial<Transaction> = {}): Transaction {
  seq += 1;
  return {
    id: asTransactionId(`sm-${seq}`),
    date,
    amount,
    payee: 'Händler',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: false,
    ...extra,
  } as Transaction;
}

describe('monateImBestand', () => {
  it('sollte KALENDERMONATE zählen, nicht Monate mit Buchungen', () => {
    // Der Kern der Kennzahl: Wer im Januar und im April tankt, belastet
    // seinen Haushalt über vier Monate — nicht über zwei.
    const menge = [tx('2026-01-15', -100), tx('2026-04-15', -100)];
    expect(monateImBestand(menge)).toBe(4);
  });

  it('sollte über den Jahreswechsel richtig zählen', () => {
    expect(monateImBestand([tx('2025-11-01', -10), tx('2026-02-01', -10)])).toBe(4);
  });

  it('sollte für eine leere Menge null Monate liefern', () => {
    expect(monateImBestand([])).toBe(0);
  });
});

describe('monatsDurchschnitt', () => {
  it('sollte die Summe auf die abgedeckten Monate verteilen', () => {
    // 400 € über vier Kalendermonate = 100 €/Monat, obwohl nur zwei
    // Buchungen existieren.
    const menge = [tx('2026-01-15', -300), tx('2026-04-15', -100)];
    expect(monatsDurchschnitt(menge)).toBe(100);
  });

  it('sollte bei leerer Menge null liefern statt 0 € zu behaupten', () => {
    // „0 € im Monat" und „dazu liegt mir nichts vor" sind verschiedene
    // Aussagen — die Fläche muss sie unterscheiden können.
    expect(monatsDurchschnitt([])).toBeNull();
  });

  it('sollte interne Umbuchungen nicht mitzählen', () => {
    const menge = [tx('2026-01-15', -100), tx('2026-01-20', -500, { is_transfer: true })];
    expect(monatsDurchschnitt(menge)).toBe(100);
  });
});

describe('anteilAnGesamt', () => {
  it('sollte den Anteil als Quote 0..1 liefern', () => {
    const teil = [tx('2026-07-01', -250)];
    const gesamt = [...teil, tx('2026-07-02', -750)];
    expect(anteilAnGesamt(teil, gesamt)).toBeCloseTo(0.25);
  });

  it('sollte ohne Gesamtausgaben null liefern statt durch null zu teilen', () => {
    expect(anteilAnGesamt([tx('2026-07-01', -100)], [])).toBeNull();
  });
});

describe('durchschnittJeVorgang', () => {
  it('sollte Summe durch ANZAHL rechnen — die typische Rechnungshöhe', () => {
    const menge = [tx('2026-07-01', -30), tx('2026-07-05', -50), tx('2026-08-01', -40)];
    expect(durchschnittJeVorgang(menge)).toBe(40);
  });

  it('sollte Einnahmen und Transfers ausklammern', () => {
    const menge = [
      tx('2026-07-01', -30),
      tx('2026-07-02', 2000),
      tx('2026-07-03', -70, { is_transfer: true }),
      tx('2026-07-04', -50),
    ];
    expect(durchschnittJeVorgang(menge)).toBe(40);
  });

  it('sollte ohne Ausgaben null liefern', () => {
    expect(durchschnittJeVorgang([tx('2026-07-02', 2000)])).toBeNull();
  });
});

describe('extremwertMonat', () => {
  const menge = [
    tx('2026-05-01', -100),
    tx('2026-06-01', -300),
    tx('2026-06-20', -100),
    tx('2026-07-01', -50),
  ];

  it('sollte den teuersten Monat samt Summe nennen', () => {
    expect(extremwertMonat(menge)).toEqual({ betrag: 400, bezug: '2026-06' });
  });

  it('sollte auf Wunsch den günstigsten Monat nennen', () => {
    expect(extremwertMonat(menge, 'niedrigster')).toEqual({ betrag: 50, bezug: '2026-07' });
  });

  it('sollte ohne Ausgaben null liefern', () => {
    expect(extremwertMonat([])).toBeNull();
  });
});

describe('extremwertVorgang', () => {
  it('sollte die teuerste einzelne Buchung mit Datum und Händler nennen', () => {
    const menge = [
      tx('2026-07-01', -30, { payee: 'Aldi' }),
      tx('2026-07-05', -220, { payee: 'IKEA' }),
      tx('2026-07-09', -40, { payee: 'Rewe' }),
    ];
    expect(extremwertVorgang(menge)).toEqual({ betrag: 220, bezug: '2026-07-05', label: 'IKEA' });
  });
});

describe('vergleicheMengen', () => {
  it('sollte Wert, Referenz, Differenz und relative Änderung liefern', () => {
    const ergebnis = vergleicheMengen([tx('2026-07-01', -150)], [tx('2025-07-01', -100)]);
    expect(ergebnis).toMatchObject({ wert: 150, referenz: 100, differenz: 50 });
    expect(ergebnis.quote).toBeCloseTo(0.5);
  });

  it('sollte ohne Referenzausgaben keine Prozentzahl behaupten', () => {
    // Eine prozentuale Änderung gegenüber „nichts" gibt es nicht.
    expect(vergleicheMengen([tx('2026-07-01', -150)], []).quote).toBeNull();
  });
});

describe('monatsReihe', () => {
  it('sollte fehlende Monate mit 0 auffüllen statt sie auszulassen', () => {
    // Eine Lücke liest sich sonst wie „kein Datenpunkt", obwohl sie
    // „nichts ausgegeben" heisst — und ein Trend über eine löchrige Reihe
    // ist keiner.
    const reihe = monatsReihe([tx('2026-01-10', -100), tx('2026-03-10', -300)]);
    expect(reihe).toEqual([
      { monat: '2026-01', betrag: 100 },
      { monat: '2026-02', betrag: 0 },
      { monat: '2026-03', betrag: 300 },
    ]);
  });

  it('sollte über den Jahreswechsel korrekt fortzählen', () => {
    const reihe = monatsReihe([tx('2025-12-10', -100), tx('2026-01-10', -200)]);
    expect(reihe.map((p) => p.monat)).toEqual(['2025-12', '2026-01']);
  });
});

describe('trendRichtung', () => {
  it('sollte eine steigende Reihe erkennen', () => {
    const reihe = [
      { monat: '2026-01', betrag: 100 },
      { monat: '2026-02', betrag: 100 },
      { monat: '2026-03', betrag: 200 },
      { monat: '2026-04', betrag: 200 },
    ];
    expect(trendRichtung(reihe)).toMatchObject({ richtung: 'steigend' });
  });

  it('sollte eine fallende Reihe erkennen', () => {
    const reihe = [
      { monat: '2026-01', betrag: 300 },
      { monat: '2026-02', betrag: 300 },
      { monat: '2026-03', betrag: 100 },
      { monat: '2026-04', betrag: 100 },
    ];
    expect(trendRichtung(reihe)).toMatchObject({ richtung: 'fallend' });
  });

  it('sollte kleine Schwankungen NICHT zum Trend erklären', () => {
    // Unter 10 % ist Rauschen. Ein „Trend" daraus wäre eine Behauptung.
    const reihe = [
      { monat: '2026-01', betrag: 100 },
      { monat: '2026-02', betrag: 100 },
      { monat: '2026-03', betrag: 105 },
      { monat: '2026-04', betrag: 103 },
    ];
    expect(trendRichtung(reihe)).toMatchObject({ richtung: 'stabil' });
  });

  it('sollte unter vier Monaten gar keinen Trend behaupten', () => {
    expect(
      trendRichtung([
        { monat: '2026-01', betrag: 100 },
        { monat: '2026-02', betrag: 300 },
      ]),
    ).toBeNull();
  });
});
