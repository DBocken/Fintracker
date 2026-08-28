/**
 * Router-Stufe 3, I/O-Seite: das lokale Embedding-Modell (Welle S).
 *
 * Lädt `multilingual-e5-small` (int8, ~118 MB + Tokenizer) **auf das Gerät**
 * — per Opt-in, einmalig, danach aus dem Browser-Cache. Die Frage des
 * Nutzers verlässt das Gerät nie: Der einzige Netzwerkverkehr ist der
 * Download statischer Modelldateien (Anbieter-Register: Hugging Face).
 *
 * Die REINE Logik (Scoring, Schwellen, Aktions-Filter) liegt in
 * `lib/semantic-intent.ts`; hier steht nur Laden, Cachen und Einbetten.
 * Die Paraphrasen-Embeddings werden je (Modell, Paraphrasen-Hash) einmal
 * gerechnet und in IndexedDB abgelegt — sonst kostete jeder Seitenaufruf
 * ~10 s Einbettungszeit für ~600 Sätze.
 */

import {
  quantisiere,
  semantischeVorschlaege,
  type QuantisierterVektor,
  type SemantischeKlasse,
  type SemantischerVorschlag,
} from '@/features/money-questions/domain/semantic-intent';
import { normalisiereFrage } from '@/lib/text-normalisierung';
import { idbGet, idbSet } from './idb-kv';

export const SEMANTIK_MODELL_ID = 'Xenova/multilingual-e5-small';

/**
 * Der Cache-Storage-Schlüssel, unter dem die Modelldateien liegen.
 *
 * Das ist der VOREINSTELLUNGSWERT der Bibliothek — hier trotzdem als
 * Konstante gesetzt und beim Laden ausdrücklich zugewiesen: Status und
 * Löschen greifen auf denselben Namen zu, und ein Vorgabewert, der sich
 * still ändert, hinterliesse ein Modell, das niemand mehr findet.
 *
 * **Wo das liegt:** im Cache Storage des Browsers, gebunden an die Herkunft
 * (Origin) dieser App — nicht in einem wählbaren Dateipfad. Eine Web-App
 * bestimmt ihren Speicherort nicht; das Betriebssystem entscheidet, wo der
 * Browser seine Daten ablegt. Wer das ändern will, braucht einen eigenen
 * Cache-Rücken über `env.customCache` (Vertrag: `{ match, put, delete }`) —
 * unter Capacitor liesse sich darüber das Dateisystem des Geräts ansteuern.
 * Das ist eine eigene Entscheidung mit eigenem Umfang, keine Einstellung.
 */
export const SEMANTIK_CACHE_KEY = 'transformers-cache';
/** Ungefähre Downloadgrösse — für die Einwilligung, nicht für die Technik. */
export const SEMANTIK_DOWNLOAD_MB = 135;

const OPT_IN_KEY = 'semantic-intent-opt-in';
const MATRIX_KEY_PRAEFIX = 'semantic-matrix:';

/** Geräte-Flag, bewusst localStorage: Das Modell liegt im Cache DIESES
 * Geräts — die Einstellung darf nicht per Backup auf ein Gerät ohne Modell
 * wandern (dasselbe Muster wie der GentleMode-Fast-Boot). */
export function istSemantikAktiv(): boolean {
  try {
    return localStorage.getItem(OPT_IN_KEY) === '1';
  } catch {
    return false;
  }
}

export function setzeSemantikAktiv(aktiv: boolean): void {
  try {
    if (aktiv) localStorage.setItem(OPT_IN_KEY, '1');
    else localStorage.removeItem(OPT_IN_KEY);
  } catch {
    // Ohne localStorage (z. B. blockierte Site-Daten) bleibt die Stufe aus.
  }
}

export interface SemantikFortschritt {
  /** 0..1 über den Modell-Download, danach die Paraphrasen-Einbettung. */
  anteil: number;
  phase: 'download' | 'einbetten' | 'bereit';
}

