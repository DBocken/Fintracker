/**
 * Kern der intelligenten Kategorisierung — rein und ohne I/O.
 *
 * Lag zuvor mitten im 676-zeiligen `transaction-service.ts`; dadurch mussten
 * `lib/review-preview.ts` und `lib/automation-suggestions.ts` entgegen der
 * Schichtrichtung nach oben in `services/` importieren (AGENTS.md §3). Der
 * Service ruft die Funktionen jetzt von hier auf und behält nur das I/O.
 */
import type { Transaction, Category } from '@/types';
import { normalizeMerchantName, legacyNormalizeMerchantName } from '@/lib/merchant-normalization';
import type { LearnedCategoryModel } from '@/lib/category-model';
import { predictCategory } from '@/lib/category-model';
import { matchesKeyword } from '@/lib/keyword-match';
import { resolveAusgabenklasse } from '@/lib/analysis-data';
import { REGEX_FALLBACK_RULES } from '@/data/merchant-keywords';
import { t } from '@/i18n/serviceT';

/**
 * Vom Nutzer gelernte Zuordnung: ein normalisierter Händlername wird beim
 * nächsten Mal automatisch der angegebenen Kategorie zugeordnet (Stufe 1 der
 * Kategorisierung, siehe categorizeTransaction).
 */
