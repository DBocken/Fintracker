/**
 * Selbst gehostete ONNX-WASM-Laufzeit für die Router-Stufe 3 (Welle S).
 *
 * `transformers.js` setzt als VORGABE einen CDN-Pfad für die
 * onnxruntime-web-Laufzeit (`cdn.jsdelivr.net`), wenn `wasmPaths` nicht
 * gesetzt ist. Unsere CSP blockt das zu Recht (EU-Regel,
 * `docs/architecture/eu-souveraenitaet.md`) — gemessen in der Produktion:
 * „no available backend found … Failed to fetch … cdn.jsdelivr.net/npm/
 * onnxruntime-web@…/ort-wasm-simd-threaded.asyncify.mjs". Das Modell war
 * installiert, seine Laufzeit nicht erreichbar. Dieselbe Falle wie bei
 * Tesseract (Anbieter-Register, „zu entfernen"-Tabelle): Ein Host, der nur
 * in der Vorgabekonfiguration einer Bibliothek steht, taucht in keiner
 * eigenen Aufrufstelle auf.
 *
 * Antwort wie dort: **Assets selbst ausliefern.** Die Dateien kommen aus
 * exakt der onnxruntime-web-Version, die transformers.js pinnt — aufgelöst
 * über dessen eigene Abhängigkeit, damit Laufzeit-JS (im Bundle) und
 * WASM-Dateien (unter `/ort/`) nie auseinanderlaufen können.
 *
 * Getrennt von `vite.config.ts`, damit die Auflösung ohne Vite testbar ist
 * (`scripts/__tests__/ort-laufzeit-core.test.mjs`) — dieselbe Aufteilung wie
 * bei `layers-core.mjs`.
 */

import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';

/** URL-Präfix, unter dem die App die Laufzeit ausliefert (dev UND dist). */
export const ORT_LAUFZEIT_PREFIX = '/ort/';

/**
 * Nur die simd-threaded-Varianten sind auslieferbar — genau die Familie, aus
 * der onnxruntime-web im Browser wählt (asyncify als Regelfall, die
 * Grundform für Safari, jsep/jspi für WebGPU-Pfade). Alles andere im
 * `dist/`-Verzeichnis der Bibliothek (Bundles, Typdefinitionen) hat unter
 * `/ort/` nichts verloren — die Middleware ist damit auch kein offener
 * Dateisystem-Durchgriff.
 */
const ERLAUBT = /^ort-wasm-simd-threaded(?:\.(?:asyncify|jsep|jspi))?\.(?:mjs|wasm)$/;

export function istErlaubteOrtDatei(name) {
  return ERLAUBT.test(name);
}

/**
 * Das `dist/`-Verzeichnis der onnxruntime-web-Version, die
 * `@huggingface/transformers` selbst auflöst. Bewusst über `createRequire`
 * vom transformers-Paket aus: pnpm hält Versionen strikt getrennt, und eine
 * direkt installierte zweite Version wäre genau die Drift, die dieser Weg
 * strukturell ausschliesst.
 */
/**
 * Vom aufgelösten Einstiegsmodul zur Paketwurzel: beide Pakete kapseln ihre
 * `package.json` hinter einer `exports`-Map, ein direktes
 * `resolve('…/package.json')` wird deshalb abgewiesen. Der Weg über den
 * Einstiegspunkt bleibt trotzdem versionstreu — er läuft durch dieselbe
 * pnpm-Auflösung wie der Import zur Laufzeit.
 */
function paketWurzel(einstieg, paketName) {
  let dir = path.dirname(einstieg);
  for (;;) {
    const kandidat = path.join(dir, 'package.json');
    if (fs.existsSync(kandidat)) {
      const inhalt = JSON.parse(fs.readFileSync(kandidat, 'utf8'));
      if (inhalt.name === paketName) return dir;
    }
    const drueber = path.dirname(dir);
    if (drueber === dir) throw new Error(`Paketwurzel von ${paketName} nicht gefunden (ab ${einstieg})`);
    dir = drueber;
  }
}

export function ortDistVerzeichnis() {
  const eigenesRequire = createRequire(import.meta.url);
  const transformersEinstieg = eigenesRequire.resolve('@huggingface/transformers');
  const vonTransformers = createRequire(transformersEinstieg);
  const ortEinstieg = vonTransformers.resolve('onnxruntime-web');
  return path.join(paketWurzel(ortEinstieg, 'onnxruntime-web'), 'dist');
}

/** Die auszuliefernden Dateien, als absolute Pfade — für Copy und Middleware. */
export function ortLaufzeitDateien() {
  const dist = ortDistVerzeichnis();
  return fs
    .readdirSync(dist)
    .filter(istErlaubteOrtDatei)
    .map((name) => ({ name, pfad: path.join(dist, name) }));
}
