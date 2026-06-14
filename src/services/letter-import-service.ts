// Brief-Inbox: Orchestrierung der Pipeline OCR → Brieftrennung → Parser → Forderungsakten
// (Issue #43-#46, Epic #24). Verbindet die einzeln getesteten Bausteine
// (letter-ocr-service, letter-splitting-service, letter-parser-service,
// claim-service) zu einem Schritt, den das UI aufrufen kann.

import {
  ocrImages,
  ocrPdf,
  type OcrDeps,
  type OcrPageResult,
  type OcrPipelineOptions,
} from "./letter-ocr-service";
import {
  combineLetterPages,
  splitLettersFromPages,
  type LetterSplitResult,
  type PageText,
} from "./letter-splitting-service";
import { parseLetter, type ParsedLetter } from "./letter-parser-service";
import { importLetters, type GroupingResult } from "./claim-service";

export interface LetterImportResult extends GroupingResult {
  /** Unsichere Brief-Grenzen aus der Trennung — zusätzlich zu needsReview. */
  splitReviewNeeded: LetterSplitResult["reviewNeeded"];
  /** Anzahl der erkannten Briefe nach Trennung (vor Gruppierung zu Akten). */
  letters: ParsedLetter[];
}

function toPageTexts(pages: OcrPageResult[]): PageText[] {
  return pages.map((p) => ({ pageNumber: p.page, text: p.text }));
}

/**
 * Trennt und parst OCR-Seiten zu einzelnen Briefen — pur, ohne Storage-Zugriff.
 */
export function parseOcrPages(pages: OcrPageResult[]): {
  letters: ParsedLetter[];
  splitResult: LetterSplitResult;
} {
  const splitResult = splitLettersFromPages(toPageTexts(pages));
  const letters = splitResult.splits.map((split) => parseLetter(combineLetterPages(split.pages)));
  return { letters, splitResult };
}

async function groupOcrPages(pages: OcrPageResult[]): Promise<LetterImportResult> {
  const { letters, splitResult } = parseOcrPages(pages);
  const grouping = await importLetters(letters);
  return { ...grouping, letters, splitReviewNeeded: splitResult.reviewNeeded };
}

/** Massen-PDF vom Einzugsscanner: OCR aller Seiten → Trennung → Parser → Akten. */
export async function importLettersFromPdf(
  data: ArrayBuffer,
  options: OcrPipelineOptions = {},
  deps?: OcrDeps,
): Promise<LetterImportResult> {
  const pages = await ocrPdf(data, options, deps);
  return groupOcrPages(pages);
}

/** Batch-Kamera-Modus: jedes Foto = eine Seite, gleiche Pipeline danach. */
export async function importLettersFromImages(
  images: Blob[],
  options: OcrPipelineOptions = {},
  deps?: OcrDeps,
): Promise<LetterImportResult> {
  const pages = await ocrImages(images, options, deps);
  return groupOcrPages(pages);
}