type Extraktor = (
  texte: string[],
  optionen: { pooling: 'mean'; normalize: boolean },
) => Promise<{ dims: number[]; data: Float32Array }>;

let extraktorPromise: Promise<Extraktor> | null = null;
let klassenPromise: Promise<SemantischeKlasse[]> | null = null;

/** Nur für Tests: setzt den Modul-Zustand zurück. */
export function _resetSemantikCache(): void {
  extraktorPromise = null;
  klassenPromise = null;
}

async function ladeExtraktor(onFortschritt?: (f: SemantikFortschritt) => void): Promise<Extraktor> {
  if (!extraktorPromise) {
    extraktorPromise = (async () => {
      // Dynamischer Import: transformers.js (inkl. onnxruntime-web) gehört
      // nie in den Startgraphen — es lädt nur, wer die Stufe eingeschaltet
      // hat UND eine Frage stellt, die sie braucht.
      const { pipeline, env } = await import('@huggingface/transformers');
      env.cacheKey = SEMANTIK_CACHE_KEY;
      // Die WASM-Laufzeit kommt vom EIGENEN Origin, nie vom Vorgabe-CDN:
      // transformers.js setzt sonst `cdn.jsdelivr.net` als `wasmPaths`, und
      // die CSP blockt das zu Recht (EU-Regel) — in der Produktion hiess das
      // „no available backend found", obwohl das Modell längst im Cache lag.
      // `/ort/` liefert Vite aus (Plugin in `vite.config.ts`, Dateien aus
      // exakt der onnxruntime-web-Version, die transformers pinnt —
      // `scripts/ort-laufzeit-core.mjs`). In Node (Laufzeit-Nachweis) läuft
      // onnxruntime-node; dort existiert der wasm-Zweig schlicht nicht.
      const onnxWasm = env.backends?.onnx?.wasm;
      if (onnxWasm) onnxWasm.wasmPaths = '/ort/';
      const groessen = new Map<string, { geladen: number; gesamt: number }>();
      const pipe = await pipeline('feature-extraction', SEMANTIK_MODELL_ID, {
        dtype: 'q8',
        progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
          if (p.status !== 'progress' || !p.file || !p.total) return;
          groessen.set(p.file, { geladen: p.loaded ?? 0, gesamt: p.total });
          let geladen = 0;
          let gesamt = 0;
          for (const g of groessen.values()) {
            geladen += g.geladen;
            gesamt += g.gesamt;
          }
          onFortschritt?.({ anteil: gesamt > 0 ? geladen / gesamt : 0, phase: 'download' });
        },
      });
      // Kein Cast an der Grenze: Der Wrapper nimmt die Tensor-Antwort der
      // Bibliothek entgegen und reicht genau die zwei Felder weiter, die
      // dieses Modul liest. `data` ist bei feature-extraction float32.
      const extraktor: Extraktor = async (texte, optionen) => {
        const out = await pipe(texte, optionen);
        return { dims: [...out.dims], data: out.data as Float32Array };
      };
      return extraktor;
    })();
    extraktorPromise.catch(() => {
      // Fehlgeschlagenes Laden darf beim nächsten Versuch neu starten —
      // sonst wäre ein einmaliger Netzfehler dauerhaft.
      extraktorPromise = null;
    });
  }
  return extraktorPromise;
}

async function embedTexte(
  extraktor: Extraktor,
  texte: readonly string[],
): Promise<QuantisierterVektor[]> {
  const vektoren: QuantisierterVektor[] = [];
  for (let i = 0; i < texte.length; i += 16) {
    // Präfix und Kleinschreibung EXAKT wie im Fixture-Generator — die
    // Ratsche misst nur, was die Laufzeit genauso rechnet.
    const batch = texte.slice(i, i + 16).map((t) => `query: ${t.toLowerCase()}`);
    const out = await extraktor([...batch], { pooling: 'mean', normalize: true });
    const [n, d] = out.dims;
    for (let j = 0; j < n; j += 1) {
      vektoren.push(quantisiere(out.data.subarray(j * d, (j + 1) * d)));
    }
  }
  return vektoren;
}

