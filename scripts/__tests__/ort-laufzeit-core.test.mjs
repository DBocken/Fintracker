/**
 * Die selbst gehostete ONNX-WASM-Laufzeit muss existieren und vollständig
 * sein, BEVOR irgendein Browser sie anfragt.
 *
 * Nutzerfund (28.08., Produktion): Das Modell war installiert (135 MB im
 * Cache), und trotzdem „no available backend found" — onnxruntime-web wollte
 * seine Laufzeit von `cdn.jsdelivr.net` nachladen, und die CSP blockte das.
 * Kein Test war rot, weil der Node-Laufzeitnachweis onnxruntime-NODE benutzt
 * und die WASM-Vorgabe nie sieht. Dieser Test hält deshalb fest, was der
 * BROWSER braucht: die Dateien, auf die `/ort/` zeigt.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import {
  ORT_LAUFZEIT_PREFIX,
  istErlaubteOrtDatei,
  ortDistVerzeichnis,
  ortLaufzeitDateien,
} from '../ort-laufzeit-core.mjs';

describe('ort-laufzeit-core', () => {
  it('sollte das dist-Verzeichnis der von transformers gepinnten Version finden', () => {
    const dist = ortDistVerzeichnis();
    expect(fs.existsSync(dist)).toBe(true);
    // Die Auflösung MUSS über transformers laufen — dieselbe Version, die
    // dessen gebündeltes Laufzeit-JS erwartet. Eine zweite, direkt
    // installierte onnxruntime-web-Version wäre stille Drift.
    const transformers = JSON.parse(
      fs.readFileSync('node_modules/@huggingface/transformers/package.json', 'utf8'),
    );
    expect(dist).toContain(transformers.dependencies['onnxruntime-web']);
  });

  it('[REGRESSION] sollte genau die Datei enthalten, deren Fehlen die Produktion gemeldet hat', () => {
    const namen = ortLaufzeitDateien().map((d) => d.name);
    // „Failed to fetch … ort-wasm-simd-threaded.asyncify.mjs" — der Regelfall
    // im Chromium-Browser. Dazu sein WASM-Gegenstück und die Grundform, die
    // transformers für Safari wählt.
    expect(namen).toContain('ort-wasm-simd-threaded.asyncify.mjs');
    expect(namen).toContain('ort-wasm-simd-threaded.asyncify.wasm');
    expect(namen).toContain('ort-wasm-simd-threaded.mjs');
    expect(namen).toContain('ort-wasm-simd-threaded.wasm');
  });

  it('sollte NUR Laufzeitdateien erlauben — die Middleware ist kein Dateisystem-Durchgriff', () => {
    expect(istErlaubteOrtDatei('ort-wasm-simd-threaded.asyncify.wasm')).toBe(true);
    expect(istErlaubteOrtDatei('ort-wasm-simd-threaded.jsep.mjs')).toBe(true);
    expect(istErlaubteOrtDatei('ort.min.js')).toBe(false);
    expect(istErlaubteOrtDatei('../package.json')).toBe(false);
    expect(istErlaubteOrtDatei('ort-wasm-simd-threaded.asyncify.mjs.map')).toBe(false);
  });

  it('sollte das Präfix führen, auf das der Service zeigt', () => {
    // Der Service (src/services/semantic-intent-service.ts) trägt denselben
    // String als Konstante — src darf nicht aus scripts/ importieren. Diese
    // Zeile hält beide Seiten aneinander fest.
    expect(ORT_LAUFZEIT_PREFIX).toBe('/ort/');
    const service = fs.readFileSync('src/services/semantic-intent-service.ts', 'utf8');
    expect(service).toContain(`'${ORT_LAUFZEIT_PREFIX}'`);
  });
});
