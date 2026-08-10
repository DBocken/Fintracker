import { describe, it, expect } from 'vitest';
import { buildTaxCsv, taxCsvFilename } from '../tax-export';
import { buildTaxYearReport } from '../tax-report';
import type { Transaction } from '@/types';
import { asTransactionId } from '@/lib/ids';

// Einfache Übersetzungsfunktion für den Test (gibt den Fallback zurück).
const translate = (_key: string, fallback?: string) => fallback ?? _key;

let seq = 0;
function tx(overrides: Omit<Partial<Transaction>, 'id'> & { id?: string }): Transaction {
  seq += 1;
  return {
    date: '2025-05-10',
    amount: -1800,
    payee: 'Malerbetrieb Müller',
    description: 'Renovierung',
    original_text: '',
    auto_mapped: false,
    confirmed: true,
    ...overrides,
    id: asTransactionId(overrides.id || `tx-${seq}`),
  };
}

describe('buildTaxCsv', () => {
  describe('Struktur', () => {
    it('sollte deutsche Header, Semikolon und eine Datenzeile erzeugen', () => {
      const txs = [tx({ tax_category_id: 'tax-35a3-handwerker', tax_labor_costs: 1200, tax_note: 'RG 1' })];
      const report = buildTaxYearReport(txs, 2025, null);
      const csv = buildTaxCsv(report, txs, translate);
      const lines = csv.split('\n');
      expect(lines[0]).toBe('Anlage;Rubrik;Datum;Empfänger;Verwendungszweck;Betrag;davon Arbeitskosten;Notiz');
      const dataLine = lines.find((l) => l.includes('Malerbetrieb'))!;
      // translate() liefert hier die Fallbacks (Anlage-/Rubrik-ID).
      expect(dataLine).toContain('35a-handwerker');
      expect(dataLine).toContain('-1800,00');
      expect(dataLine).toContain('1200,00');
      expect(dataLine).toContain('RG 1');
    });

    it('sollte Beträge mit deutschem Dezimalkomma numerisch (unquoted) schreiben', () => {
      const txs = [tx({ amount: -12.34, tax_category_id: 'tax-agb-krankheit' })];
      const report = buildTaxYearReport(txs, 2025, null);
      const csv = buildTaxCsv(report, txs, translate);
      // Der Betrag darf nicht als Text gequotet oder mit ' präfigiert werden.
      expect(csv).toContain('-12,34');
      expect(csv).not.toContain("'-12,34");
      expect(csv).not.toContain('"-12,34"');
    });
  });

  describe('Regression Protection', () => {
    it('[REGRESSION] sollte Formel-Injection im Empfänger neutralisieren', () => {
      const txs = [tx({ payee: '=CMD()|calc', tax_category_id: 'tax-agb-krankheit' })];
      const report = buildTaxYearReport(txs, 2025, null);
      const csv = buildTaxCsv(report, txs, translate);
      // Der Payee beginnt mit '=' → wird mit ' entschärft; Pipe/Quote → Quoting.
      expect(csv).toContain("'=CMD()|calc");
    });

    it('[REGRESSION] sollte eingebettete Semikolons im Verwendungszweck quoten', () => {
      const txs = [tx({ description: 'Shop;=CMD()', tax_category_id: 'tax-agb-krankheit' })];
      const report = buildTaxYearReport(txs, 2025, null);
      const csv = buildTaxCsv(report, txs, translate);
      expect(csv).toContain('"Shop;=CMD()"');
    });
  });

  it('taxCsvFilename sollte das Jahr enthalten', () => {
    expect(taxCsvFilename(2025)).toBe('steuer-2025.csv');
  });
});