/** FNV-1a über die Paraphrasen-Texte — der Cache-Schlüssel der Matrix. */
function paraphrasenHash(paraphrasen: Readonly<Record<string, readonly string[]>>): string {
  const text = Object.entries(paraphrasen)
    .map(([k, t]) => `${k}:${t.join('|')}`)
    .sort()
    .join('\n');
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16);
}

interface GespeicherteMatrix {
  hash: string;
  klassen: Record<string, string[]>;
}

function nachB64(v: QuantisierterVektor): string {
  let s = '';
  for (let i = 0; i < v.length; i += 1) s += String.fromCharCode(v[i] & 0xff);
  return btoa(s);
}

function ausB64(b64: string): QuantisierterVektor {
  const roh = atob(b64);
  const q = new Int8Array(roh.length);
  for (let i = 0; i < roh.length; i += 1) {
    const byte = roh.charCodeAt(i);
    q[i] = byte > 127 ? byte - 256 : byte;
  }
  return q;
}

async function ladeKlassen(
  paraphrasen: Readonly<Record<string, readonly string[]>>,
  onFortschritt?: (f: SemantikFortschritt) => void,
): Promise<SemantischeKlasse[]> {
  if (!klassenPromise) {
    klassenPromise = (async () => {
      const hash = paraphrasenHash(paraphrasen);
      const schluessel = `${MATRIX_KEY_PRAEFIX}${SEMANTIK_MODELL_ID}`;
      const roh = await idbGet(schluessel);
      const gespeichert = roh ? (JSON.parse(roh) as GespeicherteMatrix) : null;
      if (gespeichert && gespeichert.hash === hash) {
        return Object.entries(gespeichert.klassen).map(([klasse, b64s]) => ({
          klasse,
          vektoren: b64s.map(ausB64),
        }));
      }

      const extraktor = await ladeExtraktor(onFortschritt);
      const eintraege = Object.entries(paraphrasen);
      const klassen: SemantischeKlasse[] = [];
      const speicher: Record<string, string[]> = {};
      let fertig = 0;
      for (const [klasse, texte] of eintraege) {
        const vektoren = await embedTexte(extraktor, texte);
        klassen.push({ klasse, vektoren });
        speicher[klasse] = vektoren.map(nachB64);
        fertig += 1;
        onFortschritt?.({ anteil: fertig / eintraege.length, phase: 'einbetten' });
      }
      await idbSet(schluessel, JSON.stringify({ hash, klassen: speicher } satisfies GespeicherteMatrix));
      return klassen;
    })();
    klassenPromise.catch(() => {
      klassenPromise = null;
    });
  }
  return klassenPromise;
}

/**
 * Stufe 3 für EINE Frage: Modell (und Matrix) bei Bedarf laden, Frage
 * einbetten, Vorschläge rechnen. Wirft bei Netz-/Ladefehlern — der Aufrufer
 * behandelt das als „Stufe 3 nicht verfügbar", nie als Antwortfehler.
 */
export async function semantikVorschlaegeFuer(
  frage: string,
  paraphrasen: Readonly<Record<string, readonly string[]>>,
  onFortschritt?: (f: SemantikFortschritt) => void,
): Promise<SemantischerVorschlag[]> {
  const klassen = await ladeKlassen(paraphrasen, onFortschritt);
  const extraktor = await ladeExtraktor(onFortschritt);
  onFortschritt?.({ anteil: 1, phase: 'bereit' });
  const [vektor] = await embedTexte(extraktor, [normalisiereFrage(frage)]);
  return semantischeVorschlaege(vektor, klassen);
}

