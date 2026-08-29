import { describe, expect, it } from 'vitest';
import { questionCatalog } from '@/features/money-questions/data/question-catalog';
import { asTransactionId } from '@/lib/ids';
import type { QuestionData } from '@/features/shared/domain/question-registry';
import type { Transaction } from '@/types';
import { SUPPORTED_LOCALES } from '@/i18n/locale';
import { istTransferAktion } from '@/features/shared/domain/question-registry';
import { translations } from '@/i18n/translations';

/** Punktpfad in einem Sprachbaum auflösen. */
function blatt(baum: unknown, pfad: string): unknown {
  return pfad.split('.').reduce<unknown>((k, teil) => (k as Record<string, unknown>)?.[teil], baum);
}

/**
 * Konten-Einträge (Welle 2).
 *
 * Der Kern der Prüfung ist NICHT die Arithmetik — die steckt in
 * `net-worth-service` und `disposable-budget` und ist dort geprüft. Geprüft
 * wird hier, dass der Eintrag die vorhandene Zahl NIMMT statt eine zweite
 * Rechnung danebenzustellen, und dass er schweigt, wo er raten müsste.
 */

const JETZT = new Date('2026-08-20T12:00:00Z');

const KONTEN = [
  { id: 'giro', name: 'Girokonto', type: 'checking' },
  { id: 'spar', name: 'Sparkonto', type: 'savings' },
] as never[];

function daten(zusatz: Partial<QuestionData> = {}): QuestionData {
  return {
    accounts: KONTEN,
    categories: [],
    transactions: [],
    netWorth: {
      cash: 1800,
      investments: 0,
      receivables: 0,
      debts: 0,
      netWorth: 1800,
      accountBalances: { giro: 500, spar: 1300 },
      accountSources: [],
      portfolioSources: [],
      unconvertedInvestments: [],
      debtSources: [],
      receivableSources: [],
      manualAssets: 0,
      manualAssetSources: [],
    },
    jetzt: JETZT,
    ...zusatz,
  };
}

describe('konto.saldo', () => {
  const eintrag = questionCatalog.byId('konto.saldo')!;

  it('sollte den Saldo aus der Aufstellung nehmen, nicht selbst summieren', () => {
    // Der Kontostand ist der ANKER plus die Buchungen danach. Wer hier
    // stattdessen über `transactions` summierte, baute die dritte Kopie
    // derselben Rechnung — die ersten beiden waren schon einmal beide falsch
    // (Changelog 2026.8.3). Deshalb liegen hier absichtlich NULL Buchungen
    // vor: Eine eigene Summe ergäbe 0 €, die Aufstellung ergibt 500 €.
    const antwort = eintrag.antwort({ kontoId: 'giro' }, daten());
    expect(antwort.art).toBe('geld');
    expect(antwort.wert).toBe(500);
    expect(antwort.deepLink).toContain('account=giro');
  });

  it('sollte ein unbekanntes Konto benennen, statt 0 € zu behaupten', () => {
    const antwort = eintrag.antwort({ kontoId: 'gibtsnicht' }, daten());
    expect(antwort.art).toBe('keine');
    expect(antwort.wert).toBeNull();
  });
});

describe('konto.gesamt', () => {
  const eintrag = questionCatalog.byId('konto.gesamt')!;

  it('sollte die Summe der Konten nennen und ihre Anzahl mitgeben', () => {
    const antwort = eintrag.antwort({}, daten());
    expect(antwort.wert).toBe(1800);
    expect(antwort.anzahl).toBe(2);
  });

  it('sollte ohne Konto „keines" sagen statt 0 €', () => {
    // „0 €" und „du hast noch kein Konto" sind verschiedene Aussagen.
    const antwort = eintrag.antwort({}, daten({ accounts: [] }));
    expect(antwort.art).toBe('keine');
    expect(antwort.wert).toBeNull();
  });
});

