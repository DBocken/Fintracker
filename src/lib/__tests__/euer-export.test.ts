import { describe, it, expect } from 'vitest';
import { buildEuerCsv, euerCsvFilename } from '../euer-export';
import { buildEuerReport } from '../euer-report';
import type { Account, Transaction } from '@/types';

const translate = (_key: string, fallback?: string) => fallback ?? _key;

let seq = 0;
function tx(overrides: Partial<Transaction>): Transaction {
  seq += 1;
  return {
    id: overrides.id || `tx-${seq}`,
    account_id: 'biz',
    date: '2025-05-10',
    amount: -100,
    payee: 'X',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: true,
    ...overrides,
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

function csvFor(txs: Transaction[], categoryNames?: Map<string, string>) {
  const report = buildEuerReport(txs, ACCOUNTS, 2025);
  return buildEuerCsv(report, txs, translate, categoryNames);
}

describe('buildEuerCsv', () => {
  describe('Struktur (Anlage-EÜR-orientiert)', () => {
    it('sollte deutsche Header mit Abziehbar-Spalte erzeugen', () => {
      const csv = csvFor([tx({ amount: 500, tax_category_id: 'tax-eur-betriebseinnahme' })]);
      expect(csv.split('\n')[0]).toBe('Bereich;Zeile;Datum;Empfänger;Verwendungszweck;Betrag;Abziehbar;Notiz');
    });

    it('sollte Einnahmen- und Ausgaben-Blöcke mit Summenzeilen schreiben', () => {
      const csv = csvFor([
        tx({ amount: 5000, tax_category_id: 'tax-eur-betriebseinnahme', payee: 'Kunde A' }),
        tx({ amount: -300, tax_category_id: 'tax-eur-wareneinkauf', payee: 'Lieferant B' }),
      ]);
      expect(csv).toContain('Kunde A');
      expect(csv).toContain('Lieferant B');
      expect(csv).toContain('Summe Betriebseinnahmen');
      expect(csv).toContain('5000,00');
      expect(csv).toContain('Summe Betriebsausgaben');
      expect(csv).toContain('Gewinn');
      // 5.000 − 300 = 4.700
      expect(csv).toContain('4700,00');
    });

    it('sollte die Bewirtungs-Zeile mit Netto UND Abziehbar (70 %) ausweisen', () => {
      const csv = csvFor([tx({ amount: -1000, tax_category_id: 'tax-eur-bewirtung' })]);
      const sumLine = csv.split('\n').find((l) => l.startsWith('Summe') && l.includes('700,00'))!;
      expect(sumLine).toBeDefined();
      expect(sumLine).toContain('1000,00');
      expect(sumLine).toContain('700,00');
    });

    it('sollte Privatentnahmen/-einlagen als Info-Block anhängen (nie gewinnwirksam)', () => {
      const csv = csvFor([
        tx({ id: 'out', account_id: 'biz', amount: -400, is_transfer: true, transfer_pair_id: 'in' }),
        tx({ id: 'in', account_id: 'priv', amount: 400, is_transfer: true, transfer_pair_id: 'out' }),
      ]);
      expect(csv).toContain('Privatentnahmen');
      expect(csv).toContain('400,00');
    });

    it('sollte unmarkierte Einnahmen-Zeilen über die Kategorie-Namen beschriften', () => {
      const names = new Map([['local-cat-nebenerwerb', 'Nebenerwerb & Selbstständigkeit']]);
      const csv = csvFor([tx({ amount: 1200, category_id: 'local-cat-nebenerwerb' })], names);
      expect(csv).toContain('Nebenerwerb & Selbstständigkeit');
    });

    it('sollte Beträge mit deutschem Dezimalkomma unquoted schreiben', () => {
      const csv = csvFor([tx({ amount: -12.34, tax_category_id: 'tax-eur-wareneinkauf' })]);
      expect(csv).toContain('-12,34');
      expect(csv).not.toContain("'-12,34");
      expect(csv).not.toContain('"-12,34"');
    });
  });

  describe('Regression Protection', () => {
    it('[REGRESSION] sollte Formel-Injection im Empfänger neutralisieren (F-MONEY-2)', () => {
      const csv = csvFor([tx({ payee: '=CMD()|calc', amount: -50, tax_category_id: 'tax-eur-wareneinkauf' })]);
      expect(csv).toContain("'=CMD()|calc");
    });

    it('[REGRESSION] sollte eingebettete Semikolons quoten', () => {
      const csv = csvFor([tx({ description: 'Shop;=CMD()', amount: -50, tax_category_id: 'tax-eur-wareneinkauf' })]);
      expect(csv).toContain('"Shop;=CMD()"');
    });
  });

  it('euerCsvFilename sollte das Jahr enthalten', () => {
    expect(euerCsvFilename(2025)).toBe('euer-2025.csv');
  });
});
