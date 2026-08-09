import { describe, it, expect } from 'vitest';
import { buildEuerReport, isBusinessIncomeTx } from '../euer-report';
import type { Account, Transaction } from '@/types';
import { asTransactionId } from '@/lib/ids';

let seq = 0;
function tx(overrides: Omit<Partial<Transaction>, 'id'> & { id?: string }): Transaction {
  seq += 1;
  return {
    account_id: 'biz',
    date: '2025-05-10',
    amount: -100,
    payee: 'X',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: true,
    ...overrides,
    id: asTransactionId(overrides.id || `tx-${seq}`),
  };
}

function account(id: string, isBusiness: boolean): Account {
  return {
    id,
    user_id: 'local',
    name: id,
    type: 'checking',
    currency: 'EUR',
    color: '#111',
    icon: '🏦',
    is_budget_pool_member: true,
    is_business: isBusiness,
    order_index: 0,
  };
}

const ACCOUNTS = [account('biz', true), account('priv', false)];

function line(report: ReturnType<typeof buildEuerReport>, side: 'einnahmen' | 'ausgaben', key: string) {
  return report[side].lines.find((l) => l.key === key);
}

describe('buildEuerReport (EÜR-Kern)', () => {
  describe('Klassifikationsmatrix (D1)', () => {
    it('sollte EÜR-markierte Ausgaben auf JEDEM Konto zählen (auch privat)', () => {
      const report = buildEuerReport(
        [tx({ account_id: 'priv', amount: -250, tax_category_id: 'tax-eur-wareneinkauf' })],
        ACCOUNTS,
        2025,
      );
      expect(line(report, 'ausgaben', 'tax-eur-wareneinkauf')?.gross).toBe(250);
      expect(report.ausgaben.grossTotal).toBe(250);
    });

    it('sollte EÜR-markierte Einnahmen zählen', () => {
      const report = buildEuerReport(
        [tx({ account_id: 'priv', amount: 3000, tax_category_id: 'tax-eur-betriebseinnahme' })],
        ACCOUNTS,
        2025,
      );
      expect(line(report, 'einnahmen', 'tax-eur-betriebseinnahme')?.net).toBe(3000);
      expect(report.einnahmen.total).toBe(3000);
    });

    it('sollte unmarkierte Einnahmen auf dem Geschäftskonto nach Hauptkategorie gruppieren', () => {
      const report = buildEuerReport(
        [tx({ amount: 1200, category_id: 'local-cat-nebenerwerb' })],
        ACCOUNTS,
        2025,
      );
      expect(line(report, 'einnahmen', 'cat:local-cat-nebenerwerb')?.net).toBe(1200);
      expect(report.einnahmen.total).toBe(1200);
    });

    it('sollte unmarkierte Ausgaben auf dem Geschäftskonto in „Sonstige" sammeln und warnen', () => {
      const report = buildEuerReport([tx({ id: 'ua-1', amount: -80 })], ACCOUNTS, 2025);
      expect(line(report, 'ausgaben', 'tax-eur-betriebsausgabe')?.gross).toBe(80);
      expect(report.unassignedExpenseTxIds).toEqual(['ua-1']);
      expect(report.warnings.some((w) => w.kind === 'unassignedExpenses' && w.count === 1)).toBe(true);
    });

    it('sollte euer_private=true ausschließen (gewinnt gegen Geschäftskonto)', () => {
      const report = buildEuerReport([tx({ amount: -80, euer_private: true })], ACCOUNTS, 2025);
      expect(report.ausgaben.grossTotal).toBe(0);
      expect(report.unassignedExpenseTxIds).toEqual([]);
    });

    it('sollte bei euer_private + EÜR-Markierung ausschließen UND markingConflict warnen', () => {
      const report = buildEuerReport(
        [tx({ amount: -80, euer_private: true, tax_category_id: 'tax-eur-wareneinkauf' })],
        ACCOUNTS,
        2025,
      );
      expect(report.ausgaben.grossTotal).toBe(0);
      expect(report.warnings.some((w) => w.kind === 'markingConflict' && w.count === 1)).toBe(true);
    });

    it('sollte Nicht-EÜR-Steuermarkierungen (z. B. §35a) als privat behandeln — keine Doppelverwertung', () => {
      const report = buildEuerReport(
        [tx({ amount: -1800, tax_category_id: 'tax-35a3-handwerker', tax_labor_costs: 1200 })],
        ACCOUNTS,
        2025,
      );
      expect(report.ausgaben.grossTotal).toBe(0);
      expect(report.unassignedExpenseTxIds).toEqual([]);
    });

    it('sollte private, unmarkierte Buchungen ignorieren', () => {
      const report = buildEuerReport(
        [tx({ account_id: 'priv', amount: -50 }), tx({ account_id: 'priv', amount: 500 })],
        ACCOUNTS,
        2025,
      );
      expect(report.einnahmen.total).toBe(0);
      expect(report.ausgaben.grossTotal).toBe(0);
    });
  });

  describe('Transfers & Privatentnahme/-einlage', () => {
    it('sollte einen Transfer Geschäft→Privat als Privatentnahme ausweisen (nie gewinnwirksam)', () => {
      const report = buildEuerReport(
        [
          tx({ id: 'out', account_id: 'biz', amount: -400, is_transfer: true, transfer_pair_id: 'in' }),
          tx({ id: 'in', account_id: 'priv', amount: 400, is_transfer: true, transfer_pair_id: 'out' }),
        ],
        ACCOUNTS,
        2025,
      );
      expect(report.privatTransfers.entnahmen).toBe(400);
      expect(report.privatTransfers.einlagen).toBe(0);
      expect(report.gewinn).toBe(0);
      expect(report.ausgaben.grossTotal).toBe(0);
    });

    it('sollte einen Transfer Privat→Geschäft als Privateinlage ausweisen', () => {
      const report = buildEuerReport(
        [
          tx({ id: 'out', account_id: 'priv', amount: -400, is_transfer: true, transfer_pair_id: 'in' }),
          tx({ id: 'in', account_id: 'biz', amount: 400, is_transfer: true, transfer_pair_id: 'out' }),
        ],
        ACCOUNTS,
        2025,
      );
      expect(report.privatTransfers.einlagen).toBe(400);
      expect(report.privatTransfers.entnahmen).toBe(0);
    });

    it('sollte Transfers zwischen zwei Geschäftskonten ignorieren', () => {
      const accounts = [...ACCOUNTS, account('biz2', true)];
      const report = buildEuerReport(
        [
          tx({ id: 'out', account_id: 'biz', amount: -400, is_transfer: true, transfer_pair_id: 'in' }),
          tx({ id: 'in', account_id: 'biz2', amount: 400, is_transfer: true, transfer_pair_id: 'out' }),
        ],
        accounts,
        2025,
      );
      expect(report.privatTransfers.entnahmen).toBe(0);
      expect(report.privatTransfers.einlagen).toBe(0);
    });

    it('[REGRESSION] sollte markierte Transfers NIE gewinnwirksam zählen', () => {
      const report = buildEuerReport(
        [tx({ amount: -400, is_transfer: true, tax_category_id: 'tax-eur-wareneinkauf' })],
        ACCOUNTS,
        2025,
      );
      expect(report.ausgaben.grossTotal).toBe(0);
    });
  });

  describe('Netting (ohne Clamp) & Bewirtung', () => {
    it('sollte Erstattungen derselben Zeile netten', () => {
      const report = buildEuerReport(
        [
          tx({ amount: -500, tax_category_id: 'tax-eur-wareneinkauf' }),
          tx({ amount: 120, tax_category_id: 'tax-eur-wareneinkauf' }),
        ],
        ACCOUNTS,
        2025,
      );
      const l = line(report, 'ausgaben', 'tax-eur-wareneinkauf')!;
      expect(l.gross).toBe(500);
      expect(l.refunds).toBe(120);
      expect(l.net).toBe(380);
    });

    it('[REGRESSION] sollte negative Netto-Zeilen NICHT clampen, sondern warnen', () => {
      const report = buildEuerReport(
        [
          tx({ amount: -100, tax_category_id: 'tax-eur-wareneinkauf' }),
          tx({ amount: 300, tax_category_id: 'tax-eur-wareneinkauf' }),
        ],
        ACCOUNTS,
        2025,
      );
      const l = line(report, 'ausgaben', 'tax-eur-wareneinkauf')!;
      expect(l.net).toBe(-200);
      expect(report.warnings.some((w) => w.kind === 'negativeLine' && w.amount === 200)).toBe(true);
    });

    it('Musterrechnung Bewirtung: 1.000 € netto → 700 € abziehbar (§4 Abs. 5 S. 1 Nr. 2 EStG)', () => {
      const report = buildEuerReport(
        [tx({ amount: -1000, tax_category_id: 'tax-eur-bewirtung' })],
        ACCOUNTS,
        2025,
      );
      const l = line(report, 'ausgaben', 'tax-eur-bewirtung')!;
      expect(l.net).toBe(1000);
      expect(l.deductible).toBe(700);
      expect(report.ausgaben.grossTotal).toBe(1000);
      expect(report.ausgaben.deductibleTotal).toBe(700);
    });

    it('sollte den Gewinn aus Einnahmen − abziehbaren Ausgaben bilden', () => {
      const report = buildEuerReport(
        [
          tx({ amount: 5000, tax_category_id: 'tax-eur-betriebseinnahme' }),
          tx({ amount: -1000, tax_category_id: 'tax-eur-bewirtung' }),
          tx({ amount: -300, tax_category_id: 'tax-eur-wareneinkauf' }),
        ],
        ACCOUNTS,
        2025,
      );
      // 5.000 − (700 + 300) = 4.000
      expect(report.gewinn).toBe(4000);
    });

    it('sollte Erstattungen auf der Einnahmen-Seite netten (Storno/Rückzahlung)', () => {
      const report = buildEuerReport(
        [
          tx({ amount: 2000, tax_category_id: 'tax-eur-betriebseinnahme' }),
          tx({ amount: -500, tax_category_id: 'tax-eur-betriebseinnahme' }),
        ],
        ACCOUNTS,
        2025,
      );
      expect(line(report, 'einnahmen', 'tax-eur-betriebseinnahme')?.net).toBe(1500);
      expect(report.einnahmen.total).toBe(1500);
    });
  });

  describe('Kandidaten (nie Auto-Zählung)', () => {
    it('sollte Selbständigen-Einnahmen auf Privatkonten nur als Kandidaten listen', () => {
      const report = buildEuerReport(
        [tx({ id: 'cand-1', account_id: 'priv', amount: 900, category_id: 'local-cat-nebenerwerb' })],
        ACCOUNTS,
        2025,
      );
      expect(report.candidateIncomeTxIds).toEqual(['cand-1']);
      expect(report.einnahmen.total).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('sollte die Jahresgrenze strikt nach Buchungsdatum ziehen (§11 EStG)', () => {
      const report = buildEuerReport(
        [
          tx({ date: '2025-12-31', amount: 100, tax_category_id: 'tax-eur-betriebseinnahme' }),
          tx({ date: '2026-01-01', amount: 999, tax_category_id: 'tax-eur-betriebseinnahme' }),
        ],
        ACCOUNTS,
        2025,
      );
      expect(report.einnahmen.total).toBe(100);
    });

    it('sollte für unbekannte Jahre paramsNotExact warnen (Bewirtungssatz geklemmt)', () => {
      const report = buildEuerReport(
        [tx({ date: '2030-05-10', amount: -1000, tax_category_id: 'tax-eur-bewirtung' })],
        ACCOUNTS,
        2030,
      );
      expect(report.paramsExact).toBe(false);
      expect(report.warnings.some((w) => w.kind === 'paramsNotExact')).toBe(true);
      expect(line(report, 'ausgaben', 'tax-eur-bewirtung')?.deductible).toBe(700);
    });

    it('sollte ohne Konten/Buchungen einen leeren Report liefern', () => {
      const report = buildEuerReport([], [], 2025);
      expect(report.einnahmen.total).toBe(0);
      expect(report.ausgaben.deductibleTotal).toBe(0);
      expect(report.gewinn).toBe(0);
      expect(report.warnings).toEqual([]);
    });
  });
});

describe('isBusinessIncomeTx (Waterfall-Helper)', () => {
  const bizIds = new Set(['biz']);

  it('sollte EÜR-markierte Einnahmen auf jedem Konto erkennen', () => {
    expect(isBusinessIncomeTx(tx({ account_id: 'priv', amount: 500, tax_category_id: 'tax-eur-betriebseinnahme' }), bizIds)).toBe(true);
  });

  it('sollte unmarkierte Einnahmen auf Geschäftskonten erkennen', () => {
    expect(isBusinessIncomeTx(tx({ account_id: 'biz', amount: 500 }), bizIds)).toBe(true);
  });

  it('sollte Ausgaben, Transfers und euer_private ablehnen', () => {
    expect(isBusinessIncomeTx(tx({ account_id: 'biz', amount: -500 }), bizIds)).toBe(false);
    expect(isBusinessIncomeTx(tx({ account_id: 'biz', amount: 500, is_transfer: true }), bizIds)).toBe(false);
    expect(isBusinessIncomeTx(tx({ account_id: 'biz', amount: 500, euer_private: true }), bizIds)).toBe(false);
  });

  it('sollte private Einnahmen ohne Markierung ablehnen', () => {
    expect(isBusinessIncomeTx(tx({ account_id: 'priv', amount: 500 }), bizIds)).toBe(false);
  });
});
