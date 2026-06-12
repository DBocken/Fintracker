// Brief-Inbox: Lokale OCR-Pipeline (Issue #43, Epic #24).
//
// Massenverarbeitung von Brief-Scans, komplett on-device:
// PDF → pdf.js rendert Seiten zu Bildern → tesseract.js (deutsch) im
// Worker-Pool. Seiten werden sequenziell gerendert und sofort wieder
// freigegeben (Speicher-Management — sonst stirbt der Tab bei 50 Seiten).
// Gleiche Pipeline für den Batch-Kamera-Modus (Bild-Blobs statt PDF).
//
// Die Pool-/Fortschritts-/Abbruch-Logik ist pur und mit injizierten
// Fakes testbar; pdf.js und tesseract.js werden lazy geladen.

export interface OcrPageResult {
  /** 1-basierte Seitennummer im Stapel. */
  page: number;
  /** OCR-Rohtext der Seite — Input für Brieftrennung (#44) und Parser (#45). */
  text: string;
  /** Tesseract-Konfidenz 0..100. */
  confidence: number;
}

export interface OcrProgress {
  done: number;
  total: number;
  /** Für die Fortschritts-UI: „Seite 12 von 23 …" */
  label: string;
}

export interface OcrPipelineOptions {
  /** Anzahl paralleler OCR-Worker (Default: Kerne − 1, max. 3, min. 1). */
  workerCount?: number;
  onProgress?: (progress: OcrProgress) => void;
  signal?: AbortSignal;
}

export class OcrAbortError extends Error {
  constructor() {
    super("OCR-Verarbeitung abgebrochen.");
    this.name = "OcrAbortError";
  }
}

export function defaultWorkerCount(): number {
  const cores =
    typeof navigator !== "undefined" && navigator.hardwareConcurrency
      ? navigator.hardwareConcurrency
      : 2;
  return Math.max(1, Math.min(3, cores - 1));
}

// -----------------------------------------------------------------------------
// Pure Pool-Orchestrierung (testbar ohne pdf.js/tesseract)
// -----------------------------------------------------------------------------

/**
 * Verarbeitet `total` Aufgaben mit begrenzter Parallelität. `task` liefert
 * das Ergebnis für einen Index; die Ergebnisreihenfolge bleibt stabil.
 * Bricht über AbortSignal ab und meldet Fortschritt pro fertiger Aufgabe.
 */
export async function runWithPool<R>(
  total: number,
  concurrency: number,
  task: (index: number) => Promise<R>,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<R[]> {
  const results = new Array<R>(total);
  let nextIndex = 0;
  let done = 0;

  async function runner(): Promise<void> {
    for (;;) {
      if (signal?.aborted) throw new OcrAbortError();
      const index = nextIndex++;
      if (index >= total) return;
      results[index] = await task(index);
      if (signal?.aborted) throw new OcrAbortError();
      done++;
      onProgress?.(done, total);
    }
  }

  const runners = Array.from(
    { length: Math.max(1, Math.min(concurrency, total)) },
    () => runner(),
  );
  await Promise.all(runners);
  return results;
}

// -----------------------------------------------------------------------------
// Abhängigkeiten (injizierbar für Tests)
// -----------------------------------------------------------------------------

export interface OcrEngine {
  /** Erkennt Text in einem Bild (Data-URL oder Blob). */
  recognize(image: string | Blob): Promise<{ text: string; confidence: number }>;
  terminate(): Promise<void>;
}

export interface OcrDeps {
  /** Erzeugt einen OCR-Worker (deutsch). */
  createEngine: () => Promise<OcrEngine>;
  /**
   * Rendert genau EINE PDF-Seite zum Bild. Seiten werden bewusst einzeln
   * angefordert und nach der Erkennung freigegeben statt alle vorzurendern.
   */
  renderPdfPage: (pdf: PdfDocument, pageNumber: number) => Promise<string>;
  loadPdf: (data: ArrayBuffer) => Promise<PdfDocument>;
}

export interface PdfDocument {
  numPages: number;
  destroy(): Promise<void> | void;
}

// --- Produktiv-Implementierung (lazy geladen) --------------------------------

async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  }
  return pdfjs;
}

/** Render-Auflösung: 300-dpi-Äquivalent ist für Tesseract der Sweet-Spot. */
const RENDER_SCALE = 2.4;