describe('verfuegbar.bisGehalt', () => {
  const eintrag = questionCatalog.byId('verfuegbar.bisGehalt')!;

  let lfd = 0;
  function gehalt(datum: string): Transaction {
    lfd += 1;
    return {
      id: asTransactionId(`gehalt-${lfd}`),
      date: datum,
      amount: 2000,
      payee: 'Muster GmbH',
      description: 'Gehalt August',
      original_text: 'GEHALT',
      auto_mapped: false,
      confirmed: true,
    } as Transaction;
  }

  it('sollte rechnen statt zu verweisen — Guthaben minus fällige Abbuchungen', () => {
    // Bis Welle 2 war dieser Eintrag ein blosser Verweis auf den Coach.
    const antwort = eintrag.antwort(
      {},
      daten({ transactions: [gehalt('2026-06-01'), gehalt('2026-07-01'), gehalt('2026-08-01')] }),
    );
    expect(antwort.art).toBe('geld');
    // Ohne erkannte Abo-Abbuchungen ist das freie Geld das operative
    // Guthaben: Giro 500 €; das Sparkonto zählt bewusst NICHT mit.
    expect(antwort.wert).toBe(500);
    expect(antwort.begruendung?.length).toBe(2);
  });

  it('sollte ohne erkennbaren Geldeingang ABSAGEN statt „bis Monatsende" zu unterstellen', () => {
    // Die Ersatzannahme wäre für jeden mit Gehalt am 15. die falsche Zahl —
    // und sie stünde nirgends. Eine falsche Zahl ist schlimmer als keine.
    const antwort = eintrag.antwort({}, daten());
    expect(antwort.art).toBe('keine');
    expect(antwort.aussage.key).toBe('financeQuestions.answer.freiVerfuegbarOhneGehalt');
  });
});

describe('vermoegen.gesamt und vermoegen.aufteilung', () => {
  const gesamt = questionCatalog.byId('vermoegen.gesamt')!;
  const aufteilung = questionCatalog.byId('vermoegen.aufteilung')!;

  const MIT_VERMOEGEN = () =>
    daten({
      netWorth: {
        cash: 1800,
        investments: 5000,
        receivables: 200,
        debts: 3000,
        netWorth: 4000,
        accountBalances: { giro: 500, spar: 1300 },
        accountSources: [],
        portfolioSources: [],
        unconvertedInvestments: [],
        debtSources: [],
        receivableSources: [],
        manualAssets: 0,
        manualAssetSources: [],
      },
    });

  it('sollte das Nettovermögen aus der Aufstellung nehmen', () => {
    expect(gesamt.antwort({}, MIT_VERMOEGEN()).wert).toBe(4000);
  });

  it('sollte Schulden als NEGATIVE Zeile führen, nicht weglassen', () => {
    // Schulden wegzulassen wäre die Beschönigung, gegen die der Sanfte Modus
    // antritt (`docs/debt-avoidance-recovery.md`): Die Zahl sähe besser aus,
    // und die Aufteilung summierte sich nicht mehr auf das Nettovermögen.
    const antwort = aufteilung.antwort({}, MIT_VERMOEGEN());
    const schulden = antwort.posten?.find((p) => p.labelKey?.endsWith('debts'));
    expect(schulden?.betrag).toBe(-3000);
    const summe = (antwort.posten ?? []).reduce((s, p) => s + p.betrag, 0);
    expect(summe).toBe(antwort.wert);
  });

  it('sollte für jede Rubrik einen Text in ALLEN Sprachen haben', () => {
    // `labelKey` ist ein dynamisch durchgereichter Key — die Aufrufstelle
    // kann ihn nicht prüfen. Deshalb hier: Ein Tippfehler stünde sonst roh
    // auf dem Bildschirm.
    const antwort = aufteilung.antwort({}, MIT_VERMOEGEN());
    for (const posten of antwort.posten ?? []) {
      expect(posten.labelKey, 'jede Rubrik trägt einen Key').toBeTruthy();
      for (const locale of SUPPORTED_LOCALES) {
        expect(typeof blatt(translations[locale], posten.labelKey!), `${locale}: ${posten.labelKey}`).toBe(
          'string',
        );
      }
    }
  });

  it('sollte ohne Aufstellung „nichts erfasst" sagen statt 0 €', () => {
    expect(gesamt.antwort({}, daten({ netWorth: null })).art).toBe('keine');
  });
});

