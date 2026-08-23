// Beleg-Parser: extrahiert Händler, Gesamtbetrag und Datum aus dem OCR-Text einer
// (bar bezahlten) Kassenrechnung. Arbeitet rein lokal auf dem OCR-Text.

import { t } from "../i18n/serviceT";
import { parseGermanAmount } from "./letter-parser-service";

export const MAX_RECEIPT_TEXT_LENGTH = 200_000;
export const MAX_RECEIPT_LINES = 5_000;

/** Jedes extrahierte Feld trägt einen Confidence-Wert (0..1). */
export interface ReceiptField<T = string> {
  value: T;
  confidence: number;
  raw?: string;
}

/**
 * Eine erkannte Produktzeile auf dem Bon. Bewusst konservativ: lieber keine als
 * eine falsche Zeile. `total` ist der Zeilenbetrag, `quantity`/`unitPrice` nur
 * gesetzt, wenn ein eindeutiges „n x Preis"-Muster erkannt wurde.
 */
export interface ReceiptLineItem {
  name: string;
  quantity?: number;
  unitPrice?: number;
  total: number;
  confidence: number;
  raw: string;
}

/**
 * Urteil der Summenprüfung: ergeben die erkannten Produktzeilen den
 * Gesamtbetrag?
 *
 * Die **Richtung** des Widerspruchs entscheidet, und nur eine der beiden
 * Richtungen ist ein Befund:
 *
 * - `confirmed` — Zeilensumme ≈ Gesamtbetrag. Zwei unabhängig gelesene Größen
 *   stimmen überein; das ist der stärkste Beleg, den ein Beleg über sich
 *   selbst liefern kann.
 * - `exceeds` — Zeilensumme ÜBER dem Gesamtbetrag. Echter Widerspruch:
 *   entweder ist ein Betrag zu hoch gelesen oder eine Nicht-Produktzeile
 *   mitgezählt worden.
 * - `incomplete` — Zeilensumme UNTER dem Gesamtbetrag. Der Normalfall, kein
 *   Fehler: Die Zeilenerkennung lässt bewusst aus, was sie nicht sicher
 *   erkennt. Hier zu warnen hiesse, bei fast jedem Beleg zu warnen — und eine
 *   Warnung, die immer kommt, wird nicht mehr gelesen.
 * - `unknown` — keine Zeilen oder kein Gesamtbetrag, also nichts zu vergleichen.
 */
export type ReceiptTotalCheck = 'confirmed' | 'exceeds' | 'incomplete' | 'unknown';

/** Dieselbe Toleranz wie die Zeilenprüfung — ein gerundeter Stückpreis ist kein Befund. */
const TOTAL_TOLERANCE = 0.02;

export interface ParsedReceipt {
  merchant?: ReceiptField;
  /** Gesamtbetrag (positiv). */
  total?: ReceiptField<number>;
  /** ISO-Datum (yyyy-mm-dd). */
  date?: ReceiptField;
  /** Optionale Produktzeilen (konservativ erkannt; im Zweifel leer). */
  lineItems?: ReceiptLineItem[];
  /** Summe der erkannten Produktzeilen — nur gesetzt, wenn es welche gibt. */
  lineItemSum?: number;
  /** Halten Zeilensumme und Gesamtbetrag einander stand? */
  totalCheck: ReceiptTotalCheck;
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
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
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
    const normalized = line.replace(/[\u0000-\u001f\u007f]/g, " ").trim().replace(/\s+/g, " ").slice(0, 120);
    return { value: normalized, confidence: 0.6, raw: normalized };
  }
  return undefined;
}

/** „2 x 1,99" / „2x1,99" – Menge und Stückpreis innerhalb einer Produktzeile. */
const QTY_PRICE_RE = /(\d+)\s*[xX]\s*(\d{1,3}(?:[.,]\d{2}))/;
/** Zeilen, die nie Produktzeilen sind (Kopf-/Fußzeilen, Steuer, Zahlungsart). */
const NON_ITEM_LABEL_RE = /(zwischensumme|summe|gesamt|total|zu\s*zahlen|endbetrag|r[üu]ckgeld|gegeben|bar(?:geld)?|wechselgeld|mwst|ust|steuer|netto|brutto|eur\b|kreditkarte|ec[\s-]?karte|girocard|kartenzahlung|trinkgeld)/i;

/**
 * Konservative Heuristik für Produktzeilen: Text + Betrag am Zeilenende, ohne
 * Summen-/Steuer-/Zahlungszeilen. Im Zweifel wird eine Zeile ausgelassen – lieber
 * keine als eine falsche Produktzeile.
 */
