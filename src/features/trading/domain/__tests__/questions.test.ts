import { describe, expect, it } from 'vitest';
import { questionCatalog } from '@/features/money-questions/data/question-catalog';
import type { QuestionData } from '@/lib/question-registry';
import type { Portfolio, PortfolioPosition } from '@/types';

/**
 * Depot-Einträge (Welle 2).
 *
 * Der Prüfpunkt, der über die Arithmetik hinausgeht: **Fremdwährung wird
 * ausgewiesen, nie summiert** (VE-1, `docs/architecture/currency-eur-only.md`).
 * Es gibt keine Kursquelle; 1:1 addiert wären es beim damaligen EUR/USD-Kurs
 * rund 8 % Fehler — lautlos. Eine Summe, die ihre Lücke verschweigt, ist
 * schlimmer als eine, die sie nennt.
 */

const DEPOT = { id: 'p1', name: 'Mein Depot', currency: 'EUR' } as Portfolio;

function pos(over: Partial<PortfolioPosition>): PortfolioPosition {
  return {
    id: over.id ?? 'x',
    portfolio_id: 'p1',
    symbol: 'SAP',
    name: 'SAP SE',
    quantity: 10,
    entry_price: 100,
    currency: 'EUR',
    ...over,
  } as PortfolioPosition;
}

function daten(positionen: PortfolioPosition[]): QuestionData {
  return {
    portfolios: [DEPOT],
    positionsByPortfolio: new Map([['p1', positionen]]),
    jetzt: new Date('2026-08-20T12:00:00Z'),
  };
}

describe('depot.wert', () => {
  const eintrag = questionCatalog.byId('depot.wert')!;

  it('sollte den Marktwert der Positionen nennen', () => {
    const antwort = eintrag.antwort({}, daten([pos({ id: 'a', quantity: 10, last_price: 120 })]));
    expect(antwort.wert).toBe(1200);
    expect(antwort.anzahl).toBe(1);
  });

  it('sollte ohne Kurs den EINSTANDSKURS nehmen statt die Position zu verlieren', () => {
    expect(eintrag.antwort({}, daten([pos({ id: 'a', entry_price: 100 })])).wert).toBe(1000);
  });

  it('[REGRESSION] sollte Fremdwährung NICHT mitsummieren, aber benennen', () => {
    const antwort = eintrag.antwort(
      {},
      daten([
        pos({ id: 'a', quantity: 10, last_price: 120 }),
        pos({ id: 'b', quantity: 5, last_price: 200, currency: 'USD' }),
      ]),
    );
    expect(antwort.wert).toBe(1200); // die 1000 USD sind NICHT addiert
    expect(antwort.begruendung?.[0]?.key).toBe('financeQuestions.reason.fremdwaehrungNichtSummiert');
    expect(antwort.begruendung?.[0]?.params.anzahl).toBe(1);
  });

  it('sollte ohne Depot „keines" sagen statt 0 €', () => {
    const antwort = eintrag.antwort({}, { portfolios: [], jetzt: new Date() });
    expect(antwort.art).toBe('keine');
    expect(antwort.wert).toBeNull();
  });
});

describe('depot.rendite', () => {
  const eintrag = questionCatalog.byId('depot.rendite')!;

  it('sollte Gewinn samt eingesetztem Kapital und Prozentsatz belegen', () => {
    const antwort = eintrag.antwort({}, daten([pos({ id: 'a', quantity: 10, entry_price: 100, last_price: 120 })]));
    expect(antwort.wert).toBe(200);
    expect(antwort.aussage.key).toBe('financeQuestions.answer.depotGewinn');
    expect(antwort.begruendung?.[0]?.params.betrag).toBe(1000);
    expect(antwort.begruendung?.[1]?.params.prozent).toBeCloseTo(20);
  });

  it('sollte einen Verlust als Verlust benennen, nicht als „Gewinn von −200"', () => {
    const antwort = eintrag.antwort({}, daten([pos({ id: 'a', quantity: 10, entry_price: 100, last_price: 80 })]));
    expect(antwort.wert).toBe(-200);
    expect(antwort.aussage.key).toBe('financeQuestions.answer.depotVerlust');
  });

  it('sollte ohne eingesetztes Kapital keine Rendite behaupten', () => {
    // 0 % wäre eine Aussage über eine Rendite, die es nicht gibt.
    const antwort = eintrag.antwort({}, daten([pos({ id: 'a', quantity: 0, entry_price: 0 })]));
    expect(antwort.art).toBe('keine');
  });
});

describe('depot.positionen', () => {
  const eintrag = questionCatalog.byId('depot.positionen')!;

  it('sollte nach Marktwert absteigend sortieren', () => {
    const antwort = eintrag.antwort(
      {},
      daten([
        pos({ id: 'a', name: 'Klein', quantity: 1, last_price: 50 }),
        pos({ id: 'b', name: 'Groß', quantity: 10, last_price: 300 }),
      ]),
    );
    expect(antwort.posten?.map((p) => p.label)).toEqual(['Groß', 'Klein']);
  });

  it('sollte Fremdwährungs-Positionen aus der Rangfolge heraushalten', () => {
    // Eine Liste, die Äpfel neben Birnen sortiert, behauptet eine Rangfolge,
    // die es nicht gibt: 1000 USD stünden über 900 € — ohne dass irgendwer
    // weiß, ob das stimmt.
    const antwort = eintrag.antwort(
      {},
      daten([
        pos({ id: 'a', name: 'Euro-Titel', quantity: 9, last_price: 100 }),
        pos({ id: 'b', name: 'Dollar-Titel', quantity: 10, last_price: 100, currency: 'USD' }),
      ]),
    );
    expect(antwort.posten?.map((p) => p.label)).toEqual(['Euro-Titel']);
    expect(antwort.begruendung?.[0]?.key).toBe('financeQuestions.reason.fremdwaehrungNichtSummiert');
  });
});
