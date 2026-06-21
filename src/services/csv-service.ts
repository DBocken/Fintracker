import { parse } from 'papaparse';
import type { Transaction } from '../types';

export const MAX_CSV_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_CSV_ROWS = 50_000;

export interface CsvMapping {
  bankName: string;
  dateColumn: string;
  amountColumn: string;
  payeeColumn: string;
  descriptionColumn: string;
  currencyColumn?: string;
  categoryColumn?: string;
  /** Spalte mit der IBAN des Gegenkontos – für die automatische Transfer-Erkennung */
  ibanColumn?: string;
}

export const BANK_TEMPLATES: Record<string, CsvMapping> = {
  sparkasse: {
    bankName: 'Sparkasse',
    dateColumn: 'Buchungstag',
    amountColumn: 'Betrag',
    payeeColumn: 'Beguenstigter/Zahlungspflichtiger',
    descriptionColumn: 'Verwendungszweck',
    currencyColumn: 'Waehrung',
    categoryColumn: 'Kategorie',
    ibanColumn: 'Kontonummer/IBAN',
  },
  dkb: {
    bankName: 'DKB',
    dateColumn: 'Buchungstag',
    amountColumn: 'Betrag',
    payeeColumn: 'Begünstigter/Zahlungspflichtiger',
    descriptionColumn: 'Verwendungszweck',
    currencyColumn: 'Währung',
    categoryColumn: 'Kategorie',
    ibanColumn: 'IBAN',
  },
  n26: {
    bankName: 'N26',
    dateColumn: 'Date',
    amountColumn: 'Amount (EUR)',
    payeeColumn: 'Payee',
    descriptionColumn: 'Payment reference',
    currencyColumn: 'Currency',
    categoryColumn: 'Category',
  },
};

async function stableCsvTransactionId(parts: readonly unknown[]): Promise<string> {
  const canonical = parts.map((part) => String(part ?? '').trim()).join('\u001f');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  const shortHash = Array.from(new Uint8Array(digest).slice(0, 16), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `csv-${shortHash}`;
}

export function createDefaultMapping(headers: string[]): CsvMapping {
  const lower = (h: string) => h.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const categoryHeader = headers.find(h =>
    lower(h).includes('kategorie') ||
    lower(h).includes('category') ||
    lower(h).includes('kategorisierung')
  );
  const ibanHeader = headers.find(h =>
    lower(h).includes('iban') ||
    lower(h).includes('kontonummer')
  );
  return {
    bankName: 'custom',
    dateColumn: headers[0] || '',
    amountColumn: headers[1] || '',
    payeeColumn: headers[2] || '',
    descriptionColumn: headers[3] || '',
    currencyColumn: headers[4],
    categoryColumn: categoryHeader || headers.find((_, i) => i > 4) || '',
    ibanColumn: ibanHeader,
  };
}

export function detectBank(headers: string[]): string | undefined {
  const norm = headers.map(h =>
    h
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/ß/g, 'ss')
  );
  if (
    norm.includes('auftragskonto') &&
    norm.includes('buchungstag') &&
    norm.includes('valutadatum') &&
    norm.includes('verwendungszweck') &&
    norm.includes('beguenstigter/zahlungspflichtiger') &&
    norm.includes('betrag') &&
    norm.includes('waehrung') &&
    norm.some(h => h.includes('kategorie') || h.includes('category'))
  ) {
    return 'sparkasse';
  }
  if (norm.includes('amount (eur)')) return 'n26';
  if (norm.includes('beguenstigter/zahlungspflichtiger')) return 'dkb';
  return undefined;
}

/** Parse German date formats to ISO */
function validIsoDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function parseGermanDate(dateStr: string): string | null {
  if (!dateStr) return null;
  
  // Handle different German date formats
  const cleanDate = dateStr.trim();
  
  // Format: DD.MM.YYYY or DD.MM.YY
  const germanMatch = cleanDate.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (germanMatch) {
    const [, day, month, year] = germanMatch;
    const fullYear = year.length === 2 ? `20${year}` : year;
    return validIsoDate(Number(fullYear), Number(month), Number(day));
  }
  
  // Format: DD/MM/YYYY or DD/MM/YY
  const slashMatch = cleanDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    const fullYear = year.length === 2 ? `20${year}` : year;
    return validIsoDate(Number(fullYear), Number(month), Number(day));
  }
  
  // Already ISO format
  if (cleanDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = cleanDate.split('-').map(Number);
    return validIsoDate(year, month, day);
  }
  
  // Try parsing as Date
  try {
    const date = new Date(cleanDate);
    if (!isNaN(date.getTime())) {
      return validIsoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
    }
  } catch (e) {
    console.warn('Could not parse date:', cleanDate, 'using current date');
  }
  
  return null;
}

/** Parse amount with German number format */
function parseGermanAmount(amountStr: string): number | null {
  if (!amountStr) return null;

  let cleanAmount = amountStr
    .toString()
    .replace(/\s/g, '') // Remove spaces
    .replace(/[^\d,\.-]/g, ''); // Keep only numbers, comma, dot and minus

  // German decimal format uses comma as decimal separator and dot as
  // thousands separator (e.g. "2.500,00" = 2500.00). If a comma is
  // present, strip the thousands dots before converting the comma.
  if (cleanAmount.includes(',')) {
    cleanAmount = cleanAmount.replace(/\./g, '').replace(',', '.');
  }

  const parsed = parseFloat(cleanAmount);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function parseCsv(
  file: File,
  mapping: CsvMapping,
  delimiter: string = ';'
): Promise<Transaction[]> {
  if (file.size > MAX_CSV_FILE_BYTES) throw new Error('CSV-Datei ist zu groß (maximal 10 MB).');
  const text = await file.text();
  const result = parse<Record<string, string>>(text, {
    header: true,
    delimiter,
    skipEmptyLines: true,
  });
  if (result.errors.length > 0) throw new Error(`CSV-Datei ist beschädigt: ${result.errors[0].message}`);
  if (result.data.length > MAX_CSV_ROWS) throw new Error(`CSV-Datei enthält mehr als ${MAX_CSV_ROWS} Buchungen.`);
  
  return Promise.all(result.data.map(async (row: Record<string, string>, index: number) => {
    const rawIban = mapping.ibanColumn ? (row[mapping.ibanColumn] || '').trim() : '';
    const counterpartyIban = rawIban.replace(/\s+/g, '').toUpperCase() || null;
    const date = parseGermanDate(row[mapping.dateColumn] || '');
    const amount = parseGermanAmount(row[mapping.amountColumn] || '');
    if (!date) throw new Error(`Ungültiges Buchungsdatum in CSV-Zeile ${index + 2}.`);
    if (amount === null) throw new Error(`Ungültiger Betrag in CSV-Zeile ${index + 2}.`);
    const payee = row[mapping.payeeColumn] || '';
    const description = row[mapping.descriptionColumn] || '';
    const currency = row[mapping.currencyColumn!] || 'EUR';
    const id = await stableCsvTransactionId([
      mapping.bankName,
      index,
      date,
      amount.toFixed(2),
      payee,
      description,
      currency,
      counterpartyIban,
    ]);
    return {
      id,
      date,
      amount,
      payee,
      description,
      original_text: description,
      currency,
      csvCategoryName: row[mapping.categoryColumn!] || '',
      category_id: null,
      subcategory_id: null,
      auto_mapped: false,
      confirmed: false,
      counterparty_iban: counterpartyIban,
    };
  }));
}
