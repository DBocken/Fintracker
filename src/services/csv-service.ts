import { parse } from 'papaparse';
import type { Transaction } from '../types';

export interface CsvMapping {
  bankName: string;
  dateColumn: string;
  amountColumn: string;
  payeeColumn: string;
  descriptionColumn: string;
  currencyColumn?: string;
  categoryColumn?: string;
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
  },
  dkb: {
    bankName: 'DKB',
    dateColumn: 'Buchungstag',
    amountColumn: 'Betrag',
    payeeColumn: 'Begünstigter/Zahlungspflichtiger',
    descriptionColumn: 'Verwendungszweck',
    currencyColumn: 'Währung',
    categoryColumn: 'Kategorie',
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

export function createDefaultMapping(headers: string[]): CsvMapping {
  const categoryHeader = headers.find(h =>
    h.toLowerCase().includes('kategorie') ||
    h.toLowerCase().includes('category') ||
    h.toLowerCase().includes('kategorisierung')
  );
  return {
    bankName: 'custom',
    dateColumn: headers[0] || '',
    amountColumn: headers[1] || '',
    payeeColumn: headers[2] || '',
    descriptionColumn: headers[3] || '',
    currencyColumn: headers[4],
    categoryColumn: categoryHeader || headers.find((_, i) => i > 4) || '',
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
function parseGermanDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  
  // Handle different German date formats
  const cleanDate = dateStr.trim();
  
  // Format: DD.MM.YYYY or DD.MM.YY
  const germanMatch = cleanDate.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (germanMatch) {
    const [, day, month, year] = germanMatch;
    const fullYear = year.length === 2 ? `20${year}` : year;
    return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Format: DD/MM/YYYY or DD/MM/YY
  const slashMatch = cleanDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    const fullYear = year.length === 2 ? `20${year}` : year;
    return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // Already ISO format
  if (cleanDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return cleanDate;
  }
  
  // Try parsing as Date
  try {
    const date = new Date(cleanDate);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  } catch (e) {
    console.warn('Could not parse date:', cleanDate, 'using current date');
  }
  
  return new Date().toISOString().split('T')[0];
}

/** Parse amount with German number format */
function parseGermanAmount(amountStr: string): number {
  if (!amountStr) return 0;

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
  return isNaN(parsed) ? 0 : parsed;
}

export async function parseCsv(
  file: File,
  mapping: CsvMapping,
  delimiter: string = ';'
): Promise<Transaction[]> {
  const text = await file.text();
  const result = parse<Record<string, string>>(text, {
    header: true,
    delimiter,
    skipEmptyLines: true,
  });
  
  return result.data.map((row: Record<string, string>, index: number) => ({
    id: `csv-${Date.now()}-${index}`,
    date: parseGermanDate(row[mapping.dateColumn] || ''),
    amount: parseGermanAmount(row[mapping.amountColumn] || '0'),
    payee: row[mapping.payeeColumn] || '',
    description: row[mapping.descriptionColumn] || '',
    original_text: row[mapping.descriptionColumn] || '',
    currency: row[mapping.currencyColumn!] || 'EUR',
    csvCategoryName: row[mapping.categoryColumn!] || '',
    category_id: null,
    subcategory_id: null,
    auto_mapped: false,
    confirmed: false,
  }));
}