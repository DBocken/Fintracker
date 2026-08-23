/**
 * Misst, ob die gelernte Zuordnung (`category-model.ts`) die Kaskade
 * tatsächlich verbessert — und liefert die Klassen-Präzision, an der Gate 3
 * hängt.
 *
 * Warum überhaupt gemessen wird: „Ein Test je Feature ist das Minimum, aber
 * nicht dasselbe wie ‚wird rot, wenn das Feature bricht'" (AGENTS.md §5). Ein
 * Klassifikator, der nur „funktioniert", kann trotzdem still falsch schreiben.
 * Die entscheidende Zahl ist deshalb nicht die Trefferquote, sondern die
 * **Präzision oberhalb der Schwelle**: wie oft eine Zuordnung, die still
 * geschrieben würde, danebenliegt.
 *
 * Zwei Aufteilungen, weil eine allein täuscht:
 * - **stratifiziert, 5-fach** — jede Klasse ist in jedem Fold vertreten.
 * - **chronologisch** (älteste 80 % trainieren, jüngste 20 % testen), weil
 *   zufälliges Splitten bei wiederkehrenden Händlern optimistisch verzerrt:
 *   derselbe Lidl-Einkauf läge sonst in Trainings- UND Testmenge.
 *
 * Rein und ohne I/O (AGENTS.md §3).
 */
import type { Category, Transaction } from '@/types';
import type { MerchantRule } from '@/lib/categorization';
import { explainCategorization, MIN_SILENT_ASSIGN_CONFIDENCE } from '@/lib/categorization';
import type { LearnedCategoryModel } from '@/lib/category-model';
import {
  trainCategoryModel,
  withClassPrecision,
  predictCategory,
  MIN_KLASSEN_SUPPORT,
} from '@/lib/category-model';

/** Anzahl der Folds der stratifizierten Kreuzvalidierung. */
const FOLDS = 5;

export interface VarianteErgebnis {
  /** Buchungen mit einem Vorschlag oberhalb der Schwelle für stille Zuweisung. */
  oberhalbSchwelle: number;
  /** Davon richtig. */
  richtig: number;
  /** Anteil der Buchungen, die überhaupt einen sicheren Vorschlag bekamen. */
  abdeckung: number;
  /** Anteil richtiger unter den sicheren Vorschlägen — die entscheidende Zahl. */
  praezision: number;
}

export interface CategoryModelReport {
  /** Bestätigte Buchungen, die für die Bewertung taugten. */
  bewertet: number;
  /** Nur die Kaskade (heutiger Stand). */
  ohneModell: VarianteErgebnis;
  /** Kaskade plus gelernte Stufe. */
  mitModell: VarianteErgebnis;
  /** Dieselbe Messung mit chronologischem Schnitt. */
  chronologisch: { ohneModell: VarianteErgebnis; mitModell: VarianteErgebnis } | null;
  /**
   * Präzision je Klasse — Eingabe für Gate 3. Klassen unter
   * `MIN_KLASSEN_SUPPORT` werden GAR NICHT ausgewiesen: Eine Präzision aus
   * zwei Beispielen ist keine Auskunft, sondern eine Zufallszahl.
   */
  klassenPraezision: Map<string, number>;
}

function zugewieseneKategorie(transaction: Transaction): string | null {
  return transaction.subcategory_id ?? transaction.category_id ?? null;
}

/**
 * Präzision je Klasse — die Eingabe für Gate 3, und NUR die.
 *
 * Bewusst getrennt von `evaluateCategorizationModel`: Gate 3 fragt „wenn das
 * MODELL diese Kategorie sagt, wie oft stimmt das?". Dafür genügt eine
 * Kreuzvalidierung über `predictCategory` allein. Die volle Kaskade
 * mitlaufen zu lassen kostete nachgemessen 1,4 s bei 5000 Buchungen (die
 * Stichwort-Schleife über alle Kategorien pro Probe, zweimal je Fold) — das
 * ist für den Rechenschaftsbericht in den Einstellungen in Ordnung, für den
 * Import- und Recategorize-Pfad nicht.
 *
 * Innerhalb der Kreuzvalidierung sind die Gates 1 und 2 aktiv, Gate 3 ist es
 * naturgemäß nicht — es ist ja gerade das Messziel. Gemessen wird damit der
 * ungünstigere Fall: die Präzision OHNE den Schutz, den Gate 3 später gibt.
 */
