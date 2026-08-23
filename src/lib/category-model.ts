/**
 * Aus den EIGENEN bestätigten Buchungen gelernte Kategoriezuordnung —
 * die vierte Stufe der Kaskade in `categorization.ts`.
 *
 * Rein und ohne I/O (AGENTS.md §3): kein React, kein Speicher, kein Netz.
 * Bewusst reines TypeScript statt eines nachgeladenen Modells — die CSP
 * (`vercel.json`) erlaubt keine fremden Gewichte, ein Same-Origin-Modell
 * zählte gegen `bundle-size-budget.json` und würde bei jedem Nutzer geladen,
 * und für deutschen Kontoauszugstext existiert ohnehin kein fertiges Modell.
 * Die einzigen Labels, die es gibt, liegen auf dem Gerät.
 *
 * Verfahren: **multinomiales Naive Bayes in der Complement-Variante**. Gegen
 * logistische Regression entschieden, an dieser Datenlage gemessen:
 * - Training ist EIN Zähldurchlauf in geschlossener Form — kein Lernraten-,
 *   Epochen- oder Regularisierungs-Stellrad, das später niemand begründen kann.
 * - Deterministisch: gleiche Eingabe ⇒ bitgleich gleiches Modell. Nur so ist
 *   es überhaupt pinnbar. Multiklassen-LogReg per SGD ist reihenfolgeabhängig.
 * - Complement statt Standard, weil die Klassenverteilung stark unbalanciert
 *   ist (Lebensmittel vs. Versicherung) und Standard-NB dann zur häufigsten
 *   Klasse kippt.
 *
 * Der Preis von NB sind überkonfidente Posteriors. Deshalb wird die rohe
 * Posterior NIE als Konfidenz durchgereicht: Ob eine Vorhersage still
 * geschrieben werden darf, entscheiden die drei Gates in `predictCategory`
 * (`sicher`), nicht ihr Zahlenwert.
 */
import type { Transaction } from '@/types';
import type { MerchantRule } from '@/lib/categorization';
import { normalizeMerchantName } from '@/lib/merchant-normalization';

/** Mindestzahl bestätigter Beispiele in der vorhergesagten Kategorie (Gate 1). */
export const MIN_KLASSEN_SUPPORT = 12;

/** Ein Token muss so oft in der Klasse gesehen worden sein (Gate 2). */
export const MIN_EVIDENZ_SUPPORT = 3;

/** Kreuzvalidierte Präzision, ab der still geschrieben werden darf (Gate 3). */
export const MIN_KLASSEN_PRAEZISION = 0.9;

/** Abstand in log-Punkten zwischen bestem und zweitbestem Treffer (Gate 3). */
export const MIN_MARGE = 0.5;

/**
 * Gewicht einer Händlerregel im Training. Eine Regel ist eine ausdrückliche
 * Nutzerentscheidung („immer diese Kategorie") und wiegt deshalb schwerer als
 * eine einzelne bestätigte Buchung — aber nicht so schwer, dass sie den
 * Klassen-Support aus Gate 1 allein tragen könnte.
 */
const REGEL_GEWICHT = 3;

/** Laplace-Glättung. */
const ALPHA = 1;

export interface LearnedCategoryModel {
  /** Kategorie-ID → Anzahl bestätigter Trainingsbeispiele. */
  readonly klassenSupport: ReadonlyMap<string, number>;
  /** Token → Kategorie-ID → gewichtete Häufigkeit. */
  readonly tokenKlasse: ReadonlyMap<string, ReadonlyMap<string, number>>;
  /** Token → Gesamtgewicht über alle Klassen. */
  readonly tokenGesamt: ReadonlyMap<string, number>;
  /** Kategorie-ID → Summe aller Tokengewichte dieser Klasse. */
  readonly klassenGewicht: ReadonlyMap<string, number>;
  readonly gesamtGewicht: number;
  /** Kategorie-IDs, sortiert — nie Anzeigenamen (AGENTS.md §6). */
  readonly klassen: readonly string[];
  /** Wortschatzgröße für die Glättung. */
  readonly vokabular: number;
  /**
   * Kreuzvalidierte Präzision je Klasse. Leer, solange nicht bewertet wurde —
   * und dann greift Gate 3 nicht, also bleibt jede Vorhersage ein Vorschlag.
   */
  readonly klassenPraezision: ReadonlyMap<string, number>;
}