describe('transfer.kandidaten', () => {
  const eintrag = questionCatalog.byId('transfer.kandidaten')!;

  let n = 0;
  function buchung(betrag: number, konto: string, datum: string): Transaction {
    n += 1;
    return {
      id: asTransactionId(`tr-${n}`),
      date: datum,
      amount: betrag,
      account_id: konto,
      payee: betrag < 0 ? 'Abbuchung' : 'Gutschrift',
      description: '',
      original_text: '',
      auto_mapped: false,
      confirmed: true,
    } as Transaction;
  }

  it('sollte ein Gegenpaar auf zwei Konten als möglichen Übertrag melden', () => {
    const antwort = eintrag.antwort(
      {},
      daten({
        transactions: [buchung(-500, 'giro', '2026-08-01'), buchung(500, 'spar', '2026-08-02')],
      }),
    );
    expect(antwort.art).toBe('liste');
    expect(antwort.anzahl).toBe(1);
    expect(antwort.begruendung?.[0]?.key).toBe('financeQuestions.reason.transferNichtVerknuepft');
  });

  it('sollte ein Paar auf DEMSELBEN Konto nicht melden', () => {
    // Zwei Buchungen auf einem Konto sind kein Übertrag zwischen Konten —
    // sie als solchen zu melden entfernte echte Ausgaben aus der Statistik.
    const antwort = eintrag.antwort(
      {},
      daten({
        transactions: [buchung(-500, 'giro', '2026-08-01'), buchung(500, 'giro', '2026-08-02')],
      }),
    );
    expect(antwort.art).toBe('anzahl');
    expect(antwort.wert).toBe(0);
  });

  it('sollte ohne Fund eine ZAHL nennen statt zu schweigen', () => {
    // „Ich habe nichts gefunden" ist eine Antwort; Schweigen sähe aus wie
    // „nicht verstanden".
    const antwort = eintrag.antwort({}, daten({ transactions: [] }));
    expect(antwort.art).toBe('anzahl');
    expect(antwort.aussage.key).toBe('financeQuestions.answer.transferKeine');
  });
});

describe('liquiditaet.reichweite', () => {
  const eintrag = questionCatalog.byId('liquiditaet.reichweite')!;

  let z = 0;
  function ausgabe(betrag: number, datum: string): Transaction {
    z += 1;
    return {
      id: asTransactionId(`rw-${z}`),
      date: datum,
      amount: -betrag,
      payee: 'Supermarkt',
      description: '',
      original_text: '',
      auto_mapped: false,
      confirmed: true,
    } as Transaction;
  }

  it('sollte Guthaben durch Monatsverbrauch teilen und beides belegen', () => {
    // Giro 500 €; 400 € über vier Kalendermonate = 100 €/Monat → 5 Monate.
    const antwort = eintrag.antwort(
      {},
      daten({
        transactions: [ausgabe(300, '2026-05-15'), ausgabe(100, '2026-08-15')],
      }),
    );
    expect(antwort.art).toBe('anzahl');
    expect(antwort.wert).toBeCloseTo(5, 1);
    expect(antwort.begruendung?.[0]?.params.betrag).toBe(500);
    expect(antwort.begruendung?.[1]?.params.betrag).toBe(100);
  });

  it('[REGRESSION] sollte das SPARKONTO nicht mitzählen', () => {
    // `netWorth.cash` enthält es (1800 €), gefragt ist aber das Geld, von dem
    // gelebt wird. Ein Notgroschen, der die Reichweite verlängert, verwischt
    // genau die Zahl, wegen der jemand fragt: 500/100 = 5, nicht 18.
    const antwort = eintrag.antwort({}, daten({ transactions: [ausgabe(100, '2026-08-15')] }));
    expect(antwort.wert).toBeCloseTo(5, 1);
  });

  it('sollte ohne erfasste Ausgaben nicht durch null teilen', () => {
    const antwort = eintrag.antwort({}, daten({ transactions: [] }));
    expect(antwort.art).toBe('keine');
    expect(antwort.aussage.key).toBe('financeQuestions.answer.reichweiteOhneAusgaben');
  });
});