export function computeClassPrecision(
  transactions: readonly Transaction[],
  merchantRules: readonly MerchantRule[] = [],
): Map<string, number> {
  const proben = bewertbare(transactions);
  const praezision = new Map<string, number>();
  if (proben.length < FOLDS * 2) return praezision;

  const folds = stratifizierteFolds(proben);
  const jeKlasse = new Map<string, { oberhalb: number; richtig: number }>();

  for (let fold = 0; fold < FOLDS; fold += 1) {
    const training = proben.filter((_, i) => folds[i] !== fold);
    const test = proben.filter((_, i) => folds[i] === fold);
    if (!training.length || !test.length) continue;

    const rohModell = trainCategoryModel(training, merchantRules);
    const modell = withClassPrecision(rohModell, new Map(rohModell.klassen.map((k) => [k, 1])));

    for (const probe of test) {
      const erwartet = zugewieseneKategorie(probe);
      if (!erwartet) continue;
      const treffer = predictCategory(modell, probe);
      if (!treffer?.sicher) continue;
      const eintrag = jeKlasse.get(treffer.categoryId) ?? { oberhalb: 0, richtig: 0 };
      eintrag.oberhalb += 1;
      if (treffer.categoryId === erwartet) eintrag.richtig += 1;
      jeKlasse.set(treffer.categoryId, eintrag);
    }
  }

  for (const [klasse, { oberhalb, richtig }] of jeKlasse) {
    // Klassen mit dünner Datenlage gar nicht erst ausweisen: Eine Präzision
    // aus zwei Beobachtungen ist eine Zufallszahl, und Gate 3 nähme sie für
    // bare Münze.
    if (oberhalb < MIN_KLASSEN_SUPPORT) continue;
    praezision.set(klasse, richtig / oberhalb);
  }

  return praezision;
}

/**
 * Ein einsatzbereites Modell: trainiert plus kreuzvalidierte Klassen-Präzision.
 * Das ist die Form, die die Kaskade als `context.model` erwartet — ohne die
 * Präzision bleibt jede Vorhersage ein Vorschlag (Gate 3).
 */
export function buildCategoryModel(
  transactions: readonly Transaction[],
  merchantRules: readonly MerchantRule[] = [],
): LearnedCategoryModel {
  return withClassPrecision(
    trainCategoryModel(transactions, merchantRules),
    computeClassPrecision(transactions, merchantRules),
  );
}

/** Bestätigte Buchungen mit Kategorie — die einzige Wahrheit, die es gibt. */
function bewertbare(transactions: readonly Transaction[]): Transaction[] {
  return transactions.filter(
    (t) => t.confirmed === true && !t.is_transfer && zugewieseneKategorie(t) !== null,
  );
}

/**
 * Stratifizierte Fold-Zuteilung: je Klasse reihum. Deterministisch (kein
 * Zufall), damit derselbe Datensatz dieselbe Bewertung ergibt — sonst wäre
 * die Zahl in den Einstellungen bei jedem Öffnen eine andere.
 */
function stratifizierteFolds(proben: readonly Transaction[]): number[] {
  const zaehlerJeKlasse = new Map<string, number>();
  return proben.map((probe) => {
    const klasse = zugewieseneKategorie(probe) ?? '';
    const n = zaehlerJeKlasse.get(klasse) ?? 0;
    zaehlerJeKlasse.set(klasse, n + 1);
    return n % FOLDS;
  });
}

interface Treffer {
  vorhergesagt: string | null;
  erwartet: string;
}

function auswerten(treffer: readonly Treffer[]): VarianteErgebnis {
  const oberhalb = treffer.filter((t) => t.vorhergesagt !== null);
  const richtig = oberhalb.filter((t) => t.vorhergesagt === t.erwartet).length;
  return {
    oberhalbSchwelle: oberhalb.length,
    richtig,
    abdeckung: treffer.length ? oberhalb.length / treffer.length : 0,
    praezision: oberhalb.length ? richtig / oberhalb.length : 0,
  };
}

/**
 * Wendet die Kaskade an und liefert die Kategorie NUR, wenn sie still
 * geschrieben würde. Genau das ist die Frage, die die Präzision beantworten
 * soll — ein Vorschlag, den der Nutzer noch bestätigt, kann nicht schaden.
 */
function stillGeschrieben(
  transaction: Transaction,
  categories: readonly Category[],
  rules: readonly MerchantRule[],
  model: LearnedCategoryModel | undefined,
): string | null {
  const ergebnis = explainCategorization(
    transaction,
    categories as Category[],
    rules as MerchantRule[],
    { model },
  );
  return ergebnis.confidence >= MIN_SILENT_ASSIGN_CONFIDENCE ? ergebnis.categoryId : null;
}

/**
 * Trainiert auf `training` und bewertet auf `test` — einmal ohne, einmal mit
 * gelernter Stufe. `praezisionFuerGate` erlaubt es, die Gates im Testlauf
 * überhaupt greifen zu lassen: In der Kreuzvalidierung ist die Präzision
 * naturgemäß noch nicht bekannt, deshalb wird hier optimistisch angenommen
 * und die tatsächliche Präzision AUS dem Ergebnis abgeleitet.
 */
