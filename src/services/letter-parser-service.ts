// Brief-Inbox: Extraktions-Parser für deutsche Mahnungen/Rechnungen (Issue #45, Epic #24).
// Arbeitet rein auf OCR-Text — komplett lokal, keine Netzwerk-Zugriffe.

// -----------------------------------------------------------------------------
// Typen
// -----------------------------------------------------------------------------

export type LetterDocType =
  | "rechnung"
  | "zahlungserinnerung"
  | "mahnung_1"
  | "mahnung_2_plus"
  | "inkasso"
  | "mahnbescheid"
  | "unbekannt";

export const LETTER_DOC_TYPE_LABELS: Record<LetterDocType, string> = {
  rechnung: "Rechnung",
  zahlungserinnerung: "Zahlungserinnerung",
  mahnung_1: "1. Mahnung",
  mahnung_2_plus: "2.+ Mahnung",
  inkasso: "Inkasso-Schreiben",
  mahnbescheid: "Gerichtlicher Mahnbescheid",
  unbekannt: "Unbekanntes Dokument",
};

/** Jedes extrahierte Feld trägt einen Confidence-Wert (0..1). */
export interface ExtractedField<T = string> {
  value: T;
  confidence: number;
  /** Original-Textstelle, aus der extrahiert wurde (für Review-UI). */
  raw?: string;
}

export interface ParsedLetterAmounts {
  hauptforderung?: ExtractedField<number>;
  mahngebuehren?: ExtractedField<number>;
  verzugszinsen?: ExtractedField<number>;
  gesamtbetrag?: ExtractedField<number>;
}

export interface ParsedLetter {
  docType: ExtractedField<LetterDocType>;
  /** Absender/Gläubiger, normalisiert. */
  creditor?: ExtractedField;
  /** Bei Inkasso: der Ursprungsgläubiger („Forderung der …"). Kritisch für Dedup (#46). */
  originalCreditor?: ExtractedField;
  /** Aktenzeichen / Forderungs- / Geschäftszeichen. */
  aktenzeichen?: ExtractedField;
  kundennummer?: ExtractedField;
  rechnungsnummer?: ExtractedField;
  amounts: ParsedLetterAmounts;
  /** Nur Mod-97-gültige IBANs werden übernommen. */
  iban?: ExtractedField;
  verwendungszweck?: ExtractedField;
  /** ISO-Datum (yyyy-mm-dd). */
  briefDatum?: ExtractedField;
  /** ISO-Datum (yyyy-mm-dd). */
  zahlungsfrist?: ExtractedField;
}

/** Felder unterhalb dieser Schwelle sollte das UI zur Bestätigung markieren. */
export const LOW_CONFIDENCE_THRESHOLD = 0.7;

// -----------------------------------------------------------------------------
// Normalisierung & Basis-Helfer
// -----------------------------------------------------------------------------

/** Häufige OCR-Verwechslungen in rein numerischen Kontexten korrigieren. */
function fixOcrDigits(s: string): string {
  return s.replace(/[OoIl|]/g, (c) => (c === "O" || c === "o" ? "0" : "1"));
}

export function normalizeCreditorName(name: string): string {
  return name
    .replace(/\s+/g, " ")
    .replace(/[,;|]+$/g, "")
    .trim();
}

/** Deutschen Betrag ("1.234,56", "1234,56 EUR") in Zahl umwandeln. */
export function parseGermanAmount(raw: string): number | null {
  const cleaned = fixOcrDigits(raw).replace(/[^\d.,]/g, "");
  if (!cleaned) return null;
  const m = cleaned.match(/^(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d{1,2}))?$/);
  if (!m) return null;
  const intPart = m[1].replace(/\./g, "");
  const decPart = m[2] ?? "0";
  const value = parseFloat(`${intPart}.${decPart.padEnd(2, "0")}`);
  return Number.isFinite(value) ? value : null;
}

// -----------------------------------------------------------------------------
// IBAN (Mod-97)
// -----------------------------------------------------------------------------

const IBAN_LENGTHS: Record<string, number> = {
  DE: 22, AT: 20, CH: 21, NL: 18, FR: 27, BE: 16, LU: 20, ES: 24, IT: 27, PL: 28,
};

export function isValidIban(iban: string): boolean {
  const s = iban.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(s)) return false;
  const expected = IBAN_LENGTHS[s.slice(0, 2)];
  if (expected && s.length !== expected) return false;
  if (s.length < 15 || s.length > 34) return false;
  // Mod-97: erste 4 Zeichen ans Ende, Buchstaben → Zahlen (A=10 … Z=35)
  const rearranged = s.slice(4) + s.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const part = ch >= "A" ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of part) remainder = (remainder * 10 + Number(d)) % 97;
  }
  return remainder === 1;
}

