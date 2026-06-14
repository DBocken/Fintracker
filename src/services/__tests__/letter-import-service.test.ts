import { describe, expect, it } from "vitest";
import {
  importLettersFromImages,
  importLettersFromPdf,
  parseOcrPages,
  type LetterImportResult,
} from "../letter-import-service";
import type { OcrDeps, OcrEngine, OcrPageResult, PdfDocument } from "../letter-ocr-service";
import { getClaims } from "../claim-service";
import { LETTER_CORPUS } from "./letter-parser-corpus";

function corpusText(name: string): string {
  const letter = LETTER_CORPUS.find((l) => l.name === name);
  if (!letter) throw new Error(`Korpus-Brief fehlt: ${name}`);
  return letter.text;
}

function page(pageNumber: number, text: string): OcrPageResult {
  return { page: pageNumber, text, confidence: 90 };
}

describe("parseOcrPages", () => {
  it("trennt und parst mehrere Briefe aus OCR-Seiten", () => {
    const pages: OcrPageResult[] = [
      page(1, corpusText("Versandhandel: Rechnung")),
      page(2, corpusText("Versandhandel: 1. Mahnung")),
    ];

    const { letters, splitResult } = parseOcrPages(pages);

    // Trennung ist heuristisch — mindestens ein Brief, je ein ParsedLetter pro Split.
    expect(splitResult.splits.length).toBeGreaterThanOrEqual(1);
    expect(letters).toHaveLength(splitResult.splits.length);
    expect(letters[0].creditor?.value).toContain("Nordwind");
  });

  it("liefert leere Listen für leere Seiten", () => {
    const { letters, splitResult } = parseOcrPages([]);
    expect(letters).toEqual([]);
    expect(splitResult.splits).toEqual([]);
  });
});

// --- Fake-OCR-Deps (keine echten pdf.js/tesseract.js-Abhängigkeiten nötig) ---

function fakeDeps(pageTexts: string[]): OcrDeps {
  const engine: OcrEngine = {
    async recognize() {
      throw new Error("recognize sollte hier nicht direkt aufgerufen werden");
    },
    async terminate() {},
  };

  return {
    async createEngine() {
      let callIndex = 0;
      return {
        async recognize() {
          const text = pageTexts[callIndex] ?? "";
          callIndex++;
          return { text, confidence: 90 };
        },
        terminate: engine.terminate,
      };
    },
    async loadPdf(): Promise<PdfDocument> {
      return {
        numPages: pageTexts.length,
        destroy: async () => {},
      };
    },
    async renderPdfPage(_pdf, pageNumber) {
      return `data:image/png;base64,page-${pageNumber}`;
    },
  };
}

describe("importLettersFromPdf", () => {
  it("verarbeitet ein Mehr-Seiten-PDF zu Forderungsakten", async () => {
    const deps = fakeDeps([
      corpusText("Versandhandel: Rechnung"),
      corpusText("Versandhandel: Zahlungserinnerung"),
    ]);

    const result: LetterImportResult = await importLettersFromPdf(
      new ArrayBuffer(0),
      { workerCount: 1 },
      deps,
    );

    // Zwei Briefe vom selben Gläubiger mit gleicher Rechnungsnummer → eine Akte
    expect(result.letters).toHaveLength(2);
    expect(result.claims).toHaveLength(1);
    expect(result.claims[0].timeline).toHaveLength(2);

    const stored = await getClaims();
    expect(stored).toHaveLength(1);
  });

  it("meldet Fortschritt über onProgress", async () => {
    const deps = fakeDeps([corpusText("Versandhandel: Rechnung")]);
    const progressUpdates: number[] = [];

    await importLettersFromPdf(
      new ArrayBuffer(0),
      { workerCount: 1, onProgress: (p) => progressUpdates.push(p.done) },
      deps,
    );

    expect(progressUpdates).toEqual([1]);
  });
});

describe("importLettersFromImages", () => {
  it("verarbeitet Foto-Batches genauso wie ein PDF", async () => {
    const deps = fakeDeps([corpusText("Versandhandel: Rechnung")]);
    const images = [new Blob(["fake-image"], { type: "image/png" })];

    const result = await importLettersFromImages(images, { workerCount: 1 }, deps);

    expect(result.letters).toHaveLength(1);
    expect(result.claims).toHaveLength(1);
    expect(result.claims[0].creditor).toContain("Nordwind");
  });
});