function extractLineItems(lines: string[]): ReceiptLineItem[] {
  const items: ReceiptLineItem[] = [];
  for (const line of lines) {
    if (NON_ITEM_LABEL_RE.test(line)) continue;
    const hit = lastAmountInLine(line);
    if (!hit || hit.value <= 0) continue;

    const idx = line.lastIndexOf(hit.raw);
    let namePart = line.slice(0, idx).replace(/[\x00-\x1f\x7f]/g, " ").trim();

    let quantity: number | undefined;
    let unitPrice: number | undefined;
    const qp = line.match(QTY_PRICE_RE);
    if (qp) {
      const q = Number(qp[1]);
      const up = parseGermanAmount(qp[2]);
      if (q > 0 && up !== null && up > 0) {
        quantity = q;
        unitPrice = up;
        // Mengen-/Preisangabe aus dem Namen entfernen.
        namePart = namePart.replace(qp[0], " ").trim();
      }
    }

    const name = namePart.replace(/\s+/g, " ").trim().slice(0, 120);
    const letters = name.replace(/[^A-Za-zäöüÄÖÜß]/g, "");
    if (letters.length < 3) continue; // ohne sinnvollen Namen lieber überspringen

    const consistent =
      quantity !== undefined && unitPrice !== undefined
        ? Math.abs(quantity * unitPrice - hit.value) < 0.02
        : false;

    items.push({
      name,
      quantity,
      unitPrice,
      total: hit.value,
      confidence: consistent ? 0.75 : 0.6,
      raw: line.trim(),
    });
  }
  return items;
}

export function parseReceipt(ocrText: string): ParsedReceipt {
  if (ocrText.length > MAX_RECEIPT_TEXT_LENGTH) throw new Error(t("receiptParserService.textTooLarge", "Belegtext ist zu groß."));
  const lines = ocrText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length > MAX_RECEIPT_LINES) throw new Error(t("receiptParserService.tooManyLines", "Beleg enthält zu viele Zeilen."));

  const lineItems = extractLineItems(lines);
  const total = extractTotal(lines);
  const { check, sum, total: geprueftesTotal } = pruefeSumme(total, lineItems);

  return {
    merchant: extractMerchant(lines),
    total: geprueftesTotal,
    date: extractDate(ocrText),
    ...(lineItems.length > 0 ? { lineItems, lineItemSum: sum } : {}),
    totalCheck: check,
  };
}

/**
 * Hält Zeilensumme und Gesamtbetrag gegeneinander und schreibt das Ergebnis in
 * die Confidence des Gesamtbetrags zurück.
 *
 * Genau das ist der Gewinn: Die beiden Größen entstehen aus **verschiedenen
 * Zeilen** desselben Belegs. Stimmen sie überein, ist das ein unabhängiger
 * Beleg, den keine der beiden Erkennungen allein liefern kann; widersprechen
 * sie sich nach oben, ist mindestens eine von beiden falsch gelesen — und
 * welche, ist von hier aus nicht entscheidbar. Deshalb wird der Gesamtbetrag
 * dann unter die Schwelle gesetzt und nicht etwa durch die Zeilensumme
 * ersetzt: Eine geratene Korrektur wäre schlimmer als ein benannter Zweifel.
 */
function pruefeSumme(
  total: ReceiptField<number> | undefined,
  lineItems: ReceiptLineItem[],
): { check: ReceiptTotalCheck; sum?: number; total?: ReceiptField<number> } {
  if (!total || lineItems.length === 0) return { check: 'unknown', total };

  const sum = Math.round(lineItems.reduce((s, i) => s + i.total, 0) * 100) / 100;
  const differenz = sum - total.value;

  if (Math.abs(differenz) < TOTAL_TOLERANCE) {
    return { check: 'confirmed', sum, total: { ...total, confidence: 0.98 } };
  }
  if (differenz > 0) {
    return { check: 'exceeds', sum, total: { ...total, confidence: 0.5 } };
  }
  return { check: 'incomplete', sum, total };
}

/** Liefert die Namen der Felder, die unter der Confidence-Schwelle liegen oder fehlen. */
export function receiptLowConfidenceFields(receipt: ParsedReceipt): string[] {
  const result: string[] = [];
  if (!receipt.total || receipt.total.confidence < RECEIPT_LOW_CONFIDENCE_THRESHOLD) result.push("total");
  if (!receipt.date || receipt.date.confidence < RECEIPT_LOW_CONFIDENCE_THRESHOLD) result.push("date");
  if (!receipt.merchant || receipt.merchant.confidence < RECEIPT_LOW_CONFIDENCE_THRESHOLD) result.push("merchant");
  return result;
}