export interface CategoryPrediction {
  categoryId: string;
  /** Abstand zum zweitbesten Treffer in log-Punkten. */
  marge: number;
  /** Bestätigte Beispiele in dieser Klasse (Gate 1). */
  support: number;
  /** Häufigkeit des stärksten Belegtokens in dieser Klasse (Gate 2). */
  evidenzStaerke: number;
  /** Die drei stärksten Belegtokens — Grundlage der Begründung im UI. */
  evidenz: string[];
  /** Alle drei Gates erfüllt ⇒ darf still geschrieben werden. */
  sicher: boolean;
}

const LEERES_MODELL: LearnedCategoryModel = {
  klassenSupport: new Map(),
  tokenKlasse: new Map(),
  tokenGesamt: new Map(),
  klassenGewicht: new Map(),
  gesamtGewicht: 0,
  klassen: [],
  vokabular: 0,
  klassenPraezision: new Map(),
};

/** Tokens eines Textes: Kleinschreibung, ≥3 Zeichen, keine reinen Ziffernfolgen. */
function tokenize(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 3 && !/^\d+$/.test(w));
}

/**
 * Betragsband auf log-Skala. Grob gebändert mit Absicht: Der exakte Betrag
 * ist bei einer Handvoll Beobachtungen je Klasse Rauschen, die Größenordnung
 * dagegen trägt (ein 900-€-Dauerauftrag ist selten ein Bäckerbesuch).
 */
function betragsband(amount: number): string {
  const betrag = Math.abs(amount);
  if (betrag < 5) return 'band:0_5';
  if (betrag < 20) return 'band:5_20';
  if (betrag < 50) return 'band:20_50';
  if (betrag < 150) return 'band:50_150';
  if (betrag < 500) return 'band:150_500';
  if (betrag < 1500) return 'band:500_1500';
  return 'band:1500_';
}

/**
 * Merkmale einer Buchung. Das Herkunftspräfix ist der Kern: Dasselbe Wort im
 * Empfängernamen und im Verwendungszweck ist NICHT dasselbe Signal — „Miete"
 * als Empfänger ist ein Vermieter, „Miete" im Verwendungszweck kann auf jeder
 * Überweisung stehen.
 */
export function extractCategoryFeatures(transaction: Transaction): string[] {
  const payeeTokens = tokenize(normalizeMerchantName(transaction.payee) || transaction.payee);
  const merkmale: string[] = [];

  for (const token of payeeTokens) merkmale.push(`p:${token}`);
  // Bigramme des Empfängernamens: „aldi süd" trägt mehr als „aldi" + „süd".
  for (let i = 0; i + 1 < payeeTokens.length; i += 1) {
    merkmale.push(`p2:${payeeTokens[i]}_${payeeTokens[i + 1]}`);
  }
  for (const token of tokenize(transaction.description)) merkmale.push(`d:${token}`);
  for (const token of tokenize(transaction.original_text)) merkmale.push(`o:${token}`);

  merkmale.push(transaction.amount >= 0 ? 'dir:in' : 'dir:out');
  merkmale.push(betragsband(transaction.amount));

  return merkmale;
}

/** Zugewiesene Kategorie einer Buchung — Unterkategorie gewinnt, wie überall. */
function zugewieseneKategorie(transaction: Transaction): string | null {
  return transaction.subcategory_id ?? transaction.category_id ?? null;
}