function extractIban(text: string): ExtractedField | undefined {
  // Kandidaten: Ländercode + 2 Prüfziffern (inkl. OCR-Verwechsler), dann Restfolge.
  // Die Prüfziffern-Bedingung verhindert, dass Wörter wie „IBAN" den Treffer schlucken.
  const candidateRe = /\b([A-Z]{2}\s?[\dOoIl|]{2}[\s0-9OoIl|A-Z]{9,40})/g;
  let match: RegExpExecArray | null;
  while ((match = candidateRe.exec(text)) !== null) {
    const raw = match[1];
    const compact = raw.replace(/\s+/g, "");
    // Deutsche IBANs: nach dem Ländercode nur Ziffern → OCR-Fixes anwenden
    const country = compact.slice(0, 2);
    const body = country === "DE" ? fixOcrDigits(compact.slice(2)) : compact.slice(2);
    for (let len = Math.min(body.length, 32); len >= 13; len--) {
      const candidate = country + body.slice(0, len);
      const expected = IBAN_LENGTHS[country];
      if (expected && candidate.length !== expected) continue;
      if (isValidIban(candidate)) {
        const repaired = compact !== country + body.slice(0, len);
        return { value: candidate, confidence: repaired ? 0.75 : 0.95, raw: raw.trim() };
      }
    }
  }
  return undefined;
}

// -----------------------------------------------------------------------------
// Beträge
// -----------------------------------------------------------------------------

const AMOUNT_RE = /(\d{1,3}(?:\.\d{3})*(?:,\d{2})|\d+,\d{2})\s*(?:€|EUR)?/;

function findLabeledAmount(
  lines: string[],
  labelRe: RegExp,
  confidence = 0.9,
): ExtractedField<number> | undefined {
  for (let i = 0; i < lines.length; i++) {
    if (!labelRe.test(lines[i])) continue;
    // Betrag in derselben oder der nächsten Zeile (Tabellenlayout)
    for (const line of [lines[i], lines[i + 1] ?? ""]) {
      const m = fixOcrDigits(line).match(AMOUNT_RE);
      if (m) {
        const value = parseGermanAmount(m[1]);
        if (value !== null) return { value, confidence, raw: lines[i].trim() };
      }
    }
  }
  return undefined;
}

function extractAmounts(lines: string[]): ParsedLetterAmounts {
  const amounts: ParsedLetterAmounts = {
    hauptforderung: findLabeledAmount(lines, /haupt\s*forderung|rechnungs\s*betrag/i),
    mahngebuehren: findLabeledAmount(lines, /mahn\s*(?:gebühr|geb[uü]hr|kosten)/i),
    verzugszinsen: findLabeledAmount(lines, /(?:verzugs)?zinsen/i),
    gesamtbetrag: findLabeledAmount(
      lines,
      /gesamt\s*(?:betrag|forderung|summe)|zu\s+zahlen(?:der\s+betrag)?|offener?\s+(?:gesamt)?betrag|forderung\s+gesamt/i,
    ),
  };

  // Plausibilität: Summe der Teilbeträge ≈ Gesamtbetrag → Confidence anheben
  const { hauptforderung, mahngebuehren, verzugszinsen, gesamtbetrag } = amounts;
  if (gesamtbetrag && hauptforderung) {
    const sum =
      hauptforderung.value + (mahngebuehren?.value ?? 0) + (verzugszinsen?.value ?? 0);
    if (Math.abs(sum - gesamtbetrag.value) < 0.01) {
      for (const f of [hauptforderung, mahngebuehren, verzugszinsen, gesamtbetrag]) {
        if (f) f.confidence = Math.min(0.98, f.confidence + 0.08);
      }
    } else {
      gesamtbetrag.confidence = Math.min(gesamtbetrag.confidence, 0.6);
    }
  }
  return amounts;
}

// -----------------------------------------------------------------------------
// Datumsangaben
// -----------------------------------------------------------------------------

const MONTHS_DE: Record<string, number> = {
  januar: 1, februar: 2, märz: 3, maerz: 3, april: 4, mai: 5, juni: 6,
  juli: 7, august: 8, september: 9, oktober: 10, november: 11, dezember: 12,
};

const DATE_RE =
  /(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})|(\d{1,2})\.\s?(januar|februar|märz|maerz|april|mai|juni|juli|august|september|oktober|november|dezember)\s+(\d{4})/i;

