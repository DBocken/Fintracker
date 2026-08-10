/**
 * EÜR-CSV für die Steuererklärung / den Steuerberater. Rein und testbar (i18n
 * als Parameter, Muster tax-export). Anlage-EÜR-orientiert: Einnahmen-Block,
 * Ausgaben-Block mit Abziehbar-Spalte (Bewirtung 70 %), Summenzeilen, Gewinn,
 * Privatentnahmen/-einlagen als Info-Block. Semikolon-getrennt, deutsches
 * Dezimalkomma, CSV-Injection-gehärtet (F-MONEY-2).
 */
import type { Transaction } from '@/types';
import { asTransactionId } from '@/lib/ids';
import type { EuerLine, EuerReport } from './euer-report';
import { escapeCsvCell } from './csv-utils';

type Translate = (key: string, fallback?: string) => string;

function amountCell(n: number): string {
  return n.toFixed(2).replace('.', ',');
}

/** `tax-eur-wareneinkauf` → i18n-Segment `euerWareneinkauf`; Sammel-Blatt hat Alt-Key. */
const LINE_KEY_SEGMENT: Record<string, string> = {
  'tax-eur-betriebseinnahme': 'euerBetriebseinnahme',
  'tax-eur-wareneinkauf': 'euerWareneinkauf',
  'tax-eur-fremdleistungen': 'euerFremdleistungen',
  'tax-eur-raumkosten': 'euerRaumkosten',
  'tax-eur-kfz': 'euerKfz',
  'tax-eur-reisekosten': 'euerReisekosten',
  'tax-eur-bewirtung': 'euerBewirtung',
  'tax-eur-arbeitsmittel': 'euerArbeitsmittel',
  'tax-eur-versicherungen-beitraege': 'euerVersicherungen',
  'tax-eur-telefon-internet': 'euerTelefonInternet',
  'tax-eur-betriebsausgabe': 'betriebsausgabe',
};

function lineLabel(
  line: EuerLine,
  translate: Translate,
  categoryNames: ReadonlyMap<string, string> | undefined,
): string {
  if (line.key.startsWith('cat:')) {
    const categoryId = line.key.slice(4);
    return (
      categoryNames?.get(categoryId) ??
      translate('euer.export.unknownCategory', 'Ohne Kategorie')
    );
  }
  const segment = LINE_KEY_SEGMENT[line.key];
  return segment ? translate(`tax.cat.${segment}.name`, line.key) : line.key;
}

export function buildEuerCsv(
  report: EuerReport,
  transactions: Transaction[],
  translate: Translate,
  categoryNames?: ReadonlyMap<string, string>,
): string {
  const byId = new Map(transactions.map((tx) => [tx.id, tx]));

  const headers = [
    translate('euer.export.colSection', 'Bereich'),
    translate('euer.export.colLine', 'Zeile'),
    translate('tax.export.colDate', 'Datum'),
    translate('tax.export.colPayee', 'Empfänger'),
    translate('tax.export.colDescription', 'Verwendungszweck'),
    translate('tax.export.colAmount', 'Betrag'),
    translate('euer.export.colDeductible', 'Abziehbar'),
    translate('tax.export.colNote', 'Notiz'),
  ];

  const rows: string[] = [];
  const row = (cells: string[]) => rows.push(cells.map(escapeCsvCell).join(';'));

  const writeBlock = (sectionLabel: string, lines: EuerLine[], withDeductible: boolean) => {
    for (const line of lines) {
      const label = lineLabel(line, translate, categoryNames);
      for (const txId of line.transactionIds) {
        const tx = byId.get(asTransactionId(txId));
        if (!tx) continue;
        row([
          sectionLabel,
          label,
          tx.date,
          tx.payee,
          tx.description,
          amountCell(tx.amount),
          '',
          tx.tax_note ?? '',
        ]);
      }
      // Summenzeile je Zeile: Netto (nach Erstattungen) + Abziehbar.
      row([
        translate('euer.export.sumPrefix', 'Summe') + ' ' + label,
        '',
        '',
        '',
        '',
        amountCell(line.net),
        withDeductible ? amountCell(line.deductible) : '',
        '',
      ]);
    }
  };

  writeBlock(translate('euer.export.sectionIncome', 'Betriebseinnahmen'), report.einnahmen.lines, false);
  writeBlock(translate('euer.export.sectionExpenses', 'Betriebsausgaben'), report.ausgaben.lines, true);

  const totalRow = (label: string, amount: number, deductible?: number) =>
    row([label, '', '', '', '', amountCell(amount), deductible !== undefined ? amountCell(deductible) : '', '']);

  totalRow(translate('euer.export.sumIncome', 'Summe Betriebseinnahmen'), report.einnahmen.total);
  totalRow(
    translate('euer.export.sumExpenses', 'Summe Betriebsausgaben'),
    report.ausgaben.grossTotal,
    report.ausgaben.deductibleTotal,
  );
  totalRow(translate('euer.export.profit', 'Gewinn'), report.gewinn);

  // Info-Block: nie gewinnwirksam, aber für die Anlage EÜR (Zeilen Entnahmen/
  // Einlagen) und die Plausibilisierung durch den Steuerberater nützlich.
  if (report.privatTransfers.entnahmen > 0) {
    totalRow(translate('euer.export.privatEntnahmen', 'Privatentnahmen (Info)'), report.privatTransfers.entnahmen);
  }
  if (report.privatTransfers.einlagen > 0) {
    totalRow(translate('euer.export.privatEinlagen', 'Privateinlagen (Info)'), report.privatTransfers.einlagen);
  }

  return [headers.map(escapeCsvCell).join(';'), ...rows].join('\n');
}

/** Sinnvoller Dateiname für den Download. */
export function euerCsvFilename(year: number): string {
  return `euer-${year}.csv`;
}
