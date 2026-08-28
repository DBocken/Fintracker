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
} from '@/lib/semantic-intent';
import { normalisiereFrage } from '@/lib/text-normalisierung';
import { idbGet, idbSet } from './idb-kv';

export const SEMANTIK_MODELL_ID = 'Xenova/multilingual-e5-small';
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
      const { pipeline } = await import('@huggingface/transformers');
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