function inkrement(map: Map<string, number>, key: string, um: number): void {
  map.set(key, (map.get(key) ?? 0) + um);
}

/**
 * Trainiert aus bestätigten Buchungen und Händlerregeln.
 *
 * **Nur `confirmed === true`.** Buchungen mit `auto_mapped` sind die eigene
 * Ausgabe der Kaskade; sie als Eingabe zu nehmen wäre ein Selbstbestätigungs-
 * kreis, der jeden Fehler der Stufen 2/3 verstärkt und ihn zusätzlich mit
 * höherer Konfidenz zurückgibt.
 *
 * Das Ergebnis trägt noch KEINE Klassen-Präzision und ist damit für stille
 * Zuweisungen gesperrt — die liefert `evaluateCategorizationModel` nach,
 * angeheftet über `withClassPrecision`.
 */
export function trainCategoryModel(
  transactions: readonly Transaction[],
  merchantRules: readonly MerchantRule[] = [],
): LearnedCategoryModel {
  const klassenSupport = new Map<string, number>();
  const tokenKlasse = new Map<string, Map<string, number>>();
  const tokenGesamt = new Map<string, number>();
  const klassenGewicht = new Map<string, number>();
  let gesamtGewicht = 0;

  const beobachte = (categoryId: string, merkmale: readonly string[], gewicht: number): void => {
    for (const merkmal of merkmale) {
      let proKlasse = tokenKlasse.get(merkmal);
      if (!proKlasse) {
        proKlasse = new Map<string, number>();
        tokenKlasse.set(merkmal, proKlasse);
      }
      inkrement(proKlasse, categoryId, gewicht);
      inkrement(tokenGesamt, merkmal, gewicht);
      inkrement(klassenGewicht, categoryId, gewicht);
      gesamtGewicht += gewicht;
    }
  };

  for (const transaction of transactions) {
    if (transaction.confirmed !== true) continue;
    if (transaction.is_transfer) continue;
    const categoryId = zugewieseneKategorie(transaction);
    if (!categoryId) continue;

    inkrement(klassenSupport, categoryId, 1);
    beobachte(categoryId, extractCategoryFeatures(transaction), 1);
  }

  // Händlerregeln sind ausdrückliche Nutzerentscheidungen und wiegen schwerer
  // als eine einzelne Buchung — zählen aber NICHT in `klassenSupport`, sonst
  // trüge eine einzige Regel Gate 1 und die Zwölf-Beispiele-Schwelle wäre
  // umgangen.
  for (const regel of merchantRules) {
    const tokens = tokenize(regel.merchant_pattern);
    if (!tokens.length) continue;
    const merkmale = tokens.map((t) => `p:${t}`);
    for (let i = 0; i + 1 < tokens.length; i += 1) {
      merkmale.push(`p2:${tokens[i]}_${tokens[i + 1]}`);
    }
    if (!klassenSupport.has(regel.category_id)) klassenSupport.set(regel.category_id, 0);
    beobachte(regel.category_id, merkmale, REGEL_GEWICHT);
  }

  return {
    klassenSupport,
    tokenKlasse,
    tokenGesamt,
    klassenGewicht,
    gesamtGewicht,
    klassen: [...klassenSupport.keys()].sort(),
    vokabular: tokenKlasse.size,
    klassenPraezision: new Map(),
  };
}

/** Heftet die kreuzvalidierte Präzision je Klasse an (Gate 3). */
export function withClassPrecision(
  model: LearnedCategoryModel,
  klassenPraezision: ReadonlyMap<string, number>,
): LearnedCategoryModel {
  return { ...model, klassenPraezision };
}

/**
 * Complement-Naive-Bayes-Wertung: Für jede Klasse wird bewertet, wie
 * unwahrscheinlich die Merkmale unter ALLEN ANDEREN Klassen sind. Das ist der
 * Kniff gegen unbalancierte Daten — die Gegenklasse einer seltenen Kategorie
 * ist groß und gut geschätzt, die Kategorie selbst wäre es nicht.
 */
