import { describe, expect, it } from 'vitest';
import { questionCatalog } from '@/features/money-questions/data/question-catalog';
import { asTransactionId } from '@/lib/ids';
import type { QuestionData } from '@/features/shared/domain/question-registry';
import type { Transaction } from '@/types';
import type { Debt } from '@/lib/debt-types';

/**
 * Der Eintrag `raten.offen` ist der Beleg dafür, dass die Bauform aus WP-C
 * trägt: Eine neue beantwortbare Frage entstand als Eintrag NEBEN dem Feature
 * plus einer reinen Funktion in `src/lib/` — die Chat-Fläche wurde dafür nicht
 * angefasst.
 */

function tx(over: Partial<Transaction>): Transaction {
  return {
    id: asTransactionId('t'), user_id: 'local', account_id: 'a', date: '2026-08-01',
    amount: -49.9, payee: 'KLARNA', description: '', original_text: '',
    category_id: null, auto_mapped: false, confirmed: true,
    ...over,
  } as Transaction;
}

function daten(transactions: Transaction[]): QuestionData {
  return { transactions, jetzt: new Date('2026-08-23T12:00:00Z') };
}

describe('raten.offen', () => {
  const eintrag = questionCatalog.byId('raten.offen')!;

  it('sollte über den Katalog auffindbar sein', () => {
    // Die Kompositionswurzel sammelt per `import.meta.glob` ein. Eine
    // Handliste wäre genau das, was beim Hinzufügen vergessen wird — und das
    // Vergessen ist stumm: Die Frage würde schlicht nie beantwortet.
    expect(eintrag).toBeDefined();
    expect(eintrag.needs).toContain('transactions');
  });

  it('sollte die Restlaufzeit RECHNEN, nicht aus dem Text übernehmen', () => {
    const antwort = eintrag.antwort({}, daten([tx({ description: 'Ratenkauf 3/12' })]));

    expect(antwort.wert).toBe(9);
    expect(antwort.aussage.params.gesamt).toBe(12);
  });

  it('sollte den Deep-Link auf den Händler setzen', () => {
    const antwort = eintrag.antwort({}, daten([tx({ description: 'Ratenkauf 3/12' })]));

    expect(antwort.deepLink).toContain('merchant=klarna');
    // Bewusst `kontext` und nicht `quelle`: Der Link zeigt ALLE Buchungen des
    // Händlers, die Zahl stammt aus genau einer — der jüngsten.
    expect(antwort.deepLinkArt).toBe('kontext');
  });

  it('sollte ohne Ratenhinweis „keine" antworten statt 0 Raten zu behaupten', () => {
    // „Noch 0 Raten" hiesse „du bist fertig". „Kein Ratenhinweis gefunden"
    // heisst „ich weiß es nicht". Das ist nicht dasselbe.
    const antwort = eintrag.antwort({}, daten([tx({ description: 'REWE' })]));

    expect(antwort.art).toBe('keine');
    expect(antwort.wert).toBeNull();
    expect(antwort.aussage.key).toBe('financeQuestions.answer.ratenKeine');
  });

  it('sollte nach Händler filtern, wenn der Slot gesetzt ist', () => {
    const buchungen = [
      tx({ id: asTransactionId('1'), payee: 'KLARNA', description: 'Ratenkauf 3/12' }),
      tx({ id: asTransactionId('2'), payee: 'SANTANDER', description: 'Finanzierung Rate 1 von 48' }),
    ];

    expect(eintrag.antwort({ haendler: 'klarna' }, daten(buchungen)).wert).toBe(9);
    expect(eintrag.antwort({ haendler: 'santander' }, daten(buchungen)).wert).toBe(47);
  });

  it('sollte die Begründung belegen können', () => {
    const antwort = eintrag.antwort({}, daten([tx({ description: 'Ratenkauf 3/12' })]));

    expect(antwort.begruendung?.map((b) => b.key)).toEqual([
      'financeQuestions.reason.ratenMonatlich',
      'financeQuestions.reason.ratenBeleg',
    ]);
    expect(antwort.begruendung![1].params.beleg).toBe('3/12');
  });
});

/**
 * Tilgungsfragen (Welle 3) — gerechnet mit `calculatePayoffPlan`, derselben
 * Simulation, die `/debts` zeigt.
 */
describe('Tilgungsfragen', () => {
  const schuld = (over: Partial<Debt>): Debt =>
    ({
      id: over.id ?? 'd1',
      user_id: 'local',
      name: over.name ?? 'Kredit',
      balance: over.balance ?? 5000,
      interest_rate: over.interest_rate ?? 12,
      min_payment: over.min_payment ?? 200,
      is_paid_off: false,
      ...over,
    }) as Debt;

  const mit = (debts: Debt[]): QuestionData => ({ debts, jetzt: new Date('2026-08-20T12:00:00Z') });

  it('schulden.dauer sollte die Laufzeit bei den Mindestraten nennen', () => {
    // Das Budget IST die Mindestrate: Wer fragt „wie lange noch", meint den
    // Lauf, der ohne weitere Entscheidung eintritt. Eine grosszügigere
    // Annahme machte die Antwort schöner und unbrauchbar.
    const antwort = questionCatalog.byId('schulden.dauer')!.antwort({}, mit([schuld({})]));
    expect(antwort.art).toBe('anzahl');
    expect(antwort.wert).toBeGreaterThan(0);
    expect(antwort.begruendung?.[0]?.params.betrag).toBe(200);
  });

  it('[REGRESSION] sollte bei zu kleinen Mindestraten KEINE Laufzeit nennen', () => {
    // Decken die Raten die Zinsen nicht, gibt es keine Laufzeit — die Schuld
    // wächst. Eine Zahl wäre hier die schädlichste Form von Zuversicht.
    const antwort = questionCatalog
      .byId('schulden.dauer')!
      .antwort({}, mit([schuld({ balance: 20000, interest_rate: 20, min_payment: 5 })]));
    expect(antwort.art).toBe('keine');
    expect(antwort.aussage.key).toBe('financeQuestions.answer.schuldenBudgetReichtNicht');
  });

  it('schulden.zinsen sollte die Zinssumme samt Laufzeit belegen', () => {
    const antwort = questionCatalog.byId('schulden.zinsen')!.antwort({}, mit([schuld({})]));
    expect(antwort.art).toBe('geld');
    expect(antwort.wert).toBeGreaterThan(0);
    expect(antwort.begruendung?.[0]?.params.monate).toBeGreaterThan(0);
  });

  it('schulden.sondertilgung sollte gesparte Zinsen als VERGLEICH liefern', () => {
    // Verglichen werden die Zinsen, nicht die Monate: Die gesparten Zinsen
    // sind das Geld, das jemand behält. Die kürzere Laufzeit steht daneben.
    const antwort = questionCatalog
      .byId('schulden.sondertilgung')!
      .antwort({ betrag: 100 }, mit([schuld({})]));
    expect(antwort.art).toBe('vergleich');
    expect(antwort.vergleich!.referenz).toBeGreaterThan(antwort.wert!);
    expect(antwort.aussage.params.gespart).toBeGreaterThan(0);
    expect(antwort.begruendung?.[0]?.params.monate).toBeGreaterThan(0);
  });

  it('sollte ohne offene Schuld „keine" sagen statt 0 Monate', () => {
    const antwort = questionCatalog.byId('schulden.dauer')!.antwort({}, mit([]));
    expect(antwort.art).toBe('keine');
  });
});
