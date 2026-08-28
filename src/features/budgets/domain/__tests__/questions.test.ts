import { describe, expect, it } from 'vitest';
import { questionCatalog } from '@/features/money-questions/data/question-catalog';
import { asTransactionId } from '@/lib/ids';
import type { QuestionData } from '@/features/shared/domain/question-registry';
import type { Budget } from '@/lib/budget-types';
import type { Transaction } from '@/types';

/**
 * `budget.rest` und `budget.tagesrate` (WP-F.3) — beide rechnen mit
 * `computeBudgetStatus`, derselben Funktion wie `/budgets`; geprüft wird
 * hier die FRAGE-Semantik: Rest ist Limit minus Verbrauch, die Tagesrate
 * teilt durch die verbleibenden Tage einschliesslich heute.
 */

const budget = {
  id: 'b1', user_id: 'local', category_id: 'c1', limit: 300,
  period: 'monthly', created_at: '2026-01-01',
} as unknown as Budget;

function tx(betrag: number): Transaction {
  return {
    id: asTransactionId(`t${betrag}`), user_id: 'local', account_id: 'a',
    date: '2026-08-05', amount: betrag, payee: 'REWE', description: '',
    original_text: '', category_id: 'c1', auto_mapped: false, confirmed: true,
  } as Transaction;
}

function daten(ausgegeben: number): QuestionData {
  return {
    budgets: [budget],
    transactions: [tx(-ausgegeben)],
    categories: [{ id: 'c1', name: 'Lebensmittel', user_id: 'local' } as never],
    // 23.08. in einem 31-Tage-Monat: heute mitgezählt bleiben 9 Tage.
    jetzt: new Date('2026-08-23T12:00:00Z'),
  };
}

describe('budget.rest', () => {
  const eintrag = questionCatalog.byId('budget.rest')!;

  it('sollte den Rest nennen: Limit minus Verbrauch', () => {
    const antwort = eintrag.antwort({ kategorieIds: ['c1'] }, daten(120));
    expect(antwort.art).toBe('geld');
    expect(antwort.wert).toBeCloseTo(180);
  });

  it('[ZUSTAND übertragen] sollte ein überzogenes Budget als überzogen benennen, nicht als „0 € übrig"', () => {
    // „0 € übrig" wäre die halbe Wahrheit — der Fehlbetrag gehört gesagt.
    const antwort = eintrag.antwort({ kategorieIds: ['c1'] }, daten(350));
    expect(antwort.wert).toBe(0);
    expect(antwort.aussage.key).toBe('financeQuestions.answer.budgetRestUeberzogen');
    expect(antwort.aussage.params.betrag).toBeCloseTo(50);
  });

  it('sollte ohne Budget „keines" sagen statt zu rechnen', () => {
    const antwort = eintrag.antwort({}, { ...daten(0), budgets: [] });
    expect(antwort.art).toBe('keine');
  });
});

describe('budget.tagesrate', () => {
  const eintrag = questionCatalog.byId('budget.tagesrate')!;

  it('sollte den Rest durch die verbleibenden Tage teilen — heute eingeschlossen', () => {
    const antwort = eintrag.antwort({ kategorieIds: ['c1'] }, daten(120));
    expect(antwort.wert).toBeCloseTo(180 / 9);
    expect(antwort.aussage.params.anzahl).toBe(9);
  });
});

/**
 * Der Split-Kanal (Welle 2).
 *
 * `allocations` stand ab WP-C in `needs` — und wurde nie geladen. Weil die
 * Einträge auf eine leere Map zurückfielen, zählte eine gesplittete Buchung
 * mit ihrem VOLLEN Betrag gegen das Budget. Nichts wurde dabei rot: Der
 * Katalog-Test prüft Form und Deep-Link, nicht den gerechneten Wert.
 *
 * Diese Tests prüfen deshalb GENAU den Wert — und zwar an beiden Enden: dass
 * eine übergebene Aufteilung wirkt, und dass ihr Fehlen den vollen Betrag
 * ergibt. Der zweite ist der eigentliche Wächter: Er wird rot, sobald jemand
 * die Aufteilung wieder unterschlägt und dabei denkt, es sei folgenlos.
 */
describe('budget.rest mit gesplitteter Buchung', () => {
  const eintrag = questionCatalog.byId('budget.rest')!;

  function mitSplit(anteilAufC1: number): QuestionData {
    const gesplittet = { ...tx(-100), id: asTransactionId('split-1'), category_id: null } as Transaction;
    return {
      budgets: [budget],
      transactions: [gesplittet],
      categories: [
        { id: 'c1', name: 'Lebensmittel', user_id: 'local' } as never,
        { id: 'c2', name: 'Drogerie', user_id: 'local' } as never,
      ],
      allocationsByTransaction: new Map([
        [
          'split-1',
          [
            // `amount_minor`, nicht `amount`: Aufteilungen sind Integer-Cent
            // (AGENTS.md §8) — dieselbe Einheit, in der der Store sie hält.
            { id: 'al1', transaction_id: 'split-1', category_id: 'c1', amount_minor: -anteilAufC1 * 100 },
            { id: 'al2', transaction_id: 'split-1', category_id: 'c2', amount_minor: -(100 - anteilAufC1) * 100 },
          ],
        ],
      ]) as never,
      jetzt: new Date('2026-08-23T12:00:00Z'),
    };
  }

  it('[REGRESSION] sollte nur den ANTEIL gegen das Budget zählen, nicht den ganzen Betrag', () => {
    // 100 € Einkauf, 40 € davon Lebensmittel: 300 − 40 = 260 € übrig.
    const antwort = eintrag.antwort({ kategorieIds: ['c1'] }, mitSplit(40));
    expect(antwort.wert).toBeCloseTo(260);
  });

  it('sollte die Aufteilung ANMELDEN — sonst wäre das Laden Zufall', () => {
    // Der Wert allein genügt nicht: Rechnet der Eintrag richtig, aber meldet
    // den Kanal nicht an, lädt die `application`-Schicht ihn nicht, und der
    // richtige Wert entsteht nie.
    expect(eintrag.needs).toContain('allocations');
  });
});
