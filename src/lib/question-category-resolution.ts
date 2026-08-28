/**
 * Abstrakte Begriffe auf eine Kategorie abbilden — der Kern der
 * Chat-Bedienung.
 *
 * Wer „für essen" tippt, meint seine Kategorie „Essen & Trinken", ohne sie
 * beim Namen zu nennen. Ein reiner Namensvergleich kann das prinzipiell nicht:
 * Er verlangt, dass der GETIPPTE Text den Kategorienamen enthält — und ein
 * abstrakterer Begriff ist per Definition kürzer als der Name.
 *
 * **Aufgelöst wird über dieselbe Engine, die Buchungen kategorisiert**
 * (`explainCategorization`). Damit stehen alle drei Wissensquellen zur
 * Verfügung, die die App ohnehin pflegt:
 *
 * 1. die **kuratierten deutschen Stichwörter** je Unterkategorie
 *    (`data/merchant-keywords.ts` — „tanken", „parken", „pizzeria")
 * 2. die **eigenen Händlerregeln** des Nutzers
 * 3. der aus den eigenen bestätigten Buchungen **gelernte Klassifikator**
 *    (WP-B) — er kennt „Zurmiegel Kontor", das in keinem Katalog steht
 *
 * Der Gewinn dieser Bauform: Die Chat-Erkennung verbessert sich automatisch
 * mit, wenn die Kategorisierung besser wird. Eine zweite, eigene
 * Begriffstabelle nur für den Chat würde dagegen sofort auseinanderlaufen.
 *
 * Ohne ausreichende Sicherheit wird NICHTS zugeordnet — die Fläche fragt dann
 * nach. Eine falsche Kategorie ist eine falsche Zahl.
 */
import type { Category, Transaction } from '@/types';
import type { CategorizationContext, CategorizationSource, MerchantRule } from '@/lib/categorization';
import { explainCategorization } from '@/lib/categorization';
import { asTransactionId } from '@/lib/ids';

/**
 * Mindest-Sicherheit für eine Zuordnung aus Freitext.
 *
 * Bewusst der Regex-Fallback-Wert (0,55) als Untergrenze: Er ist die
 * schwächste Aussage, die die Kaskade überhaupt trifft. Alles darunter gibt
 * es nicht — `explainCategorization` liefert dann `none`.
 */
export const MIN_TEXT_ZUORDNUNG = 0.55;

/**
 * Wörter eines Kategorienamens, die als Suchbegriff taugen.
 *
 * Mindestens vier Zeichen: „und", „amp" und Ähnliches aus „Essen & Trinken"
 * sind keine Begriffe, sondern Bindeglieder — sie würden jede Frage auf die
 * erstbeste Kategorie ziehen.
 */
function namensworte(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 4);
}

/**
 * Zuordnung über ein WORT des Kategorienamens.
 *
 * Die Kaskade kann das prinzipiell nicht: Sie vergleicht ausschliesslich gegen
 * die Stichwörter einer Kategorie, und Hauptkategorien tragen laut Taxonomie
 * gar keine („Die Keywords liegen ausschliesslich auf der
 * Unterkategorie-Ebene"). „Essen & Trinken" wäre damit über seinen eigenen
 * Namen unerreichbar.
 *
 * Bewusst WORTWEISE und nicht als Teilzeichenkette: „ess" soll nicht
 * „Essen & Trinken" treffen, und „auto" nicht „Autoversicherung", wenn der
 * Nutzer das Auto meint. Bei Gleichstand zwischen zwei Kategorien wird NICHT
 * geraten — dann übernimmt die Kaskade, und findet auch sie nichts, fragt die
 * Fläche nach.
 */
function ausKategorienamen(text: string, categories: Category[]): KategorieAusText | null {
  const gefragte = new Set(namensworte(text));
  if (gefragte.size === 0) return null;

  let beste: { category: Category; treffer: number } | null = null;
  let mehrdeutig = false;

  for (const category of categories) {
    const treffer = namensworte(category.name).filter((w) => gefragte.has(w)).length;
    if (treffer === 0) continue;
    if (!beste || treffer > beste.treffer) {
      beste = { category, treffer };
      mehrdeutig = false;
    } else if (treffer === beste.treffer && category.id !== beste.category.id) {
      mehrdeutig = true;
    }
  }

  if (!beste || mehrdeutig) return null;
  return { categoryId: beste.category.id, confidence: 0.9, source: 'category_name' };
}

export interface KategorieAusText {
  categoryId: string;
  confidence: number;
  /**
   * Worauf die Zuordnung beruht — die Fläche kann es benennen.
   * `category_name` gibt es nur hier: Die Kaskade kennt diese Quelle nicht.
   */
  source: CategorizationSource | 'category_name';
}

/**
 * Ordnet einen Freitext-Ausschnitt einer Kategorie zu.
 *
 * `amount: 0` ist Absicht: Der Richtungs-Guard der Kaskade (negative Beträge
 * treffen keine Einkommens-Kategorie) gilt für BUCHUNGEN. Eine Frage hat keine
 * Richtung — „wieviel habe ich mit Gehalt eingenommen" muss Gehalt treffen
 * dürfen.
 */
export function resolveKategorieAusText(
  text: string,
  categories: Category[],
  learnedRules: MerchantRule[] = [],
  context?: CategorizationContext,
): KategorieAusText | null {
  const gesucht = text.trim();
  if (!gesucht) return null;

  const alsBuchung: Transaction = {
    id: asTransactionId('frage'),
    date: '1970-01-01',
    amount: 0,
    payee: gesucht,
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: false,
  };

  // Der Name zuerst: Nennt jemand seine Kategorie beim Wort, ist das die
  // stärkste Aussage, die es gibt — stärker als jedes Stichwort.
  const ausNamen = ausKategorienamen(gesucht, categories);
  if (ausNamen) return ausNamen;

  const ergebnis = explainCategorization(alsBuchung, categories, learnedRules, context);
  if (!ergebnis.categoryId || ergebnis.confidence < MIN_TEXT_ZUORDNUNG) return null;

  return {
    categoryId: ergebnis.categoryId,
    confidence: ergebnis.confidence,
    source: ergebnis.source,
  };
}