function parseGermanDate(raw: string): string | null {
  const m = fixOcrDigits(raw).match(DATE_RE) ?? raw.match(DATE_RE);
  if (!m) return null;
  let day: number, month: number, year: number;
  if (m[1]) {
    day = Number(m[1]); month = Number(m[2]); year = Number(m[3]);
  } else {
    day = Number(m[4]); month = MONTHS_DE[m[5].toLowerCase()]; year = Number(m[6]);
  }
  if (!day || !month || month > 12 || day > 31 || year < 1990 || year > 2100) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function extractBriefDatum(lines: string[]): ExtractedField | undefined {
  // Briefdatum steht typischerweise im oberen Drittel, oft nach „Ort, den …"
  const head = lines.slice(0, Math.max(8, Math.ceil(lines.length / 3)));
  for (const line of head) {
    if (DATE_RE.test(line)) {
      const iso = parseGermanDate(line);
      if (iso) {
        const afterComma = /,\s*(?:den\s+)?\d{1,2}\./.test(line) || /\bdatum\b/i.test(line);
        return { value: iso, confidence: afterComma ? 0.9 : 0.7, raw: line.trim() };
      }
    }
  }
  return undefined;
}

function extractZahlungsfrist(text: string): ExtractedField | undefined {
  const m = text.match(
    /(?:bis\s+(?:zum|spätestens(?:\s+zum)?)|zahlbar\s+bis|frist(?:\s+bis)?(?:\s+zum)?)[:\s]*([\d.]+\s?\d{1,2}\.\s?\d{4}|\d{1,2}\.\s?\w+\s+\d{4}|\d{1,2}\.\d{1,2}\.\d{4})/i,
  );
  if (m) {
    const iso = parseGermanDate(m[1]);
    if (iso) return { value: iso, confidence: 0.85, raw: m[0].trim() };
  }
  return undefined;
}

// -----------------------------------------------------------------------------
// Referenznummern
// -----------------------------------------------------------------------------

function findLabeledValue(
  text: string,
  labelRe: RegExp,
  confidence = 0.9,
): ExtractedField | undefined {
  const re = new RegExp(labelRe.source + String.raw`\s*[:.]?\s*([A-Za-z0-9][A-Za-z0-9\-/.]{2,30})`, "i");
  const m = text.match(re);
  if (!m) return undefined;
  return { value: m[1].toUpperCase(), confidence, raw: m[0].trim() };
}

// -----------------------------------------------------------------------------
// Dokumenttyp-Klassifikation
// -----------------------------------------------------------------------------

export function classifyDocType(text: string): ExtractedField<LetterDocType> {
  const t = text.toLowerCase();

  // Reihenfolge = Spezifität. Mahnbescheid hat Vorrang vor allem (Guardrails #50).
  if (/mahnbescheid|vollstreckungsbescheid/.test(t) && /gericht|amtsgericht/.test(t)) {
    return { value: "mahnbescheid", confidence: 0.95 };
  }
  if (/mahnbescheid/.test(t)) {
    return { value: "mahnbescheid", confidence: 0.8 };
  }
  // Explizit nummerierte Mahnstufen vor Inkasso prüfen: „Letzte Mahnung vor
  // Übergabe an ein Inkassounternehmen" ist noch keine Inkasso-Forderung.
  if (/(?:2|3|4|zweite|dritte|letzte)\.?\s*(?:und\s+letzte\s+)?mahnung/.test(t)) {
    return { value: "mahnung_2_plus", confidence: 0.9 };
  }
  if (/(?:1|erste)\.?\s*mahnung/.test(t)) {
    return { value: "mahnung_1", confidence: 0.9 };
  }
  if (/inkasso|forderungsmanagement|rechtsdienstleistungsregister|im\s+auftrag\s+unserer\s+mandant/.test(t)) {
    return { value: "inkasso", confidence: 0.9 };
  }
  if (/zahlungserinnerung/.test(t)) {
    return { value: "zahlungserinnerung", confidence: 0.9 };
  }
  if (/\bmahnung\b/.test(t)) {
    return { value: "mahnung_1", confidence: 0.6 };
  }
  if (/\brechnung\b|abrechnung|rechnungsbetrag/.test(t)) {
    return { value: "rechnung", confidence: 0.8 };
  }
  return { value: "unbekannt", confidence: 0.3 };
}

// -----------------------------------------------------------------------------
// Gläubiger
// -----------------------------------------------------------------------------

const COMPANY_HINT_RE =
  /\b(gmbh|ag|se|kg|ohg|gbr|e\.?\s?v\.?|mbh|inkasso|stadtwerke|sparkasse|bank|versand|telekom|energie)\b/i;

function extractCreditor(lines: string[]): ExtractedField | undefined {
  // Briefkopf: erste Zeilen; bevorzugt eine Zeile mit Firmenkennung
  const head = lines.slice(0, 6).map((l) => l.trim()).filter(Boolean);
  for (const line of head) {
    if (COMPANY_HINT_RE.test(line) && line.length <= 80) {
      return { value: normalizeCreditorName(line), confidence: 0.85, raw: line };
    }
  }
  if (head[0] && head[0].length <= 80) {
    return { value: normalizeCreditorName(head[0]), confidence: 0.5, raw: head[0] };
  }
  return undefined;
}

function extractOriginalCreditor(text: string): ExtractedField | undefined {
  const patterns: Array<[RegExp, number]> = [
    [/ursprungsgläubiger(?:in)?\s*[:.]?\s*(.+)/i, 0.95],
    [/gläubiger(?:in)?\s*[:.]?\s*(.+)/i, 0.9],
    [/forderung\s+der\s+(?:firma\s+)?(.+?)(?:\s+(?:aus|vom|in höhe)|[,.\n])/i, 0.85],
    [/im\s+auftrag\s+(?:der|von|unserer\s+mandantin,?\s+der)\s+(?:firma\s+)?(.+?)(?:\s+(?:aus|vom|machen|fordern)|[,.\n])/i, 0.85],
  ];
  for (const [re, confidence] of patterns) {
    const m = text.match(re);
    if (m) {
      const name = normalizeCreditorName(m[1].split("\n")[0]);
      if (name.length >= 3 && name.length <= 80) {
        return { value: name, confidence, raw: m[0].trim() };
      }
    }
  }
  return undefined;
}

// -----------------------------------------------------------------------------
// Hauptfunktion
// -----------------------------------------------------------------------------

export function parseLetter(ocrText: string): ParsedLetter {
  const text = ocrText.replace(/\r\n/g, "\n");
  const lines = text.split("\n").map((l) => l.trim());
  const nonEmpty = lines.filter(Boolean);

  const docType = classifyDocType(text);
  const result: ParsedLetter = {
    docType,
    creditor: extractCreditor(nonEmpty),
    aktenzeichen: findLabeledValue(
      text,
      /(?:aktenzeichen|gesch[äa]ftszeichen|forderungs(?:nummer|nr)|az\b)/i,
    ),
    kundennummer: findLabeledValue(text, /kunden(?:nummer|nr)/i),
    rechnungsnummer: findLabeledValue(text, /rechnungs(?:nummer|nr)/i),
    amounts: extractAmounts(lines),
    iban: extractIban(text),
    verwendungszweck: (() => {
      const m = text.match(/verwendungszweck\s*[:.]?\s*(.+)/i);
      return m
        ? { value: m[1].trim(), confidence: 0.9, raw: m[0].trim() }
        : undefined;
    })(),
    briefDatum: extractBriefDatum(nonEmpty),
    zahlungsfrist: extractZahlungsfrist(text),
  };

  if (docType.value === "inkasso" || docType.value === "mahnbescheid") {
    result.originalCreditor = extractOriginalCreditor(text);
  }
  return result;
}

/** Felder, die das UI zur Bestätigung markieren sollte. */
export function lowConfidenceFields(letter: ParsedLetter): string[] {
  const out: string[] = [];
  const check = (name: string, f?: ExtractedField<unknown>) => {
    if (f && f.confidence < LOW_CONFIDENCE_THRESHOLD) out.push(name);
  };
  check("docType", letter.docType);
  check("creditor", letter.creditor);
  check("originalCreditor", letter.originalCreditor);
  check("aktenzeichen", letter.aktenzeichen);
  check("kundennummer", letter.kundennummer);
  check("rechnungsnummer", letter.rechnungsnummer);
  check("iban", letter.iban);
  check("verwendungszweck", letter.verwendungszweck);
  check("briefDatum", letter.briefDatum);
  check("zahlungsfrist", letter.zahlungsfrist);
  check("hauptforderung", letter.amounts.hauptforderung);
  check("mahngebuehren", letter.amounts.mahngebuehren);
  check("verzugszinsen", letter.amounts.verzugszinsen);
  check("gesamtbetrag", letter.amounts.gesamtbetrag);
  return out;
}
