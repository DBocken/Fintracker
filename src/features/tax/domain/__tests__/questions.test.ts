import { describe, expect, it } from 'vitest';
import { questionCatalog } from '@/features/money-questions/data/question-catalog';
import { asTransactionId } from '@/lib/ids';
import type { QuestionData } from '@/features/shared/domain/question-registry';
import type { Account, Transaction } from '@/types';

/**
 * Steuer-Einträge (Welle 2).
 *
 * Der Prüfpunkt, der über die Arithmetik hinausgeht: **Ohne
 * Einzelunternehmer-Modus wird abgesagt, nicht gerechnet.** Ohne ihn gibt es
 * kein Geschäftskonto, und ohne Geschäftskonto ist jede EÜR-Zahl null — nicht
 * weil nichts verdient wurde, sondern weil niemand gesagt hat, welches Konto
 * geschäftlich ist. „0 € Gewinn" wäre hier die falscheste aller möglichen
 * Antworten.
 */

const JETZT = new Date('2026-08-20T12:00:00Z');

const GESCHAEFT = { id: 'biz', name: 'Geschäftskonto', is_business: true } as Account;

let lfd = 0;
function tx(betrag: number, datum: string): Transaction {
  lfd += 1;
  return {
    id: asTransactionId(`tax-${lfd}`),
    date: datum,
    amount: betrag,
    account_id: 'biz',
    payee: betrag > 0 ? 'Kunde GmbH' : 'Bürobedarf',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: true,
  } as Transaction;
}

function daten(zusatz: Partial<QuestionData> = {}): QuestionData {
  return {
    accounts: [GESCHAEFT],
    transactions: [tx(5000, '2026-03-01'), tx(-1000, '2026-04-01')],
    settings: { business_mode: true } as never,
    taxReserve: null,
    jetzt: JETZT,
    ...zusatz,
  };
}

describe('steuer.gewinn', () => {
  const eintrag = questionCatalog.byId('steuer.gewinn')!;

  it('sollte Einnahmen minus abziehbare Ausgaben nennen und beides belegen', () => {
    const antwort = eintrag.antwort({}, daten());
    expect(antwort.art).toBe('geld');
    expect(antwort.wert).toBe(4000);
    expect(antwort.begruendung?.[0]?.params.betrag).toBe(5000);
    expect(antwort.begruendung?.[1]?.params.betrag).toBe(1000);
  });

  it('sollte einen Verlust als Verlust benennen', () => {
    const antwort = eintrag.antwort({}, daten({ transactions: [tx(500, '2026-03-01'), tx(-900, '2026-04-01')] }));
    expect(antwort.aussage.key).toBe('financeQuestions.answer.steuerVerlust');
  });

  it('[REGRESSION] sollte ohne Einzelunternehmer-Modus ABSAGEN statt 0 € zu melden', () => {
    const antwort = eintrag.antwort({}, daten({ settings: { business_mode: false } as never }));
    expect(antwort.art).toBe('keine');
    expect(antwort.aussage.key).toBe('financeQuestions.answer.steuerOhneModus');
    expect(antwort.deepLink).toBe('/settings');
  });
});

describe('steuer.ruecklage', () => {
  const eintrag = questionCatalog.byId('steuer.ruecklage')!;

  it('sollte die LÜCKE nennen, nicht das Ziel', () => {
    // Gefragt ist „wie viel muss ich noch zurücklegen".
    const antwort = eintrag.antwort(
      {},
      daten({
        settings: { business_mode: true, tax_reserve_percent: 30 } as never,
        taxReserve: { movements: [{ id: 'm1', amount: 500, date: '2026-05-01' }] } as never,
      }),
    );
    // 30 % von 5000 = 1500 Ziel, 500 zurückgelegt → 1000 Lücke.
    expect(antwort.wert).toBe(1000);
    expect(antwort.begruendung?.[0]?.params.betrag).toBe(1500);
    expect(antwort.begruendung?.[1]?.params.betrag).toBe(500);
  });

  it('sollte einen Jahres-Override der allgemeinen Einstellung vorziehen', () => {
    // Genau dafür gibt es ihn — sonst wäre er ein toter Schalter.
    const antwort = eintrag.antwort(
      {},
      daten({
        settings: { business_mode: true, tax_reserve_percent: 30 } as never,
        taxReserve: { movements: [], percent_override: 10 } as never,
      }),
    );
    expect(antwort.wert).toBe(500);
  });

  it('sollte eine erfüllte Rücklage als erfüllt benennen, nicht als „0 € offen"', () => {
    const antwort = eintrag.antwort(
      {},
      daten({
        settings: { business_mode: true, tax_reserve_percent: 30 } as never,
        taxReserve: { movements: [{ id: 'm1', amount: 2000, date: '2026-05-01' }] } as never,
      }),
    );
    expect(antwort.aussage.key).toBe('financeQuestions.answer.steuerRuecklageVoll');
  });

  it('sollte ohne Betriebseinnahmen kein Ziel behaupten', () => {
    const antwort = eintrag.antwort({}, daten({ transactions: [tx(-900, '2026-04-01')] }));
    expect(antwort.art).toBe('keine');
    expect(antwort.aussage.key).toBe('financeQuestions.answer.steuerOhneEinnahmen');
  });
});