/**
 * Was tatsächlich auf dem Gerät liegt.
 *
 * Gezählt wird aus dem Cache Storage selbst, nicht aus einem Merker: Ein
 * Flag, das „installiert" behauptet, während der Browser den Cache längst
 * geräumt hat (Speicherdruck, Website-Daten gelöscht), wäre genau die
 * stille Falschaussage, gegen die diese Anzeige gebaut ist.
 *
 * Die Grösse kommt aus dem `content-length` der abgelegten Antworten —
 * die Bibliothek legt die Originalantwort ab, der Kopf ist also da. Fehlt
 * er bei einem Eintrag, wird er als 0 gezählt und die Zahl als Untergrenze
 * ausgewiesen, statt die Datei zu lesen (135 MB durch den Speicher zu
 * ziehen, nur um sie zu zählen, wäre absurd).
 */
export interface ModellStatus {
  installiert: boolean;
  dateien: number;
  /** Summe der `content-length`-Köpfe; `unvollstaendig`, wenn einer fehlte. */
  bytes: number;
  unvollstaendig: boolean;
  /** Vom Browser für diese Herkunft belegt bzw. zugestanden — falls bekannt. */
  belegt?: number;
  kontingent?: number;
}

export async function modellStatus(): Promise<ModellStatus> {
  const leer: ModellStatus = { installiert: false, dateien: 0, bytes: 0, unvollstaendig: false };
  if (typeof caches === 'undefined') return leer;

  let dateien = 0;
  let bytes = 0;
  let unvollstaendig = false;
  try {
    if (!(await caches.has(SEMANTIK_CACHE_KEY))) return await mitSpeicher(leer);
    const cache = await caches.open(SEMANTIK_CACHE_KEY);
    for (const anfrage of await cache.keys()) {
      // Nur Dateien DIESES Modells zählen — der Cache gehört der Bibliothek,
      // nicht uns; läge je ein zweites Modell darin, wäre die Zahl sonst
      // eine Auskunft über etwas anderes.
      if (!anfrage.url.includes(SEMANTIK_MODELL_ID)) continue;
      const antwort = await cache.match(anfrage);
      if (!antwort) continue;
      dateien += 1;
      const laenge = Number(antwort.headers.get('content-length'));
      if (Number.isFinite(laenge) && laenge > 0) bytes += laenge;
      else unvollstaendig = true;
    }
  } catch {
    return leer;
  }
  return await mitSpeicher({ installiert: dateien > 0, dateien, bytes, unvollstaendig });
}

async function mitSpeicher(status: ModellStatus): Promise<ModellStatus> {
  try {
    const schaetzung = await navigator.storage?.estimate?.();
    if (!schaetzung) return status;
    return { ...status, belegt: schaetzung.usage, kontingent: schaetzung.quota };
  } catch {
    return status;
  }
}

/**
 * Modell und alles Abgeleitete entfernen — und die Stufe ausschalten.
 *
 * Das Ausschalten gehört DAZU: Bliebe das Opt-in stehen, lüde die nächste
 * unverstandene Frage die 135 MB stillschweigend erneut. Wer löscht, meint
 * „weg", nicht „gleich wieder".
 */
export async function modellLoeschen(): Promise<void> {
  setzeSemantikAktiv(false);
  _resetSemantikCache();
  try {
    await idbSet(`${MATRIX_KEY_PRAEFIX}${SEMANTIK_MODELL_ID}`, '');
  } catch {
    // Eine verbliebene Matrix ist folgenlos: Ohne Modell wird sie nie
    // gelesen, und beim nächsten Einschalten prüft der Hash sie ohnehin.
  }
  if (typeof caches === 'undefined') return;
  try {
    const cache = await caches.open(SEMANTIK_CACHE_KEY);
    for (const anfrage of await cache.keys()) {
      if (anfrage.url.includes(SEMANTIK_MODELL_ID)) await cache.delete(anfrage);
    }
    // Ist danach nichts mehr drin, kommt auch die Hülle weg.
    if ((await cache.keys()).length === 0) await caches.delete(SEMANTIK_CACHE_KEY);
  } catch {
    // Kein Cache-Zugriff (privates Fenster, blockierte Site-Daten) — dann
    // gab es auch nichts zu löschen.
  }
}