function foldLauf(
  training: readonly Transaction[],
  test: readonly Transaction[],
  categories: readonly Category[],
  rules: readonly MerchantRule[],
): { ohne: Treffer[]; mit: Treffer[] } {
  const rohModell = trainCategoryModel(training, rules);
  // Gate 3 kann im Fold nicht auf eine gemessene Präzision zurückgreifen —
  // sie ist ja gerade das Messziel. Für die Messung wird sie deshalb für alle
  // Klassen erfüllt gesetzt; die Gates 1 und 2 wirken unverändert. Das misst
  // bewusst den ungünstigsten Fall: die Präzision OHNE den Schutz von Gate 3.
  const modell = withClassPrecision(
    rohModell,
    new Map(rohModell.klassen.map((k) => [k, 1])),
  );

  const ohne: Treffer[] = [];
  const mit: Treffer[] = [];

  for (const probe of test) {
    const erwartet = zugewieseneKategorie(probe);
    if (!erwartet) continue;
    // Die Testbuchung darf nicht als „bestätigt" in die Kaskade gehen — sie
    // soll behandelt werden wie eine frisch importierte.
    const frisch: Transaction = { ...probe, category_id: null, subcategory_id: null, confirmed: false, auto_mapped: false };
    ohne.push({ vorhergesagt: stillGeschrieben(frisch, categories, rules, undefined), erwartet });
    mit.push({ vorhergesagt: stillGeschrieben(frisch, categories, rules, modell), erwartet });
  }

  return { ohne, mit };
}

/**
 * Führt die Bewertung durch. Gibt `null`-artige Nullwerte zurück, wenn zu
 * wenig bestätigte Buchungen vorliegen — dann trägt das Modell ohnehin nichts
 * bei und eine Zahl anzugeben wäre eine Behauptung ohne Grundlage.
 */
export function evaluateCategorizationModel(
  transactions: readonly Transaction[],
  categories: readonly Category[],
  merchantRules: readonly MerchantRule[] = [],
): CategoryModelReport {
  const proben = bewertbare(transactions);
  const leer: VarianteErgebnis = { oberhalbSchwelle: 0, richtig: 0, abdeckung: 0, praezision: 0 };

  if (proben.length < FOLDS * 2) {
    return {
      bewertet: proben.length,
      ohneModell: leer,
      mitModell: leer,
      chronologisch: null,
      klassenPraezision: new Map(),
    };
  }

  const folds = stratifizierteFolds(proben);
  const alleOhne: Treffer[] = [];
  const alleMit: Treffer[] = [];

  for (let fold = 0; fold < FOLDS; fold += 1) {
    const training = proben.filter((_, i) => folds[i] !== fold);
    const test = proben.filter((_, i) => folds[i] === fold);
    if (!training.length || !test.length) continue;
    const { ohne, mit } = foldLauf(training, test, categories, merchantRules);
    alleOhne.push(...ohne);
    alleMit.push(...mit);
  }

  // Präzision je Klasse aus der Kreuzvalidierung — gezählt wird über die
  // VORHERGESAGTE Klasse, denn Gate 3 fragt: „Wenn das Modell diese Kategorie
  // sagt, wie oft stimmt das?"
  const jeKlasse = new Map<string, { oberhalb: number; richtig: number }>();
  for (const treffer of alleMit) {
    if (!treffer.vorhergesagt) continue;
    const eintrag = jeKlasse.get(treffer.vorhergesagt) ?? { oberhalb: 0, richtig: 0 };
    eintrag.oberhalb += 1;
    if (treffer.vorhergesagt === treffer.erwartet) eintrag.richtig += 1;
    jeKlasse.set(treffer.vorhergesagt, eintrag);
  }

  const klassenPraezision = new Map<string, number>();
  for (const [klasse, { oberhalb, richtig }] of jeKlasse) {
    // Klassen mit dünner Datenlage gar nicht erst ausweisen: Eine Präzision
    // aus zwei Beobachtungen ist eine Zufallszahl, und Gate 3 würde sie für
    // bare Münze nehmen.
    if (oberhalb < MIN_KLASSEN_SUPPORT) continue;
    klassenPraezision.set(klasse, richtig / oberhalb);
  }

  return {
    bewertet: proben.length,
    ohneModell: auswerten(alleOhne),
    mitModell: auswerten(alleMit),
    chronologisch: chronologischerSchnitt(proben, categories, merchantRules),
    klassenPraezision,
  };
}

/** Älteste 80 % trainieren, jüngste 20 % testen. */
function chronologischerSchnitt(
  proben: readonly Transaction[],
  categories: readonly Category[],
  merchantRules: readonly MerchantRule[],
): { ohneModell: VarianteErgebnis; mitModell: VarianteErgebnis } | null {
  const sortiert = [...proben].sort((a, b) => a.date.localeCompare(b.date));
  const schnitt = Math.floor(sortiert.length * 0.8);
  if (schnitt < 1 || schnitt >= sortiert.length) return null;

  const { ohne, mit } = foldLauf(
    sortiert.slice(0, schnitt),
    sortiert.slice(schnitt),
    categories,
    merchantRules,
  );
  return { ohneModell: auswerten(ohne), mitModell: auswerten(mit) };
}
