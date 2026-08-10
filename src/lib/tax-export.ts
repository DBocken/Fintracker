/**
 * Baut die Steuer-CSV für die Steuererklärung / den Steuerberater. Rein und
 * testbar: die Übersetzungsfunktion wird als Parameter übergeben (keine
 * React-/Locale-Abhängigkeit). Gruppiert nach Anlage/Rubrik, deutsche Spalten,
 * Semikolon-getrennt, CSV-Injection-gehärtet (F-MONEY-2).
 */
import type { Transaction } from '@/types';
import { asTransactionId } from '@/lib/ids';
import type { TaxYearReport } from './tax-report';
import { escapeCsvCell } from './csv-utils';

type Translate = (key: string, fallback?: string) => string;

function amountCell(n: number): string {
  // Deutsches Dezimalkomma, damit Excel den Betrag numerisch liest.
  return n.toFixed(2).replace('.', ',');
}

export function buildTaxCsv(
  report: TaxYearReport,
  transactions: Transaction[],
  translate: Translate,
): string {
  const byId = new Map(transactions.map((tx) => [tx.id, tx]));

  const headers = [
    translate('tax.export.colAnlage', 'Anlage'),
    translate('tax.export.colRubrik', 'Rubrik'),
    translate('tax.export.colDate', 'Datum'),
    translate('tax.export.colPayee', 'Empfänger'),
    translate('tax.export.colDescription', 'Verwendungszweck'),
    translate('tax.export.colAmount', 'Betrag'),
    translate('tax.export.colLaborCosts', 'davon Arbeitskosten'),
    translate('tax.export.colNote', 'Notiz'),
  ];

  const rows: string[] = [];
  // Reihenfolge folgt den Rubriken im Report (nach Anlage gruppiert).
  for (const rubric of report.rubrics) {
    const anlageLabel = translate(`tax.anlage.${rubric.anlage}`, rubric.anlage);
    const rubricLabel = translate(`tax.rubric.${rubricKeySegment(rubric.rubricId)}.name`, rubric.rubricId);
    for (const txId of rubric.transactionIds) {
      const tx = byId.get(asTransactionId(txId));
      if (!tx) continue;
      rows.push(
        [
          escapeCsvCell(anlageLabel),
          escapeCsvCell(rubricLabel),
          escapeCsvCell(tx.date),
          escapeCsvCell(tx.payee),
          escapeCsvCell(tx.description),
          escapeCsvCell(amountCell(tx.amount)),
          escapeCsvCell(tx.tax_labor_costs != null ? amountCell(tx.tax_labor_costs) : ''),
          escapeCsvCell(tx.tax_note ?? ''),
        ].join(';'),
      );
    }
  }

  return [headers.map(escapeCsvCell).join(';'), ...rows].join('\n');
}

/** Wandelt die Rubrik-ID in das i18n-Key-Segment (z. B. `35a-handwerker` → `35aHandwerker`). */
function rubricKeySegment(rubricId: string): string {
  const map: Record<string, string> = {
    '35a-minijob': '35aMinijob',
    '35a-dienstleistungen': '35aDienstleistungen',
    '35a-handwerker': '35aHandwerker',
    '35c-sanierung': '35cSanierung',
    werbungskosten: 'werbungskosten',
    sonderausgaben: 'sonderausgaben',
    agb: 'agb',
    vermietung: 'vermietung',
    betriebsausgaben: 'betriebsausgaben',
  };
  return map[rubricId] ?? rubricId;
}

/** Sinnvoller Dateiname für den Download. */
export function taxCsvFilename(year: number): string {
  return `steuer-${year}.csv`;
}