export interface MerchantRule {
  id: string;
  user_id: string;
  merchant_pattern: string;
  category_id: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * Quelle einer Kategorisierungsentscheidung – für erklärbare Vorschläge.
 */
export type CategorizationSource =
  | 'merchant_rule'
  | 'category_filter'
  | 'learned_model'
  | 'regex_fallback'
  | 'none';

/**
 * Erklärbares Ergebnis der Kategorisierung. `confidence` ist eine reine Heuristik
 * (kein echtes Wahrscheinlichkeitsmodell) und sollte in der UI als Sicherheitsstufe
 * (hoch/mittel/niedrig) dargestellt werden, nicht als Prozentwert.
 */
export interface CategorizationResult {
  categoryId: string | null;
  confidence: number;
  reasons: string[];
  source: CategorizationSource;
}

/**
 * Zusatzwissen, das die Kaskade benutzen DARF, wenn der Aufrufer es hat.
 *
 * Bewusst ein Options-Objekt statt eines vierten Positionsparameters: Der
 * vierte Platz ist die letzte Gelegenheit, den Beutel einzuführen, ohne alle
 * Aufrufer ein zweites Mal anzufassen — danach kämen `allocations`,
 * `accountKontext` als fünfter und sechster Positionsparameter, und dann ist
 * es eine Umschreibung aller Aufrufstellen statt einer.
 */
export interface CategorizationContext {
  /** Aus den eigenen bestätigten Buchungen gelerntes Modell (WP-B). */
  model?: LearnedCategoryModel;
}

// Kern der intelligenten Kategorien: gelernte Regeln -> gelerntes Modell (sicher)
// -> Filter-Matching -> gelerntes Modell (unsicher) -> Regex-Fallback.
// Liefert zusätzlich Confidence + erklärbare Gründe, damit die UI Vorschläge statt
// stiller Änderungen anbieten kann.
export function explainCategorization(
  transaction: Transaction,
  categories: Category[],
  learnedRules?: MerchantRule[],
  context?: CategorizationContext
): CategorizationResult {
  const normalizedPayee = normalizeMerchantName(transaction.payee);

  // Das Modell hält Kategorie-IDs; eine inzwischen gelöschte Kategorie darf
  // nicht wiederauferstehen. Die Gültigkeitsprüfung läuft nur, wenn überhaupt
  // ein Modell da ist — sonst kostete sie in jeder Import-Schleife eine
  // Menge über alle Kategorien, für nichts.
  const modellTreffer = context?.model ? predictCategory(context.model, transaction) : null;
  const gueltigerModellTreffer =
    modellTreffer && categories.some((c) => c.id === modellTreffer.categoryId)
      ? modellTreffer
      : null;

  const modellErgebnis = (confidence: number): CategorizationResult => ({
    categoryId: gueltigerModellTreffer!.categoryId,
    confidence,
    reasons: [
      t('transactionService.learnedModel', '{count}|{tokens}')
        .replace('{count}', String(gueltigerModellTreffer!.support))
        .replace('{tokens}', gueltigerModellTreffer!.evidenz.join(', ')),
    ],
    source: 'learned_model',
  });

  // Stufe 1: vom Nutzer gelernte Zuordnungen (höchste Priorität) — eine
  // ausdrückliche Regel schlägt Statistik immer.
  if (learnedRules?.length && normalizedPayee) {
    // Die SPEZIFISCHSTE passende Regel gewinnt (längstes Pattern), nicht die
    // zuerst gespeicherte: sonst würde z. B. „aldi" eine Buchung fangen, für die
    // der Nutzer die genauere Regel „aldi süd tankstelle" angelegt hat.
    //
    // Das gespeicherte Muster wird beim Vergleich ERNEUT normalisiert.
    // `merchant_pattern` ist persistiert und stammt aus `normalizeMerchantName`
    // zum Zeitpunkt des Anlegens — eine spätere Verschärfung des
    // Normalisierers machte jede ältere Regel sonst still ungültig
    // („netflix.com" gespeichert, „netflix" heute normalisiert,
    // `includes` schlägt fehl). Kein Test wäre rot, kein Fehler im Log; die
    // gelernte Zuordnung hörte einfach auf zu wirken. Weil
    // `normalizeMerchantName` idempotent ist, führt das erneute Normalisieren
    // altes wie neues Muster auf dieselbe Form — deshalb braucht es dafür
    // KEINE Datenmigration.
    const musterVon = (r: MerchantRule) => normalizeMerchantName(r.merchant_pattern) || r.merchant_pattern;
    const passt = (heuhaufen: string) =>
      learnedRules.reduce<MerchantRule | null>((best, r) => {
        const muster = musterVon(r);
        if (!muster || !heuhaufen.includes(muster)) return best;
        if (!best || muster.length > musterVon(best).length) return r;
        return best;
      }, null);

    // Zweiter Versuch gegen die ALTE Normalisierung des Empfängers. Nur, wenn
    // der erste nichts fand — im Importlauf über tausende Buchungen zählt das.
    const rule = passt(normalizedPayee) ?? passt(legacyNormalizeMerchantName(transaction.payee));
    if (rule) {
      return {
        categoryId: rule.category_id,
        confidence: 0.95,
        reasons: [t('transactionService.learnedMerchantRule', '{merchant}').replace('{merchant}', rule.merchant_pattern)],
        source: 'merchant_rule',
      };
    }
  }

  // Stufe 2: gelerntes Modell, sofern alle drei Gates erfüllt sind.
  //
  // Dass 0.80 hier VOR dem Filter-Match mit 0.85 steht, ist Absicht: Die
  // Konfidenzzahlen ordnen nicht die Kaskade, sie beschreiben die Stärke des
  // Ergebnisses. Ein Kategorie-Filter-Treffer ist eine App-Voreinstellung; eine
  // aus Dutzenden eigenen bestätigten Entscheidungen gelernte Zuordnung ist
  // stärkere Evidenz. Ob sie still geschrieben werden darf, entscheidet
  // `sicher` (drei Gates in `category-model.ts`) — nicht diese Zahl.
  if (gueltigerModellTreffer?.sicher) {
    return modellErgebnis(0.8);
  }

  // Stufe 3: Filter-Matching (Spezifität), inkl. normalisiertem Zahlungsempfänger
  // Negative Beträge dürfen keine Einkommens-Kategorie treffen: eine Ausgabe (z. B.
  // eBay-Kauf) darf nicht als "Verkäufe"-Einnahme fehlkategorisiert werden. Positive
  // Beträge bleiben frei für Ausgaben-Kategorien (Erstattungen sind positive Buchungen
  // in einer Ausgaben-Kategorie).
  const byId = new Map(categories.map((c) => [c.id, c]));
  const isBlockedByDirection = (category: Category) =>
    transaction.amount < 0 && resolveAusgabenklasse(byId, category.id) === 'einkommen';

  let bestMatch: Category | null = null;
  let bestMatchedFilters: string[] = [];
  let bestSpecificity = 0;

  for (const category of categories) {
    if (isBlockedByDirection(category)) continue;
    const filters = (category.filters || []) as string[];
    const matches = filters.filter(
      (filter) =>
        matchesKeyword(transaction.payee || '', filter) ||
        matchesKeyword(transaction.description || '', filter) ||
        matchesKeyword(transaction.original_text || '', filter) ||
        matchesKeyword(normalizedPayee, filter),
    );

    if (matches.length > bestSpecificity) {
      bestMatch = category;
      bestMatchedFilters = matches;
      bestSpecificity = matches.length;
    }
  }

  if (bestMatch) {
    return {
      categoryId: bestMatch.id,
      confidence: bestSpecificity >= 2 ? 0.85 : 0.7,
      reasons: bestMatchedFilters.map((filter) => t('transactionService.matchedFilter', '{filter}').replace('{filter}', filter)),
      source: 'category_filter',
    };
  }

  // Stufe 4: gelerntes Modell ohne erfüllte Gates — 0.60 liegt UNTER
  // `MIN_SILENT_ASSIGN_CONFIDENCE`, erscheint also nur als Vorschlag in der
  // Coach-Inbox und wird nie still geschrieben.
  if (gueltigerModellTreffer) {
    return modellErgebnis(0.6);
  }

  // Stufe 5: generische Regex-Fallback-Regeln
  const haystack = `${normalizedPayee} ${transaction.description || ''} ${transaction.original_text || ''}`.toLowerCase();
  for (const rule of REGEX_FALLBACK_RULES) {
    if (rule.pattern.test(haystack)) {
      // Match ueber die stabile ID, nicht ueber den Anzeigenamen: der ist
      // umbenennbar und seit der Lokalisierung sprachabhaengig.
      const fallbackCategory = categories.find((c) => c.id === `local-cat-${rule.categorySlug}`);
      if (fallbackCategory && !isBlockedByDirection(fallbackCategory)) {
        return {
          categoryId: fallbackCategory.id,
          confidence: 0.55,
          reasons: [t('transactionService.fallbackRule', '{category}').replace('{category}', fallbackCategory.name)],
          source: 'regex_fallback',
        };
      }
    }
  }

  return { categoryId: null, confidence: 0, reasons: [], source: 'none' };
}

/**
 * Liefert nur die Kategorie-ID. Bleibt als dünner Wrapper über `explainCategorization`
 * erhalten, damit bestehende Aufrufer (CSV-Import, GoCardless-Sync, Receipt-Scan,
 * Recategorize) unverändert funktionieren.
 */
export function categorizeTransaction(
  transaction: Transaction,
  categories: Category[],
  learnedRules?: MerchantRule[],
  context?: CategorizationContext
): string | null {
  return explainCategorization(transaction, categories, learnedRules, context).categoryId;
}

/**
 * Mindest-Konfidenz für STILLE Zuweisungen (Import/Sync/Bulk-Recategorize).
 * Darunter (insb. Regex-Fallback 0,55) wird nichts geschrieben — die Buchung
 * bleibt unkategorisiert und erscheint als Vorschlag in der Coach-Inbox
 * („Automatisch, aber nie bevormundend": raten ja, still festschreiben nein).
 */
export const MIN_SILENT_ASSIGN_CONFIDENCE = 0.7;

/** Kategorie-ID nur bei ausreichender Konfidenz für stille Zuweisung. */
export function categorizeTransactionConfident(
  transaction: Transaction,
  categories: Category[],
  learnedRules?: MerchantRule[],
  context?: CategorizationContext
): string | null {
  const result = explainCategorization(transaction, categories, learnedRules, context);
  return result.confidence >= MIN_SILENT_ASSIGN_CONFIDENCE ? result.categoryId : null;
}
