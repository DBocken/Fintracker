/**
 * Semantische Frage-Zuordnung — Router-Stufe 3 (reine Logik, kein I/O).
 *
 * Ein kleines Embedding-Modell (multilingual-e5-small, int8, auf dem Gerät)
 * bettet die Frage ein; verglichen wird gegen die Embeddings der KURATIERTEN
 * Paraphrasen — derselben, aus denen Stufe 2 lernt. Gemessen am Residuum der
 * fünf Korpora (den Zeilen, die Stufe 0–2 nicht verstehen): top-1 86 %,
 * top-3 97 %. Deshalb ist das Ergebnis dieser Stufe IMMER eine AUSWAHL und
 * nie eine stille Antwort: 14 % top-1-Fehler wären „zuversichtlich falsch",
 * genau der Ausgang, den die Router-Ratsche bei ≤ 1 % deckelt. Eine präzise
 * Rückfrage zählt laut Auftrag als korrekt — eine falsche Zahl nicht.
 *
 * Das Schreib-Gate hält hier STRUKTURELL: Die Paraphrasen enthalten keine
 * einzige Aktions-Klasse (AGENTS.md §3 — „ein schreibender Eintrag ist
 * ausschliesslich über seine eigene Grammatik erreichbar; seine Paraphrasen
 * entfallen"). Zusätzlich filtert `semantischeVorschlaege` defensiv alles,
 * was auf `.aktion` endet — falls je eine Paraphrase dorthin rutscht, wird
 * sie hier stumm, statt eine Schreib-Vorschau anzubieten.
 *
 * Embeddings laufen als **int8** durch dieses Modul (L2-normierte Vektoren,
 * je Komponente `round(x·127)`): ein Viertel des Speichers, und die
 * Rangfolge bleibt erhalten — nachgemessen identische top-3 gegen float32
 * auf allen 406 Korpusfragen (Fixture-Generator prüft das bei jeder
 * Erzeugung erneut).
 */

/** Ein L2-normierter Vektor, je Komponente auf int8 quantisiert. */
export type QuantisierterVektor = Int8Array;

export interface SemantischeKlasse {
  klasse: string;
  vektoren: readonly QuantisierterVektor[];
}

export interface SemantischerVorschlag {
  klasse: string;
  /** kNN-3-Ähnlichkeit 0..1 (Kosinus, dequantisiert). */
  score: number;
}

/**
 * Unter dieser kNN-3-Ähnlichkeit wird NICHTS vorgeschlagen.
 *
 * Die Schwelle ist über die Fixture GESWEEPT, nicht geraten: Bei 0.87 fällt
 * bereits ein echter Treffer des Residuums (top-3 97 % → 95 %), bei 0.86
 * bleiben alle 36 von 37 stehen. e5 komprimiert Ähnlichkeiten stark — auch
 * thematisch verwandte Lücken-Fragen liegen über 0.86, und das ist in
 * Ordnung: Ein Vorschlag ist eine antippbare RÜCKFRAGE, keine falsche Zahl.
 * Die Schwelle hat genau eine Aufgabe, die sie belastbar erfüllt:
 * Kauderwelsch und thematisch Fremdes stummschalten, damit die Auswahl
 * etwas bedeutet, wenn sie erscheint.
 */
export const MIN_SCORE = 0.86;

/** Wie viele Klassen die Auswahl höchstens anbietet. */
export const MAX_VORSCHLAEGE = 3;

/** L2-normierten float-Vektor auf int8 quantisieren. */
export function quantisiere(vektor: readonly number[] | Float32Array): Int8Array {
  const q = new Int8Array(vektor.length);
  for (let i = 0; i < vektor.length; i += 1) {
    q[i] = Math.max(-127, Math.min(127, Math.round(vektor[i] * 127)));
  }
  return q;
}

/**
 * Kosinus zweier quantisierter Vektoren. Beide waren vor der Quantisierung
 * L2-normiert; die Norm wird trotzdem neu gerechnet, weil die Rundung sie
 * minimal verschiebt — sonst hinge der Score von der Rundungsrichtung ab.
 */
export function kosinus(a: QuantisierterVektor, b: QuantisierterVektor): number {
  let s = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    s += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return s / Math.sqrt(na * nb);
}

/**
 * kNN-3-Score einer Klasse: Mittel der drei ähnlichsten Paraphrasen.
 *
 * Gemessen gegen das Klassen-Zentrum und gegen kNN-1: Das Zentrum verliert
 * auf dem Residuum (86 % → 69 % top-1 auf dem Gesamtkorpus, und Lücken-Fragen
 * bekommen fast immer > 0.9, weil das Mittel vieler Paraphrasen alles
 * ähnlich macht); kNN-1 hängt an einer einzigen — womöglich unglücklichen —
 * Formulierung. Drei sind der gemessene Mittelweg.
 */
export function klassenScore(frage: QuantisierterVektor, klasse: SemantischeKlasse): number {
  let s1 = -1;
  let s2 = -1;
  let s3 = -1;
  for (const v of klasse.vektoren) {
    const s = kosinus(frage, v);
    if (s > s1) {
      s3 = s2;
      s2 = s1;
      s1 = s;
    } else if (s > s2) {
      s3 = s2;
      s2 = s;
    } else if (s > s3) {
      s3 = s;
    }
  }
  if (s1 < 0) return 0;
  if (s2 < 0) return s1;
  if (s3 < 0) return (s1 + s2) / 2;
  return (s1 + s2 + s3) / 3;
}

/**
 * Die Auswahl der Stufe 3: höchstens {@link MAX_VORSCHLAEGE} Klassen über
 * {@link MIN_SCORE}, beste zuerst. Leer heisst: auch semantisch nichts
 * Belastbares — die Fläche bleibt bei „noch nicht verstanden".
 */
export function semantischeVorschlaege(
  frage: QuantisierterVektor,
  klassen: readonly SemantischeKlasse[],
): SemantischerVorschlag[] {
  return klassen
    .filter((k) => !k.klasse.endsWith('.aktion'))
    .map((k) => ({ klasse: k.klasse, score: klassenScore(frage, k) }))
    .filter((v) => v.score >= MIN_SCORE)
    .sort((a, b) => (b.score === a.score ? a.klasse.localeCompare(b.klasse) : b.score - a.score))
    .slice(0, MAX_VORSCHLAEGE);
}

/** base64 → quantisierter Vektor (Gegenstück zum Fixture-Generator). */
export function vektorAusBase64(b64: string): Int8Array {
  const roh = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const q = new Int8Array(roh.length);
  for (let i = 0; i < roh.length; i += 1) {
    const byte = roh.charCodeAt(i);
    q[i] = byte > 127 ? byte - 256 : byte;
  }
  return q;
}
