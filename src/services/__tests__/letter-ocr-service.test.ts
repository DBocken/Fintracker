import { describe, expect, it, vi } from "vitest";
import {
  OcrAbortError,
  ocrImages,
  ocrPdf,
  runWithPool,
  type OcrDeps,
  type OcrEngine,
  type PdfDocument,
} from "../letter-ocr-service";

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe("runWithPool", () => {
  it("liefert Ergebnisse in stabiler Reihenfolge", async () => {
    const results = await runWithPool(5, 2, async (i) => {
      await new Promise((r) => setTimeout(r, (5 - i) * 5)); // späte Indizes zuerst fertig
      return `seite-${i}`;
    });
    expect(results).toEqual(["seite-0", "seite-1", "seite-2", "seite-3", "seite-4"]);
  });

  it("hält das Parallelitäts-Limit ein", async () => {
    let running = 0;
    let peak = 0;
    await runWithPool(10, 3, async () => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
    });
    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBeGreaterThan(1);
  });

  it("meldet Fortschritt pro fertiger Aufgabe", async () => {
    const seen: number[] = [];
    await runWithPool(4, 2, async () => undefined, (done) => seen.push(done));
    expect(seen).toEqual([1, 2, 3, 4]);
  });

  it("bricht über AbortSignal ab", async () => {
    const controller = new AbortController();
    let started = 0;
    const promise = runWithPool(
      10,
      1,
      async () => {
        started++;
        if (started === 2) controller.abort();
        await new Promise((r) => setTimeout(r, 1));
      },
      undefined,
      controller.signal,
    );
    await expect(promise).rejects.toBeInstanceOf(OcrAbortError);
    expect(started).toBeLessThan(10);
  });

  it("propagiert Task-Fehler", async () => {
    await expect(
      runWithPool(3, 2, async (i) => {
        if (i === 1) throw new Error("Render fehlgeschlagen");
        return i;
      }),
    ).rejects.toThrow("Render fehlgeschlagen");
  });
});

function fakeDeps(pageCount: number) {
  const recognized: string[] = [];
  const terminated: number[] = [];
  let enginesCreated = 0;
  let renderedNotRecognized = 0;
  let peakRendered = 0;
  let destroyed = false;

  const deps: OcrDeps = {
    async createEngine(): Promise<OcrEngine> {
      const id = enginesCreated++;
      return {
        async recognize(image) {
          await new Promise((r) => setTimeout(r, 2));
          renderedNotRecognized = Math.max(0, renderedNotRecognized - 1);
          recognized.push(String(image));
          return { text: `Text von ${image}`, confidence: 90 };
        },
        async terminate() {
          terminated.push(id);
        },
      };
    },
    async loadPdf(): Promise<PdfDocument> {
      return {
        numPages: pageCount,
        destroy() {
          destroyed = true;
        },
      };
    },
    async renderPdfPage(_pdf, pageNumber) {
      renderedNotRecognized++;
      peakRendered = Math.max(peakRendered, renderedNotRecognized);
      return `bild-${pageNumber}`;
    },
  };

  return {
    deps,
    state: () => ({ recognized, terminated, enginesCreated, peakRendered, destroyed }),
  };
}

describe("ocrPdf", () => {
  it("verarbeitet alle Seiten und liefert Rohtext pro Seite", async () => {
    const { deps } = fakeDeps(5);
    const results = await ocrPdf(new ArrayBuffer(0), { workerCount: 2 }, deps);
    expect(results.map((r) => r.page)).toEqual([1, 2, 3, 4, 5]);
    expect(results[0].text).toBe("Text von bild-1");
    expect(results[4].confidence).toBe(90);
  });

  it("hält nie mehr gerenderte Seiten im Speicher als Worker (30-Seiten-Stapel)", async () => {
    const { deps, state } = fakeDeps(30);
    await ocrPdf(new ArrayBuffer(0), { workerCount: 2 }, deps);
    expect(state().peakRendered).toBeLessThanOrEqual(2);
    expect(state().recognized.length).toBe(30);
  });

  it("zeigt Fortschritt pro Seite („Seite x von y“)", async () => {
    const { deps } = fakeDeps(3);
    const labels: string[] = [];
    await ocrPdf(
      new ArrayBuffer(0),
      { workerCount: 1, onProgress: (p) => labels.push(p.label) },
      deps,
    );
    expect(labels).toEqual(["Seite 1 von 3 …", "Seite 2 von 3 …", "Seite 3 von 3 …"]);
  });

  it("räumt Worker und PDF auch bei Abbruch auf", async () => {
    const { deps, state } = fakeDeps(10);
    const controller = new AbortController();
    const gate = deferred<void>();
    const slowDeps: OcrDeps = {
      ...deps,
      async renderPdfPage(pdf, page) {
        if (page === 2) {
          controller.abort();
          gate.resolve();
        }
        return deps.renderPdfPage(pdf, page);
      },
    };
    await expect(
      ocrPdf(new ArrayBuffer(0), { workerCount: 1, signal: controller.signal }, slowDeps),
    ).rejects.toBeInstanceOf(OcrAbortError);
    await gate.promise;
    expect(state().terminated.length).toBe(state().enginesCreated);
    expect(state().destroyed).toBe(true);
  });

  it("startet nicht mehr Worker als Seiten", async () => {
    const { deps, state } = fakeDeps(1);
    await ocrPdf(new ArrayBuffer(0), { workerCount: 3 }, deps);
    expect(state().enginesCreated).toBe(1);
  });
});

describe("ocrImages (Batch-Kamera-Modus)", () => {
  it("verarbeitet Foto-Blobs über dieselbe Pipeline", async () => {
    const { deps } = fakeDeps(0);
    const photos = [new Blob(["a"]), new Blob(["b"]), new Blob(["c"])];
    const onProgress = vi.fn();
    const results = await ocrImages(photos, { workerCount: 2, onProgress }, deps);
    expect(results.length).toBe(3);
    expect(results.map((r) => r.page)).toEqual([1, 2, 3]);
    expect(onProgress).toHaveBeenCalledTimes(3);
  });
});
