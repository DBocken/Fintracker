/**
 * Intent-Klassifikator des Frage-Routers — Router-Stufe 2 (WP-F.4).
 *
 * Complement Naive Bayes über Subword-Merkmale (Zeichen-3–5-Gramme plus
 * Wort-Token). Die Subword-Zerlegung ist der Kern: „werkstadt" teilt fast
 * alle Gramme mit „werkstatt", „einsparren" mit „einsparen" — die 25
 * Tippfehler-Fragen des Korpus brauchen kein Wörterbuch, sie zerfallen von
 * selbst richtig.
 *
 * BEWUSST eigenständig statt einer Extraktion aus `category-model.ts`
 * (Abweichung vom Plan, begründet): Dessen NB-Kern ist mit seiner Domäne
 * verwachsen — Herkunftspräfixe, drei Gates, Belegtokens, Klassen-Präzision.
 * Eine erzwungene Generalisierung hätte das bewährte, gemessene Modell
 * destabilisiert, um ~30 Zeilen Zählmathematik zu teilen. Die Mathematik ist
 * hier dieselbe (Complement-Wertung, Laplace-Glättung, deterministische
 * Sortierung), nachgewiesen durch dieselbe Testform.
 *
 * **Trainiert wird aus kuratierten Paraphrasen** (`data/paraphrases/`, je
 * Sprache) **plus den lokal bestätigten Zuordnungen des Nutzers** (WP-F.5) —
 * NIE aus dem Eval-Korpus: Der ist der Test, und wer auf dem Test trainiert,
 * misst Auswendiglernen statt Verstehen.
 *
 * Die Sonderklasse `LUECKE_KLASSE` ist die wichtigste: Sie lernt, wie
 * UNBEANTWORTBARE Fragen klingen (Szenarien, Beratung, fehlende
 * Datengrundlage), damit die Stufe 2 nicht nur besser trifft, sondern auch
 * besser SCHWEIGT. Wie überall gilt: Der Klassifikator schlägt vor, die
 * Slots validiert der deterministische Matcher, `antwort()` inferiert nie.
 */

/** Klassenname für „das kann keine Funktion seriös beantworten". */
export const LUECKE_KLASSE = '__luecke__';

const ALPHA = 1;

export interface IntentBeispiel {
  /** Eintrags-ID oder {@link LUECKE_KLASSE}. */
  klasse: string;
  text: string;
  /** Zusatzgewicht (bestätigte Nutzer-Zuordnungen wiegen schwerer). */
  gewicht?: number;
}

export interface IntentModel {
  readonly klassen: readonly string[];
  readonly merkmalKlasse: ReadonlyMap<string, ReadonlyMap<string, number>>;
  readonly merkmalGesamt: ReadonlyMap<string, number>;
  readonly klassenGewicht: ReadonlyMap<string, number>;
  readonly gesamtGewicht: number;
  readonly vokabular: number;
}

export interface IntentPrediction {
  klasse: string;
  /** Log-Abstand zum Zweitplatzierten. */
  marge: number;
}

function normalisiere(text: string): string {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss');
}

/**
 * Merkmale eines Satzes: Wort-Token plus Zeichen-3–5-Gramme je Wort (mit
 * Randmarken, damit Wortanfang und -ende unterscheidbar bleiben). Ziffern
 * werden auf `0` gefaltet — „5000" und „3000" stellen dieselbe Frage.
 */
export function intentMerkmale(text: string): string[] {
  const merkmale: string[] = [];
  const worte = normalisiere(text)
    .replace(/\d/g, '0')
    .split(/[^a-z0]+/)
    .filter((w) => w.length >= 2);

  for (const wort of worte) {
    merkmale.push(`w:${wort}`);
    const markiert = `^${wort}$`;
    for (const n of [3, 4, 5]) {
      for (let i = 0; i + n <= markiert.length; i += 1) {
        merkmale.push(`g:${markiert.slice(i, i + n)}`);
      }
    }
  }
  return merkmale;
}

export function trainIntentModel(beispiele: readonly IntentBeispiel[]): IntentModel {
  const merkmalKlasse = new Map<string, Map<string, number>>();
  const merkmalGesamt = new Map<string, number>();
  const klassenGewicht = new Map<string, number>();
  let gesamtGewicht = 0;

  for (const beispiel of beispiele) {
    const gewicht = beispiel.gewicht ?? 1;
    for (const merkmal of intentMerkmale(beispiel.text)) {
      let proKlasse = merkmalKlasse.get(merkmal);
      if (!proKlasse) {
        proKlasse = new Map<string, number>();
        merkmalKlasse.set(merkmal, proKlasse);
      }
      proKlasse.set(beispiel.klasse, (proKlasse.get(beispiel.klasse) ?? 0) + gewicht);
      merkmalGesamt.set(merkmal, (merkmalGesamt.get(merkmal) ?? 0) + gewicht);
      klassenGewicht.set(beispiel.klasse, (klassenGewicht.get(beispiel.klasse) ?? 0) + gewicht);
      gesamtGewicht += gewicht;
    }
  }

  return {
    klassen: [...klassenGewicht.keys()].sort(),
    merkmalKlasse,
    merkmalGesamt,
    klassenGewicht,
    gesamtGewicht,
    vokabular: merkmalKlasse.size,
  };
}

/**
 * Complement-Wertung: Wie unwahrscheinlich sind die Merkmale unter allen
 * ANDEREN Klassen? Dieselbe Rechnung wie im Kategorienmodell — robust gegen
 * unbalancierte Klassen (die Lücken-Klasse ist zwangsläufig die größte).
 */
export function predictIntent(model: IntentModel, text: string): IntentPrediction | null {
  if (model.klassen.length < 2) return null;

  const merkmale = intentMerkmale(text).filter((m) => model.merkmalGesamt.has(m));
  if (merkmale.length === 0) return null;

  const nenner = ALPHA * Math.max(1, model.vokabular);
  const wertung: [string, number][] = model.klassen.map((klasse) => {
    const gegenGewicht = model.gesamtGewicht - (model.klassenGewicht.get(klasse) ?? 0);
    let summe = 0;
    for (const merkmal of merkmale) {
      const gesamt = model.merkmalGesamt.get(merkmal) ?? 0;
      const inKlasse = model.merkmalKlasse.get(merkmal)?.get(klasse) ?? 0;
      summe -= Math.log((gesamt - inKlasse + ALPHA) / (gegenGewicht + nenner));
    }
    return [klasse, summe];
  });

  wertung.sort((a, b) => (b[1] === a[1] ? a[0].localeCompare(b[0]) : b[1] - a[1]));
  // Normiert auf die Merkmalszahl, damit die Marge über kurze und lange
  // Fragen vergleichbar bleibt — sonst hinge die Schwelle an der Satzlänge.
  const marge = (wertung[0][1] - wertung[1][1]) / merkmale.length;
  return { klasse: wertung[0][0], marge };
}
