// Beleg-Parser: extrahiert Händler, Gesamtbetrag und Datum aus dem OCR-Text einer
// (bar bezahlten) Kassenrechnung. Arbeitet rein lokal auf dem OCR-Text.

import { parseGermanAmount } from "./letter-parser-service";

/** Jedes extrahierte Feld trägt einen Confidence-Wert (0..1). */
export interface ReceiptField<T = string> {
  value: T;
  confidence: number;
  raw?: string;
}

export interface ParsedReceipt {
  merchant?: ReceiptField;
  /** Gesamtbetrag (positiv). */
  total?: ReceiptField<number>;
  /** ISO-Datum (yyyy-mm-dd). */
  date?: ReceiptField;
}

/** Felder unterhalb dieser Schwelle sollte das UI zur Bestätigung markieren. */
export const RECEIPT_LOW_CONFIDENCE_THRESHOLD = 0.7;

const AMOUNT_RE = /(\d{1,3}(?:\.\d{3})*(?:,\d{2})|\d+,\d{2})/g;

/** Labels, die auf den zu zahlenden Gesamtbetrag hindeuten. */
const TOTAL_LABEL_RE = /(summe|gesamt(?:betrag|summe)?|total|zu\s*zahlen|betrag\s*eur|endbetrag)/i;
/** Zeilen, deren Betrag NICHT der Gesamtbetrag ist (Bargeld gegeben, Rückgeld, MwSt). */
const NON_TOTAL_LABEL_RE = /(r[üu]ckgeld|gegeben|bar(?:geld)?|wechselgeld|mwst|ust|steuer|netto|zwischensumme)/i;

function lastAmountInLine(line: string): { value: number; raw: string } | null {
  const matches = line.match(AMOUNT_RE);
  if (!matches) return null;
  const raw = matches[matches.length - 1];
  const value = parseGermanAmount(raw);
  return value === null ? null : { value, raw };
}

function extractTotal(lines: string[]): ReceiptField<number> | undefined {
  // 1. Bevorzugt eine als Summe/Gesamt/Total gekennzeichnete Zeile.
  for (const line of lines) {
    if (!TOTAL_LABEL_RE.test(line)) continue;
    if (NON_TOTAL_LABEL_RE.test(line)) continue;
    const hit = lastAmountInLine(line);
    if (hit && hit.value > 0) {
      return { value: hit.value, confidence: 0.9, raw: line.trim() };
    }
  }

  // 2. Fallback: größter plausibler Betrag, der nicht klar „Bar/Rückgeld/MwSt" ist.
  let best: { value: number; raw: string } | null = null;
  for (const line of lines) {
    if (NON_TOTAL_LABEL_RE.test(line)) continue;
    const hit = lastAmountInLine(line);
    if (hit && hit.value > 0 && (!best || hit.value > best.value)) best = hit;
  }
  if (best) return { value: best.value, confidence: 0.5, raw: best.raw };
  return undefined;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mär: 3, maer: 3, mar: 3, apr: 4, mai: 5, jun: 6, jul: 7,
  aug: 8, sep: 9, okt: 10, nov: 11, dez: 12,
};

function toIso(day: number, month: number, year: number): string | null {
  if (year < 100) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (year < 2000 || year > 2100) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function extractDate(text: string): ReceiptField | undefined {
  // 1. Numerisch: DD.MM.YYYY oder DD.MM.YY (Punkt, Schrägstrich, Bindestrich).
  const numeric = text.match(/\b(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})\b/);
  if (numeric) {
    const iso = toIso(Number(numeric[1]), Number(numeric[2]), Number(numeric[3]));
    if (iso) return { value: iso, confidence: 0.9, raw: numeric[0] };
  }
  // 2. Ausgeschrieben: "5. Juni 2026".
  const written = text.match(/\b(\d{1,2})\.?\s+([A-Za-zäöü]{3,9})\.?\s+(\d{4})\b/);
  if (written) {
    const key = written[2].toLowerCase().slice(0, 3);
    const month = MONTHS[key] ?? MONTHS[written[2].toLowerCase()];
    if (month) {
      const iso = toIso(Number(written[1]), month, Number(written[3]));
      if (iso) return { value: iso, confidence: 0.8, raw: written[0] };
    }
  }
  return undefined;
}

function extractMerchant(lines: string[]): ReceiptField | undefined {
  // Händlername steht typischerweise in den obersten Zeilen – die erste Zeile mit
  // genug Buchstaben, die nicht überwiegend aus Ziffern/Symbolen besteht.
  for (const line of lines.slice(0, 6)) {
    const letters = line.replace(/[^A-Za-zäöüÄÖÜß]/g, "");
    if (letters.length < 3) continue;
    if (/^(rechnung|beleg|quittung|kassenbon|datum|uhrzeit|tel|ust|steuer)/i.test(line.trim())) continue;
    return { value: line.trim().replace(/\s+/g, " "), confidence: 0.6, raw: line.trim() };
  }
  return undefined;
}

export function parseReceipt(ocrText: string): ParsedReceipt {
  const lines = ocrText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  return {
    merchant: extractMerchant(lines),
    total: extractTotal(lines),
    date: extractDate(ocrText),
  };
}

/** Liefert die Namen der Felder, die unter der Confidence-Schwelle liegen oder fehlen. */
export function receiptLowConfidenceFields(receipt: ParsedReceipt): string[] {
  const result: string[] = [];
  if (!receipt.total || receipt.total.confidence < RECEIPT_LOW_CONFIDENCE_THRESHOLD) result.push("total");
  if (!receipt.date || receipt.date.confidence < RECEIPT_LOW_CONFIDENCE_THRESHOLD) result.push("date");
  if (!receipt.merchant || receipt.merchant.confidence < RECEIPT_LOW_CONFIDENCE_THRESHOLD) result.push("merchant");
  return result;
}