describe('transfer.aktion', () => {
  const eintrag = questionCatalog.byId('transfer.aktion')!;

  let m = 0;
  function b(betrag: number, konto: string, datum: string): Transaction {
    m += 1;
    return {
      id: asTransactionId(`ta-${m}`),
      date: datum,
      amount: betrag,
      account_id: konto,
      payee: betrag < 0 ? 'Abbuchung' : 'Gutschrift',
      description: '',
      original_text: '',
      auto_mapped: false,
      confirmed: true,
    } as Transaction;
  }

  it('sollte die WIRKUNG nennen, nicht nur die Paare', () => {
    // Ein markierter Übertrag verschwindet aus jeder Auswertung. „3 Paare
    // markieren?" lässt niemanden abschätzen, was er auslöst — die Summe,
    // die aus Einnahmen UND Ausgaben fällt, tut es.
    const antwort = eintrag.antwort(
      {},
      daten({ transactions: [b(-500, 'giro', '2026-08-01'), b(500, 'spar', '2026-08-02')] }),
    );
    expect(antwort.art).toBe('aktion');
    const vorschau = antwort.aktion;
    expect(vorschau && istTransferAktion(vorschau) ? vorschau.summe : null).toBe(500);
  });

  it('sollte dieselbe Kandidatenmenge finden wie der Lese-Eintrag', () => {
    // Zwei Wege zur selben Menge wären zwei Orte, an denen Toleranz und
    // Zeitfenster auseinanderlaufen können.
    const zustand = daten({
      transactions: [b(-500, 'giro', '2026-08-01'), b(500, 'spar', '2026-08-02')],
    });
    const lesen = questionCatalog.byId('transfer.kandidaten')!.antwort({}, zustand);
    expect(eintrag.antwort({}, zustand).anzahl).toBe(lesen.anzahl);
  });

  it('sollte ohne Fund eine ZAHL nennen statt eine leere Vorschau', () => {
    // Einen Bestätigen-Knopf anzubieten, der nichts ändert, wäre eine leere
    // Zusage.
    const antwort = eintrag.antwort({}, daten({ transactions: [] }));
    expect(antwort.art).toBe('anzahl');
    expect(antwort.wert).toBe(0);
  });
});

describe('vermoegen.entwicklung', () => {
  const eintrag = questionCatalog.byId('vermoegen.entwicklung')!;

  function stand(month: string, netWorth: number) {
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

  it('sollte mit einem einzigen Stand KEINE Entwicklung behaupten', () => {
    // „±0 €" wäre eine Aussage über eine Veränderung, die niemand beobachtet
    // hat — und die Reihe wird fortgeschrieben, nicht rückgerechnet.
    const antwort = eintrag.antwort(
      {},
      { netWorthHistory: [stand('2026-08', 1000)], jetzt: new Date('2026-08-27T12:00:00Z') },
    );
    expect(antwort.art).toBe('keine');
    expect(antwort.aussage.key).toBe('financeQuestions.answer.vermoegenHistorieFehlt');
  });

  it('sollte Wachstum mit Anfangs- und Endstand belegen', () => {
    const antwort = eintrag.antwort(
      {},
      {
        netWorthHistory: [stand('2026-02', 1000), stand('2026-08', 1500)],
        jetzt: new Date('2026-08-27T12:00:00Z'),
      },
    );
    expect(antwort.wert).toBe(500);
    expect(antwort.aussage.key).toBe('financeQuestions.answer.vermoegenGewachsen');
    expect(antwort.aussage.params.monate).toBe(6);
    expect(antwort.begruendung?.map((g) => g.key)).toContain('financeQuestions.reason.vermoegenQuote');
  });

  it('sollte einen Rückgang als solchen benennen', () => {
    const antwort = eintrag.antwort(
      {},
      {
        netWorthHistory: [stand('2026-02', 1500), stand('2026-08', 1000)],
        jetzt: new Date('2026-08-27T12:00:00Z'),
      },
    );
    expect(antwort.aussage.key).toBe('financeQuestions.answer.vermoegenGesunken');
  });

  it('[REGRESSION] sollte beim Vorzeichenwechsel keine Quote nennen', () => {
    // „+250 %" vom Minus ins Plus ist arithmetisch richtig und als Aussage
    // wertlos: Der Weg aus den Schulden heraus ist keine Rendite.
    const antwort = eintrag.antwort(
      {},
      {
        netWorthHistory: [stand('2026-02', -2000), stand('2026-08', 3000)],
        jetzt: new Date('2026-08-27T12:00:00Z'),
      },
    );
    expect(antwort.begruendung?.map((g) => g.key)).not.toContain(
      'financeQuestions.reason.vermoegenQuote',
    );
  });
});
