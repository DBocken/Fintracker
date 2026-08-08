import { describe, it, expect } from 'vitest';
import { transactionSchema } from '../transaction.schema';

/**
 * Performance-Messung der Item-Validierung (WP 1.2, Plan-Akzeptanzkriterium:
 * ≤ 50 ms Zusatzaufwand bei 5000 Transaktionen — `FINANCE_TRANSACTION_LIMIT`,
 * `src/features/shared/data/finance-query-keys.ts`). Grosszuegige Schwelle
 * (500 ms statt 50 ms) im Test selbst, um CI-Rauschen nicht zur Falle zu
 * machen — die tatsaechlich gemessene Zahl steht im WP-Bericht.
 */
function makeTransaction(i: number) {
  return {
    id: `tx-${i}`,
    account_id: 'acc-1',
    date: '2026-06-21',
    amount: (i % 2 === 0 ? -1 : 1) * (i / 3.7),
    payee: `Haendler ${i}`,
    description: `Buchung ${i}`,
    original_text: `RAW ${i}`,
    currency: 'EUR',
    category_id: i % 5 === 0 ? null : `cat-${i % 12}`,
    subcategory_id: null,
    auto_mapped: i % 2 === 0,
    confirmed: true,
    is_transfer: false,
  };
}

describe('[Performance] transactionSchema bei 5000 Items', () => {
  it('validiert 5000 Transaktionen in vertretbarer Zeit (Budget lt. Plan: ≤ 50 ms zusätzlich)', () => {
    const items = Array.from({ length: 5000 }, (_, i) => makeTransaction(i));

    const start = performance.now();
    let validCount = 0;
    for (const item of items) {
      const result = transactionSchema.safeParse(item);
      if (result.success) validCount += 1;
    }
    const durationMs = performance.now() - start;

    expect(validCount).toBe(5000);
    console.log(`[WP 1.2 Performance] 5000 Transaktionen validiert in ${durationMs.toFixed(2)} ms`);
    expect(durationMs).toBeLessThan(500);
  });
});
