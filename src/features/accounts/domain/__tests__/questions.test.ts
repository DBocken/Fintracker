import { describe, expect, it } from 'vitest';
import { questionCatalog } from '@/features/money-questions/data/question-catalog';
import { asTransactionId } from '@/lib/ids';
import type { QuestionData } from '@/lib/question-registry';
import type { Transaction } from '@/types';

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
