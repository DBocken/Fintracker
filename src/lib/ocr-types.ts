/**
 * Abgeleitete Formen der Beleg-OCR (erkanntes Feld, extrahierte Position,
 * Gesamtergebnis).
 *
 * Vom `ocr-service` erzeugt, von `components/trading` gelesen — nach der
 * „Wohin ein Typ gehört"-Tabelle (AGENTS.md §3) gehört ein Typ, den Service
 * **und** Oberfläche brauchen, nach `src/lib/`. Diese Datei ist Teil der
 * Aufteilung von `src/types.ts` (WP 5.2, DOM-3).
 */

export interface OcrField {
  value: string;
  confidence: number;
  status: 'high' | 'medium' | 'low';
}

export interface OcrExtractedPosition {
  symbol: OcrField;
  quantity?: OcrField;
  entryPrice?: OcrField;
  currency?: OcrField;
}

export interface OcrResult {
  text: string;
  positions: OcrExtractedPosition[];
  overallConfidence: number;
}