function bewerte(model: LearnedCategoryModel, merkmale: readonly string[]): Map<string, number> {
  const wertung = new Map<string, number>();
  const nenner = ALPHA * Math.max(1, model.vokabular);

  for (const klasse of model.klassen) {
    const klasseGewicht = model.klassenGewicht.get(klasse) ?? 0;
    const gegenGewicht = model.gesamtGewicht - klasseGewicht;
    let summe = 0;

    for (const merkmal of merkmale) {
      const gesamt = model.tokenGesamt.get(merkmal);
      if (gesamt === undefined) continue; // unbekanntes Wort trägt nichts bei
      const inKlasse = model.tokenKlasse.get(merkmal)?.get(klasse) ?? 0;
      const imGegenteil = gesamt - inKlasse;
      // Je seltener das Merkmal AUSSERHALB der Klasse, desto stärker spricht
      // es für sie — deshalb das negative Vorzeichen.
      summe -= Math.log((imGegenteil + ALPHA) / (gegenGewicht + nenner));
    }

    wertung.set(klasse, summe);
  }

  return wertung;
}

/**
 * Sagt eine Kategorie voraus. `sicher` ist die einzige Aussage, an der eine
 * stille Zuweisung hängen darf — der Zahlenwert der Wertung ist es
 * ausdrücklich nicht.
 */
export function predictCategory(
  model: LearnedCategoryModel,
  transaction: Transaction,
): CategoryPrediction | null {
  if (!model.klassen.length) return null;

  const merkmale = extractCategoryFeatures(transaction);
  const bekannte = merkmale.filter((m) => model.tokenGesamt.has(m));
  // Richtung und Betragsband allein sind kein Beleg — jede Buchung hat sie.
  if (!bekannte.some((m) => !m.startsWith('dir:') && !m.startsWith('band:'))) return null;

  const wertung = bewerte(model, merkmale);
  const sortiert = [...wertung.entries()].sort((a, b) =>
    b[1] === a[1] ? a[0].localeCompare(b[0]) : b[1] - a[1],
  );
  if (!sortiert.length) return null;

  const [categoryId, beste] = sortiert[0];
  const marge = sortiert.length > 1 ? beste - sortiert[1][1] : Number.POSITIVE_INFINITY;

  // Belegtokens: die in DIESER Klasse am häufigsten gesehenen Merkmale der
  // Buchung — und nur Wörter, keine Pseudotokens. Ein „dir:out" erklärt nichts.
  const belege = bekannte
    .filter((m) => m.startsWith('p:') || m.startsWith('d:') || m.startsWith('o:'))
    .map((m) => ({ wort: m.slice(2), haeufigkeit: model.tokenKlasse.get(m)?.get(categoryId) ?? 0 }))
    .filter((b) => b.haeufigkeit > 0)
    .sort((a, b) => (b.haeufigkeit === a.haeufigkeit ? a.wort.localeCompare(b.wort) : b.haeufigkeit - a.haeufigkeit));

  const support = model.klassenSupport.get(categoryId) ?? 0;
  const evidenzStaerke = belege[0]?.haeufigkeit ?? 0;
  const praezision = model.klassenPraezision.get(categoryId);

  const sicher =
    support >= MIN_KLASSEN_SUPPORT &&
    evidenzStaerke >= MIN_EVIDENZ_SUPPORT &&
    marge >= MIN_MARGE &&
    praezision !== undefined &&
    praezision >= MIN_KLASSEN_PRAEZISION;

  return {
    categoryId,
    marge,
    support,
    evidenzStaerke,
    evidenz: belege.slice(0, 3).map((b) => b.wort),
    sicher,
  };
}

/** Ein Modell ohne Klassen — für Aufrufer, die keins haben. */
export function emptyCategoryModel(): LearnedCategoryModel {
  return LEERES_MODELL;
}
