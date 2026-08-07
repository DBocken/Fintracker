/**
 * Kern der intelligenten Kategorisierung — rein und ohne I/O.
 *
 * Lag zuvor mitten im 676-zeiligen `transaction-service.ts`; dadurch mussten
 * `lib/review-preview.ts` und `lib/automation-suggestions.ts` entgegen der
 * Schichtrichtung nach oben in `services/` importieren (AGENTS.md §3). Der
 * Service ruft die Funktionen jetzt von hier auf und behält nur das I/O.
 */
import type { Transaction, Category } from '@/types';
import { normalizeMerchantName } from '@/lib/merchant-normalization';
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

// Kern der intelligenten Kategorien: gelernte Regeln -> Filter-Matching -> Regex-Fallback.
// Liefert zusätzlich Confidence + erklärbare Gründe, damit die UI Vorschläge statt
// stiller Änderungen anbieten kann.
export function explainCategorization(
  transaction: Transaction,
  categories: Category[],
  learnedRules?: MerchantRule[]
): CategorizationResult {
  const normalizedPayee = normalizeMerchantName(transaction.payee);

  // Stufe 1: vom Nutzer gelernte Zuordnungen (höchste Priorität)
  if (learnedRules?.length && normalizedPayee) {
    // Die SPEZIFISCHSTE passende Regel gewinnt (längstes Pattern), nicht die
    // zuerst gespeicherte: sonst würde z. B. „aldi" eine Buchung fangen, für die
    // der Nutzer die genauere Regel „aldi süd tankstelle" angelegt hat.
    const rule = learnedRules.reduce<MerchantRule | null>((best, r) => {
      if (!r.merchant_pattern || !normalizedPayee.includes(r.merchant_pattern)) return best;
      if (!best || r.merchant_pattern.length > best.merchant_pattern.length) return r;
      return best;
    }, null);
    if (rule) {
      return {
        categoryId: rule.category_id,
        confidence: 0.95,
        reasons: [t('transactionService.learnedMerchantRule', '{merchant}').replace('{merchant}', rule.merchant_pattern)],
        source: 'merchant_rule',
      };
    }
  }

  // Stufe 2: Filter-Matching (Spezifität), inkl. normalisiertem Zahlungsempfänger
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

  // Stufe 3: generische Regex-Fallback-Regeln
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
  learnedRules?: MerchantRule[]
): string | null {
  return explainCategorization(transaction, categories, learnedRules).categoryId;
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
  learnedRules?: MerchantRule[]
): string | null {
  const result = explainCategorization(transaction, categories, learnedRules);
  return result.confidence >= MIN_SILENT_ASSIGN_CONFIDENCE ? result.categoryId : null;
}