export function productionDeps(): OcrDeps {
  return {
    async createEngine() {
      const Tesseract = (await import("tesseract.js")).default;
      const worker = await Tesseract.createWorker("deu");
      return {
        async recognize(image) {
          const { data } = await worker.recognize(image);
          return { text: data.text, confidence: data.confidence };
        },
        terminate: async () => {
          await worker.terminate();
        },
      };
    },

    async loadPdf(data) {
      const pdfjs = await loadPdfJs();
      const doc = await pdfjs.getDocument({ data }).promise;
      return doc as unknown as PdfDocument;
    },

    async renderPdfPage(pdf, pageNumber) {
      const doc = pdf as unknown as import("pdfjs-dist").PDFDocumentProxy;
      const page = await doc.getPage(pageNumber);
      try {
        const viewport = page.getViewport({ scale: RENDER_SCALE });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) throw new Error("Canvas-Kontext nicht verfügbar.");
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        const dataUrl = canvas.toDataURL("image/png");
        // Canvas-Speicher sofort freigeben (Safari/Mobile sind hier knapp).
        canvas.width = 0;
        canvas.height = 0;
        return dataUrl;
      } finally {
        page.cleanup();
      }
    },
  };
}

// -----------------------------------------------------------------------------
// Pipeline
// -----------------------------------------------------------------------------

async function withEnginePool<R>(
  deps: OcrDeps,
  workerCount: number,
  total: number,
  taskWithEngine: (engine: OcrEngine, index: number) => Promise<R>,
  options: OcrPipelineOptions,
): Promise<R[]> {
  const count = Math.max(1, Math.min(workerCount, total));
  const engines = await Promise.all(
    Array.from({ length: count }, () => deps.createEngine()),
  );
  const idle: OcrEngine[] = [...engines];

  try {
    return await runWithPool(
      total,
      count,
      async (index) => {
        const engine = idle.pop();
        if (!engine) throw new Error("Worker-Pool inkonsistent."); // pool size == concurrency
        try {
          return await taskWithEngine(engine, index);
        } finally {
          idle.push(engine);
        }
      },
      (done, totalCount) =>
        options.onProgress?.({
          done,
          total: totalCount,
          label: `Seite ${done} von ${totalCount} …`,
        }),
      options.signal,
    );
  } finally {
    await Promise.all(engines.map((e) => e.terminate().catch(() => undefined)));
  }
}

/**
 * Verarbeitet ein (Multi-Dokument-)PDF vom Einzugsscanner: jede Seite wird
 * einzeln gerendert, erkannt und wieder freigegeben.
 */
export async function ocrPdf(
  data: ArrayBuffer,
  options: OcrPipelineOptions = {},
  deps: OcrDeps = productionDeps(),
): Promise<OcrPageResult[]> {
  const pdf = await deps.loadPdf(data);
  try {
    return await withEnginePool(
      deps,
      options.workerCount ?? defaultWorkerCount(),
      pdf.numPages,
      async (engine, index) => {
        // Render erst, wenn ein Worker frei ist — nie alle Seiten gleichzeitig im Speicher.
        const image = await deps.renderPdfPage(pdf, index + 1);
        const { text, confidence } = await engine.recognize(image);
        return { page: index + 1, text, confidence } satisfies OcrPageResult;
      },
      options,
    );
  } finally {
    await pdf.destroy();
  }
}

/**
 * Batch-Kamera-Modus (mobil/Capacitor): Brief fotografieren → nächster →
 * nächster. Gleiche Pipeline, Bilder statt PDF-Seiten.
 */
export async function ocrImages(
  images: Blob[],
  options: OcrPipelineOptions = {},
  deps: OcrDeps = productionDeps(),
): Promise<OcrPageResult[]> {
  return withEnginePool(
    deps,
    options.workerCount ?? defaultWorkerCount(),
    images.length,
    async (engine, index) => {
      const { text, confidence } = await engine.recognize(images[index]);
      return { page: index + 1, text, confidence } satisfies OcrPageResult;
    },
    options,
  );
}

/**
 * Anleitungstexte für das UI (Copyshop-Hinweis + Zuhause-Alternative).
 * Zentral gepflegt, damit Desktop/Mobile dieselben Formulierungen nutzen.
 */
export const SCAN_GUIDANCE = {
  recommendation:
    "Tipp: Verarbeite große Stapel am besten am Desktop — dort ist die Erkennung deutlich schneller.",
  copyshop:
    "Im Copyshop: Scanne auf deinen eigenen USB-Stick, nicht per E-Mail. Lösche die Datei danach am Copyshop-Gerät.",
  homeAlternative:
    "Zuhause geht es auch ohne Scanner: Fotografiere jeden Brief einzeln mit der Kamera — wir verarbeiten die Fotos genauso.",
  privacy:
    "Alles passiert auf deinem Gerät. Deine Briefe werden nirgendwohin hochgeladen.",
} as const;
