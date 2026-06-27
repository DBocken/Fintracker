import { describe, expect, it } from 'vitest';
import type { Category, Transaction } from '@/types';
import type { BudgetStatus } from '@/types';
import type { WaterfallPlan } from '../waterfall-service';
import {
  assertSyncConsent,
  buildMcpAggregateSnapshot,
  generateAccessToken,
  hashAccessToken,
  hasValidConsent,
  MCP_CONFIRM_PHRASE,
  type SnapshotInput,
} from '../cloud-mcp-sync-service';

function tx(partial: Partial<Transaction>): Transaction {
  return {
    date: '2026-06-10',
    amount: -10,
    payee: 'TEST',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: true,
    ...partial,
  };
}

const categories: Category[] = [
  { id: 'food', name: 'Lebensmittel', filters: [] },
  { id: 'rent', name: 'Wohnen', filters: [] },
];

function baseInput(overrides: Partial<SnapshotInput> = {}): SnapshotInput {
  return {
    transactions: [],
    categories,
    budgetStatuses: [],
    waterfall: null,
    months: ['2026-06', '2026-05', '2026-04'],
    baseCurrency: 'EUR',
    now: '2026-06-27T10:00:00.000Z',
    ...overrides,
  };
}

describe('cloud-mcp-sync-service', () => {
  describe('Normal Behavior – buildMcpAggregateSnapshot', () => {
    it('sollte Ausgaben pro Kategorie und Monat summieren', () => {
      const snap = buildMcpAggregateSnapshot(
        baseInput({
          transactions: [
            tx({ amount: -30, category_id: 'food', date: '2026-06-02' }),
            tx({ amount: -20, category_id: 'food', date: '2026-06-15' }),
            tx({ amount: -800, category_id: 'rent', date: '2026-06-01' }),
          ],
        }),
      );

      const june = snap.monthly_spending.find((m) => m.month === '2026-06')!;
      expect(june.total).toBe(850);
      expect(june.by_category[0]).toMatchObject({ category_id: 'rent', name: 'Wohnen', amount: 800 });
      expect(june.by_category.find((c) => c.category_id === 'food')!.amount).toBe(50);
    });

    it('sollte Budget-Status auf Aggregate reduzieren', () => {
      const status = {
        budget: { name: 'Lebensmittel' },
        spent: 123.456,
        remaining: -23.4,
        ratio: 1.2345678,
        health: 'over',
      } as unknown as BudgetStatus;

      const snap = buildMcpAggregateSnapshot(baseInput({ budgetStatuses: [status] }));
      expect(snap.budget_status[0]).toEqual({
        name: 'Lebensmittel',
        spent: 123.46,
        remaining: -23.4,
        ratio: 1.2346,
        health: 'over',
      });
    });

    it('sollte Cashflow aus dem Wasserfall-Plan ableiten', () => {
      const waterfall = {
        income: 3000,
        surplus: 400,
        monthsAnalyzed: 6,
        steps: [
          { key: 'savings', allocated: 300 },
          { key: 'essentials', allocated: 1800 },
          { key: 'discretionary', allocated: 500 },
        ],
      } as unknown as WaterfallPlan;

      const snap = buildMcpAggregateSnapshot(baseInput({ waterfall }));
      expect(snap.cashflow).toEqual({
        month: '2026-06',
        expected_income: 3000,
        expected_expenses: 2300,
        expected_savings: 300,
        projected_end_balance: 400,
        months_analyzed: 6,
      });
    });
  });

  describe('Edge Cases', () => {
    it('sollte Transfers ausschließen', () => {
      const snap = buildMcpAggregateSnapshot(
        baseInput({
          transactions: [
            tx({ amount: -500, category_id: 'rent', is_transfer: true, date: '2026-06-01' }),
            tx({ amount: -50, category_id: 'food', date: '2026-06-01' }),
          ],
        }),
      );
      expect(snap.monthly_spending.find((m) => m.month === '2026-06')!.total).toBe(50);
    });

    it('sollte unbestätigte Transaktionen und Einnahmen ignorieren', () => {
      const snap = buildMcpAggregateSnapshot(
        baseInput({
          transactions: [
            tx({ amount: -40, category_id: 'food', confirmed: false, date: '2026-06-01' }),
            tx({ amount: 2000, category_id: 'food', date: '2026-06-01' }), // Einnahme
            tx({ amount: -10, category_id: 'food', date: '2026-06-01' }),
          ],
        }),
      );
      expect(snap.monthly_spending.find((m) => m.month === '2026-06')!.total).toBe(10);
    });

    it('sollte ohne Daten leere, aber gültige Aggregate liefern', () => {
      const snap = buildMcpAggregateSnapshot(baseInput());
      expect(snap.cashflow).toBeNull();
      expect(snap.unusual_expenses).toEqual([]);
      expect(snap.monthly_spending.every((m) => m.total === 0)).toBe(true);
    });

    it('sollte unkategorisierte Ausgaben als "Unkategorisiert" führen', () => {
      const snap = buildMcpAggregateSnapshot(
        baseInput({ transactions: [tx({ amount: -15, category_id: null, date: '2026-06-01' })] }),
      );
      expect(snap.monthly_spending.find((m) => m.month === '2026-06')!.by_category[0].name).toBe(
        'Unkategorisiert',
      );
    });

    it('sollte Ausreißer gegen den Kategorie-Median erkennen', () => {
      const snap = buildMcpAggregateSnapshot(
        baseInput({
          transactions: [
            tx({ amount: -100, category_id: 'food', date: '2026-04-01' }),
            tx({ amount: -100, category_id: 'food', date: '2026-05-01' }),
            tx({ amount: -400, category_id: 'food', date: '2026-06-01' }),
          ],
        }),
      );
      const unusual = snap.unusual_expenses.find((u) => u.month === '2026-06');
      expect(unusual).toBeDefined();
      expect(unusual!.category).toBe('Lebensmittel');
      expect(unusual!.amount).toBe(400);
      expect(unusual!.median).toBe(100);
    });
  });

  describe('[PRIVACY] keine Rohdaten im Snapshot', () => {
    it('sollte niemals payee, IBAN oder original_text enthalten', () => {
      const snap = buildMcpAggregateSnapshot(
        baseInput({
          transactions: [
            tx({
              amount: -42,
              category_id: 'food',
              date: '2026-06-01',
              payee: 'REWE-GEHEIM-MARKER',
              original_text: 'ORIGINALTEXT-GEHEIM',
              counterparty_iban: 'DE00GEHEIMIBAN',
              description: 'BESCHREIBUNG-GEHEIM',
            }),
          ],
        }),
      );
      const serialized = JSON.stringify(snap);
      expect(serialized).not.toContain('GEHEIM');
      expect(serialized).not.toContain('IBAN');
    });
  });

  describe('Consent-Gate (doppelte Bestätigung)', () => {
    it('sollte ohne Risiko-Bestätigung (Stufe 1) abbrechen', () => {
      expect(() =>
        assertSyncConsent({ acknowledgedRisk: false, confirmPhrase: MCP_CONFIRM_PHRASE }),
      ).toThrow(/Stufe 1/);
    });

    it('sollte bei falscher Phrase (Stufe 2) abbrechen', () => {
      expect(() => assertSyncConsent({ acknowledgedRisk: true, confirmPhrase: 'falsch' })).toThrow(
        /Stufe 2/,
      );
    });

    it('sollte Phrase robust normalisieren (Case/Whitespace)', () => {
      expect(
        hasValidConsent({ acknowledgedRisk: true, confirmPhrase: '  Daten VERLASSEN   mein Gerät ' }),
      ).toBe(true);
    });
  });

  describe('Access-Token', () => {
    it('sollte ein 64-stelliges Hex-Token erzeugen', () => {
      expect(generateAccessToken()).toMatch(/^[0-9a-f]{64}$/);
    });

    it('sollte Tokens stabil und kollisionsarm hashen', async () => {
      const a = await hashAccessToken('token-a');
      expect(a).toBe(await hashAccessToken('token-a'));
      expect(a).not.toBe(await hashAccessToken('token-b'));
      expect(a).toMatch(/^[0-9a-f]{64}$/);
    });
  });
});
