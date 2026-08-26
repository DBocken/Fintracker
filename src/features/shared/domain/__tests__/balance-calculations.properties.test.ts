import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { Account, Transaction } from '@/types';
import { computeAnchoredBalance, computeEffectiveBalances } from '../balance-calculations';

/**
 * Eigenschaften statt Beispiele.
 *
 * Der Saldo-Fehler (#328) hatte 15 gründliche Beispieltests neben sich, alle
 * grün. Keiner konnte ihn fangen: Sie prüften die Fälle, die sich jemand
 * vorgestellt hat, und der Fall „Historie wird NACH dem Startsaldo
 * nachimportiert" war nicht darunter.
 *
 * Eine Eigenschaft fragt anders — nicht „stimmt dieses Ergebnis?", sondern
 * „welche Aussage gilt für JEDE Eingabe?". Die erste Eigenschaft hier ist der
 * Fehler in einem Satz; sie wäre ab dem ersten Tag rot gewesen, ohne dass
 * irgendwer den Fall hätte erfinden müssen.
 *
 * Bezug: `docs/domain-invariants.md` Invariante 1 („Eine Originalbuchung
 * beeinflusst einen Kontostand genau einmal") — die Invariante, die verletzt
 * war und für die es im Wortlaut keinen Test gab.
 */

/** Kalendertage rund um den Anker, als ISO-Datum. */
const dayArb = fc
  .integer({ min: -400, max: 400 })
  .map((offset) => new Date(Date.UTC(2026, 5, 30) + offset * 86_400_000).toISOString().slice(0, 10));

const amountArb = fc.integer({ min: -500_000, max: 500_000 }).map((cents) => cents / 100);

const txArb = (accountId: string) =>
  fc.record({ date: dayArb, amount: amountArb }).map(
    ({ date, amount }): Transaction => ({
      account_id: accountId,
      date,
      amount,
      payee: '',
      description: '',
      original_text: '',
      auto_mapped: false,
      confirmed: true,
    }),
  );

function anchoredAccount(openingBalance: number, openingDate: string): Account {
  return {
    id: 'acc-1',
    user_id: 'user-1',
    name: 'Girokonto',
    type: 'checking' as Account['type'],
    currency: 'EUR',
    color: '#000',
    icon: 'bank',
    is_budget_pool_member: true,
    order_index: 0,
    opening_balance: openingBalance,
    opening_balance_date: openingDate,
    live_balance_amount: null,
  };
}

const ANCHOR_DAY = '2026-06-30';
const cents = (value: number) => Math.round(value * 100);

describe('Saldo-Eigenschaften', () => {
  it('[REGRESSION] eine Buchung VOR dem Stichtag ändert den Saldo nicht — für jede Eingabe', () => {
    fc.assert(
      fc.property(
        fc.array(txArb('acc-1'), { maxLength: 30 }),
        amountArb,
        fc.integer({ min: 1, max: 400 }),
        amountArb,
        (txs, opening, daysBefore, extraAmount) => {
          const account = anchoredAccount(opening, ANCHOR_DAY);
          const before: Transaction = {
            ...txs[0],
            account_id: 'acc-1',
            date: new Date(Date.UTC(2026, 5, 30) - daysBefore * 86_400_000).toISOString().slice(0, 10),
            amount: extraAmount,
            payee: '',
            description: '',
            original_text: '',
            auto_mapped: false,
            confirmed: true,
          };
          const ohne = computeAnchoredBalance(account, txs);
          const mit = computeAnchoredBalance(account, [...txs, before]);
          expect(cents(mit)).toBe(cents(ohne));
        },
      ),
      { numRuns: 300 },
    );
  });

  it('eine Buchung NACH dem Stichtag verschiebt den Saldo um genau ihren Betrag', () => {
    fc.assert(
      fc.property(
        fc.array(txArb('acc-1'), { maxLength: 30 }),
        amountArb,
        fc.integer({ min: 1, max: 400 }),
        amountArb,
        (txs, opening, daysAfter, extraAmount) => {
          const account = anchoredAccount(opening, ANCHOR_DAY);
          const after: Transaction = {
            account_id: 'acc-1',
            date: new Date(Date.UTC(2026, 5, 30) + daysAfter * 86_400_000).toISOString().slice(0, 10),
            amount: extraAmount,
            payee: '',
            description: '',
            original_text: '',
            auto_mapped: false,
            confirmed: true,
          };
          const ohne = computeAnchoredBalance(account, txs);
          const mit = computeAnchoredBalance(account, [...txs, after]);
          expect(cents(mit)).toBe(cents(ohne) + cents(extraAmount));
        },
      ),
      { numRuns: 300 },
    );
  });

  it('der Saldo hängt nicht von der Reihenfolge der Buchungen ab', () => {
    fc.assert(
      fc.property(
        fc.array(txArb('acc-1'), { maxLength: 40 }),
        amountArb,
        (txs, opening) => {
          const account = anchoredAccount(opening, ANCHOR_DAY);
          const gedreht = [...txs].reverse();
          expect(cents(computeAnchoredBalance(account, gedreht))).toBe(
            cents(computeAnchoredBalance(account, txs)),
          );
        },
      ),
      { numRuns: 200 },
    );
  });

  it('[REGRESSION] Invariante 1: dieselbe Buchung zweimal in der Liste wirkt genau einmal mehr', () => {
    fc.assert(
      fc.property(
        fc.array(txArb('acc-1'), { minLength: 1, maxLength: 30 }),
        amountArb,
        (txs, opening) => {
          const account = anchoredAccount(opening, ANCHOR_DAY);
          const einmal = computeAnchoredBalance(account, txs);
          const zweimal = computeAnchoredBalance(account, [...txs, txs[0]]);
          const zaehltMit = txs[0].date > ANCHOR_DAY;
          expect(cents(zweimal)).toBe(cents(einmal) + (zaehltMit ? cents(txs[0].amount) : 0));
        },
      ),
      { numRuns: 300 },
    );
  });

  it('Buchungen fremder Konten wirken auf den Saldo nie', () => {
    fc.assert(
      fc.property(
        fc.array(txArb('acc-1'), { maxLength: 20 }),
        fc.array(txArb('fremd'), { maxLength: 20 }),
        amountArb,
        (eigene, fremde, opening) => {
          const account = anchoredAccount(opening, ANCHOR_DAY);
          expect(cents(computeAnchoredBalance(account, [...eigene, ...fremde]))).toBe(
            cents(computeAnchoredBalance(account, eigene)),
          );
        },
      ),
      { numRuns: 200 },
    );
  });

  it('computeEffectiveBalances stimmt je Konto mit computeAnchoredBalance überein', () => {
    fc.assert(
      fc.property(
        fc.array(txArb('acc-1'), { maxLength: 25 }),
        amountArb,
        (txs, opening) => {
          const account = anchoredAccount(opening, ANCHOR_DAY);
          expect(cents(computeEffectiveBalances([account], txs)['acc-1'].amount)).toBe(
            cents(computeAnchoredBalance(account, txs)),
          );
        },
      ),
      { numRuns: 200 },
    );
  });
});
