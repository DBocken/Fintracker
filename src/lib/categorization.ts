/**
 * Kern der intelligenten Kategorisierung — rein und ohne I/O.
 *
 * Lag zuvor mitten im 676-zeiligen `transaction-service.ts`; dadurch mussten
 * `lib/review-preview.ts` und `lib/automation-suggestions.ts` entgegen der
 * Schichtrichtung nach oben in `services/` importieren (AGENTS.md §3). Der
 * Service ruft die Funktionen jetzt von hier auf und behält nur das I/O.
 *
 * **Zwei Aufrufformen, ein Kern.** {@link createCategorizer} baut den
 * Kategorie-Index EINMAL und kategorisiert danach beliebig viele Buchungen;
 * {@link explainCategorization} ist der Einzelfall darüber. Wer über Buchungen
 * schleift, nimmt die vorbereitete Form — sonst wächst die Arbeit mit
 * Buchungen × Kategorien statt mit Buchungen + Kategorien (AGENTS.md §3,
 * „Was vor der Schleife indiziert wird").
 */
import type { Transaction, Category } from '@/types';
import { normalizeMerchantName } from '@/lib/merchant-normalization';
import { matchesPreparedKeyword, prepareKeyword, type PreparedKeyword } from '@/lib/keyword-match';
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

/**
 * Kategorisierer mit vorbereitetem Kategorie-Index. Behandelt die übergebene
 * Kategorienliste als unveränderlich — wer Kategorien ändert, baut einen neuen
 * (in der App fällt das zusammen: react-query liefert bei jeder Änderung ein
 * neues Array).
 */
export interface Categorizer {
  /** Erklärbares Ergebnis inkl. Quelle, Confidence und Gründen. */
  explain(transaction: Transaction): CategorizationResult;
  /** Nur die Kategorie-ID. */
  categorize(transaction: Transaction): string | null;
  /** Kategorie-ID nur ab {@link MIN_SILENT_ASSIGN_CONFIDENCE}. */
  categorizeConfident(transaction: Transaction): string | null;
}

/**
 * Kategorie samt ihren Filtern — einmal gelesen und vorbereitet, nicht je
 * Buchung erneut. `label` ist der ungeänderte Filtertext für die Begründung,
 * `keyword` seine vorbereitete Form für den Vergleich.
 */
interface FilterableCategory {
  category: Category;
  filters: { label: string; keyword: PreparedKeyword }[];
}

/**
 * Baut den Kategorie-Index einmal auf und liefert einen Kategorisierer darüber.
 *
 * Drei Dinge hängen an der Kategorienliste und nicht an der Buchung; sie werden
 * deshalb hier erledigt und nicht je Buchung wiederholt:
 * 1. die Nachschlage-Map (`byId`) für die Hierarchie-Auflösung,
 * 2. die Menge der Einkommens-Kategorien (Richtungs-Guard, siehe unten) —
 *    das ist der teure Teil, denn dafür läuft je Kategorie die Elternkette
 *    hoch,
 * 3. die Kategorien MIT Filtern; die ohne können nie gewinnen (Spezifität 0)
 *    und werden gar nicht erst durchlaufen — die verbleibenden Filter werden
 *    dabei gleich in ihre Vergleichsform gebracht (`prepareKeyword`), statt bei
 *    jeder Paarung mit einer Buchung neu kleingeschrieben zu werden.
 */
export function createCategorizer(
  categories: Category[],
  learnedRules?: MerchantRule[],
): Categorizer {
  const byId = new Map(categories.map((c) => [c.id, c]));

  // Richtungs-Guard: Negative Beträge dürfen keine Einkommens-Kategorie treffen —
  // eine Ausgabe (z. B. eBay-Kauf) darf nicht als „Verkäufe"-Einnahme
  // fehlkategorisiert werden. Positive Beträge bleiben frei für
  // Ausgaben-Kategorien (Erstattungen sind positive Buchungen in einer
  // Ausgaben-Kategorie).
  const incomeCategoryIds = new Set<string>();
  const filterable: FilterableCategory[] = [];
  for (const category of categories) {
    if (resolveAusgabenklasse(byId, category.id) === 'einkommen') {
      incomeCategoryIds.add(category.id);
    }
    const rawFilters = (category.filters || []) as string[];
    if (rawFilters.length > 0) {
      filterable.push({
        category,
        filters: rawFilters.map((label) => ({ label, keyword: prepareKeyword(label) })),
      });
    }
  }

  // Regeln ohne Muster können nie greifen; einmal aussortieren statt je Buchung.
  const rules = (learnedRules || []).filter((r) => r.merchant_pattern);

  function explain(transaction: Transaction): CategorizationResult {
    const normalizedPayee = normalizeMerchantName(transaction.payee);
    // Die vier Textfelder einmal je Buchung kleinschreiben — nicht einmal je
    // Filter, von denen es Hunderte gibt.
    const haystacks = [
      transaction.payee || '',
      transaction.description || '',
      transaction.original_text || '',
      normalizedPayee,
    ].map((field) => field.toLowerCase());
    const isExpense = transaction.amount < 0;
    const isBlockedByDirection = (categoryId: string) =>
      isExpense && incomeCategoryIds.has(categoryId);

    // Stufe 1: vom Nutzer gelernte Zuordnungen (höchste Priorität)
    if (rules.length && normalizedPayee) {
      // Die SPEZIFISCHSTE passende Regel gewinnt (längstes Pattern), nicht die
      // zuerst gespeicherte: sonst würde z. B. „aldi" eine Buchung fangen, für die
      // der Nutzer die genauere Regel „aldi süd tankstelle" angelegt hat.
      let rule: MerchantRule | null = null;
      for (const candidate of rules) {
        if (!normalizedPayee.includes(candidate.merchant_pattern)) continue;
        if (!rule || candidate.merchant_pattern.length > rule.merchant_pattern.length) {
          rule = candidate;
        }
      }
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
    let bestMatch: Category | null = null;
    let bestMatchedFilters: string[] = [];
    let bestSpecificity = 0;

    for (const { category, filters } of filterable) {
      if (isBlockedByDirection(category.id)) continue;
      const matches = filters
        .filter(({ keyword }) => haystacks.some((haystack) => matchesPreparedKeyword(haystack, keyword)))
        .map(({ label }) => label);

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
        const fallbackCategory = byId.get(`local-cat-${rule.categorySlug}`);
        if (fallbackCategory && !isBlockedByDirection(fallbackCategory.id)) {
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

  return {
    explain,
    categorize: (transaction) => explain(transaction).categoryId,
    categorizeConfident: (transaction) => {
      const result = explain(transaction);
      return result.confidence >= MIN_SILENT_ASSIGN_CONFIDENCE ? result.categoryId : null;
    },
  };
}

/**
 * Kern der intelligenten Kategorien für EINE Buchung: gelernte Regeln →
 * Filter-Matching → Regex-Fallback. Liefert zusätzlich Confidence + erklärbare
 * Gründe, damit die UI Vorschläge statt stiller Änderungen anbieten kann.
 *
 * Für eine Schleife über Buchungen ist {@link createCategorizer} die richtige
 * Form — diese hier baut den Kategorie-Index bei JEDEM Aufruf neu.
 */
export function explainCategorization(
  transaction: Transaction,
  categories: Category[],
  learnedRules?: MerchantRule[]
): CategorizationResult {
  return createCategorizer(categories, learnedRules).explain(transaction);
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
