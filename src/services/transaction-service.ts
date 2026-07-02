import type { Transaction, Category, UserSettings, HierarchicalCategory, Rhythmus } from '../types';
import { transactionStorage } from './transaction-storage-service';
import {
  getLocalCategories,
  saveLocalCategory,
  updateLocalCategory,
  getLocalUserSettings,
  updateLocalUserSettings,
  backfillAusgabenklasse,
} from './local-settings-service';
import { normalizeMerchantName } from './merchant-normalization';
import { REGEX_FALLBACK_RULES } from '../data/merchant-keywords';
import { getMerchantRules, upsertMerchantRule, type MerchantRule } from './merchant-rules-service';
import { parseGermanNumber } from '../lib/money';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function parseGermanDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  const cleanDate = dateStr.trim();

  const germanMatch = cleanDate.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (germanMatch) {
    const [, day, month, year] = germanMatch;
    const fullYear = year.length === 2 ? `20${year}` : year;
    return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  const slashMatch = cleanDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    const [, day, month, year] = slashMatch;
    const fullYear = year.length === 2 ? `20${year}` : year;
    return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  if (cleanDate.match(/^\d{4}-\d{2}-\d{2}$/)) return cleanDate;

  const d = new Date(cleanDate);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];

  return new Date().toISOString().split('T')[0];
}

function parseGermanAmount(amountStr: string | number): number {
  // Zentraler Parser (money.ts) inkl. korrekter Tausenderpunkt-Behandlung
  // (F-MONEY-1). Fallback auf 0 bleibt hier vorerst erhalten; die strikte
  // Ablehnung an der Persistenzgrenze folgt separat (T1.3).
  return parseGermanNumber(amountStr) ?? 0;
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `tx_${Math.random().toString(36).slice(2)}_${Date.now()}`;
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
        reasons: [`Gelernte Händlerregel für „${rule.merchant_pattern}“`],
        source: 'merchant_rule',
      };
    }
  }

  // Stufe 2: Filter-Matching (Spezifität), inkl. normalisiertem Zahlungsempfänger
  let bestMatch: Category | null = null;
  let bestMatchedFilters: string[] = [];
  let bestSpecificity = 0;

  for (const category of categories) {
    const filters = (category.filters || []) as string[];
    const matches = filters.filter((filter) => {
      const f = filter.toLowerCase();
      return (
        (transaction.payee || '').toLowerCase().includes(f) ||
        (transaction.description || '').toLowerCase().includes(f) ||
        (transaction.original_text || '').toLowerCase().includes(f) ||
        normalizedPayee.includes(f)
      );
    });

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
      reasons: bestMatchedFilters.map((filter) => `Beschreibung enthält Filter „${filter}“`),
      source: 'category_filter',
    };
  }

  // Stufe 3: generische Regex-Fallback-Regeln
  const haystack = `${normalizedPayee} ${transaction.description || ''} ${transaction.original_text || ''}`.toLowerCase();
  for (const rule of REGEX_FALLBACK_RULES) {
    if (rule.pattern.test(haystack)) {
      const fallbackCategory = categories.find((c) => c.name === rule.category);
      if (fallbackCategory) {
        return {
          categoryId: fallbackCategory.id,
          confidence: 0.55,
          reasons: [`Fallback-Regel für „${rule.category}“ erkannt`],
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

// -----------------------------------------------------------------------------
// Pagination Types & Helpers
// -----------------------------------------------------------------------------

export interface PaginatedTransactionsResult {
  transactions: Transaction[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface TransactionFilterOptions {
  categoryId?: string | null;
  accountId?: string | null;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  minAmount?: number;
  maxAmount?: number;
}

// -----------------------------------------------------------------------------
// Transactions (local encrypted storage)
// -----------------------------------------------------------------------------

export async function getTransactionsPaginated(

  page: number = 1,
  pageSize: number = 50,
  filters?: TransactionFilterOptions
): Promise<PaginatedTransactionsResult> {
  const all = await getTransactions(10000);
  const search = filters?.search?.trim().toLowerCase();

  const filtered = all.filter((tx) => {
    if (filters?.categoryId !== undefined) {
      if (filters.categoryId === null && tx.category_id) return false;
      if (filters.categoryId && tx.category_id !== filters.categoryId) return false;
    }
    if (filters?.accountId !== undefined) {
      if (filters.accountId === null && tx.account_id) return false;
      if (filters.accountId && tx.account_id !== filters.accountId) return false;
    }
    if (filters?.dateFrom && tx.date < filters.dateFrom) return false;
    if (filters?.dateTo && tx.date > filters.dateTo) return false;
    if (filters?.minAmount !== undefined && Number(tx.amount) < filters.minAmount) return false;
    if (filters?.maxAmount !== undefined && Number(tx.amount) > filters.maxAmount) return false;
    if (search) {
      const haystack = `${tx.payee || ''} ${tx.description || ''} ${tx.original_text || ''}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

  filtered.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const from = (page - 1) * pageSize;
  const rows = filtered.slice(from, from + pageSize);

  return {
    transactions: rows,
    total: filtered.length,
    page,
    pageSize,
    hasMore: from + rows.length < filtered.length,
  };
}

/**
 * Legacy function - get all transactions (limited)
 * @deprecated Use getTransactionsPaginated for better performance
 */
export async function getTransactions(limit: number = 1000): Promise<Transaction[]> {
  const result = await transactionStorage.getTransactions(limit, 0);
  if (!result.success) throw new Error(result.error || 'Lokale Transaktionen konnten nicht geladen werden');
  return (result.data || []).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

export async function saveTransactions(transactions: Transaction[]): Promise<Transaction[]> {
  const prepared = transactions.map((t) => {
    const normalizedDate = parseGermanDate(t.date);
    const normalizedAmount = parseGermanAmount(t.amount);

    return {
      id: t.id && !t.id.toString().startsWith('temp-') ? t.id : generateId(),
      account_id: t.account_id ?? null,
      date: normalizedDate,
      amount: normalizedAmount,
      payee: t.payee || 'Unbekannt',
      description: t.description || '',
      original_text: t.original_text || t.description || '',
      currency: t.currency || 'EUR',
      category_id: t.category_id ?? null,
      subcategory_id: t.subcategory_id ?? null,
      auto_mapped: t.auto_mapped ?? false,
      confirmed: t.confirmed ?? false,
      is_transfer: t.is_transfer ?? false,
      transfer_pair_id: t.transfer_pair_id ?? null,
      counterparty_iban: t.counterparty_iban ?? null,
      csvCategoryName: (t as Transaction & { csvCategoryName?: string; csvcategoryname?: string }).csvCategoryName ?? (t as Transaction & { csvCategoryName?: string; csvcategoryname?: string }).csvcategoryname ?? undefined,
    };
  });

  const result = await transactionStorage.saveTransactions(prepared as Transaction[]);
  if (!result.success) throw new Error(result.error || 'Lokales Speichern fehlgeschlagen');
  return result.data || [];
}

export async function createTransaction(transaction: Partial<Transaction>): Promise<Transaction> {
  const [result] = await saveTransactions([transaction as Transaction]);
  return result;
}

/** Filtert interne Überträge zwischen eigenen Konten aus Einnahmen/Ausgaben-Auswertungen heraus. */
export function excludeTransfers(transactions: Transaction[]): Transaction[] {
  return transactions.filter((t) => !t.is_transfer);
}

/** Verknüpft zwei Transaktionen als Gegenbuchungen eines internen Übertrags. */
export async function markTransferPair(idA: string, idB: string): Promise<void> {
  const resultA = await transactionStorage.updateTransaction(idA, {
    is_transfer: true,
    transfer_pair_id: idB,
  });
  if (!resultA.success) throw new Error(resultA.error || 'Markieren fehlgeschlagen');

  const resultB = await transactionStorage.updateTransaction(idB, {
    is_transfer: true,
    transfer_pair_id: idA,
  });
  if (!resultB.success) throw new Error(resultB.error || 'Markieren fehlgeschlagen');
}

/** Hebt die Transfer-Markierung einer Transaktion (und ihrer Gegenbuchung) wieder auf. */
export async function unmarkTransfer(transaction: Transaction): Promise<void> {
  const result = await transactionStorage.updateTransaction(transaction.id!, {
    is_transfer: false,
    transfer_pair_id: null,
  });
  if (!result.success) throw new Error(result.error || 'Entfernen fehlgeschlagen');

  if (transaction.transfer_pair_id) {
    await transactionStorage.updateTransaction(transaction.transfer_pair_id, {
      is_transfer: false,
      transfer_pair_id: null,
    });
  }
}

export interface TransactionUpdate {
  id: string;
  category_id?: string | null;
  subcategory_id?: string | null;
  is_contract?: boolean;
  contract_cycle?: Rhythmus | null;
}

export async function updateTransaction(
  updates: TransactionUpdate[]
): Promise<Transaction[]> {
  const updated: Transaction[] = [];
  for (const u of updates) {
    // Nur tatsächlich übergebene Felder patchen.
    const patch: Partial<Transaction> = {};
    const touchesCategory =
      Object.prototype.hasOwnProperty.call(u, 'category_id') ||
      Object.prototype.hasOwnProperty.call(u, 'subcategory_id');

    if (Object.prototype.hasOwnProperty.call(u, 'category_id')) {
      patch.category_id = u.category_id || null;
    }
    if (Object.prototype.hasOwnProperty.call(u, 'subcategory_id')) {
      patch.subcategory_id = u.subcategory_id || null;
    }
    if (Object.prototype.hasOwnProperty.call(u, 'is_contract')) {
      patch.is_contract = u.is_contract;
    }
    if (Object.prototype.hasOwnProperty.call(u, 'contract_cycle')) {
      patch.contract_cycle = u.contract_cycle ?? null;
    }

    // Bei manueller Kategorie-Korrektur als bestätigt markieren (nicht mehr
    // "automatisch zugeordnet") und als Lernregel für künftige Buchungen merken.
    if (touchesCategory) {
      patch.auto_mapped = false;
      patch.confirmed = true;
    }

    const result = await transactionStorage.updateTransaction(u.id, patch);
    if (!result.success || !result.data) throw new Error(result.error || 'Update fehlgeschlagen');
    updated.push(result.data);

    if (u.category_id) {
      const merchantPattern = normalizeMerchantName(result.data.payee);
      if (merchantPattern) {
        await upsertMerchantRule(merchantPattern, u.category_id);
      }
    }
  }

  return updated;
}

export async function deleteTransaction(id: string): Promise<void> {
  const result = await transactionStorage.deleteTransaction(id);
  if (!result.success) throw new Error(result.error || 'Löschen fehlgeschlagen');
}

export async function remapCategoryInLocalTransactions(
  oldCategoryId: string,
  newCategoryId: string
): Promise<number> {
  const transactions = await getTransactions(10000);
  let changed = 0;

  for (const tx of transactions) {
    if (tx.id && tx.category_id === oldCategoryId) {
      const result = await transactionStorage.updateTransaction(tx.id, { category_id: newCategoryId || null });
      if (!result.success) throw new Error(result.error || 'Kategorie konnte nicht neu zugeordnet werden');
      changed += 1;
    }
  }

  return changed;
}

// -----------------------------------------------------------------------------
// Categories (local only)
// -----------------------------------------------------------------------------

export async function getCategories(): Promise<Category[]> {
  const { categories: backfilled } = backfillAusgabenklasse(await getLocalCategories());
  return backfilled;
}

export async function getHierarchicalCategories(): Promise<HierarchicalCategory[]> {
  const flat = await getCategories();

  const map = new Map<string, HierarchicalCategory>();
  flat.forEach((cat) => {
    map.set(cat.id, { ...cat, children: [] } as HierarchicalCategory);
  });

  const roots: HierarchicalCategory[] = [];

  map.forEach((cat) => {
    if (cat.parent_id) {
      const parent = map.get(cat.parent_id);
      if (parent) {
        (parent.children || (parent.children = [])).push(cat);
        cat.parent = parent;
      } else {
        roots.push(cat);
      }
    } else {
      roots.push(cat);
    }
  });

  return roots;
}

export async function saveCategory(category: Partial<Category>): Promise<Category> {
  return saveLocalCategory(category);
}

export async function updateCategory(category: Category): Promise<Category> {
  return updateLocalCategory(category);
}

// -----------------------------------------------------------------------------
// Auto-Kategorisierung & intelligente Vorschläge (jetzt auf nutzerlokalen Transaktionen)
// -----------------------------------------------------------------------------

/** Vorzustand eines Kategorisierungsfeldes, um eine Sammeländerung rückgängig zu machen. */
export interface CategorizationSnapshotEntry {
  id: string;
  category_id: string | null;
  auto_mapped: boolean;
}

export async function recategorizeTransactions(): Promise<{
  total: number;
  assigned: number;
  unassigned: number;
  changed: number;
  /** Vorwerte der geänderten Buchungen — für ein echtes Undo (Invariante 12). */
  undo: CategorizationSnapshotEntry[];
}> {
  const categories = await getCategories();
  const learnedRules = await getMerchantRules();
  const transactions = await getTransactions(10000);

  let assigned = 0;
  let unassigned = 0;
  let changed = 0;
  const total = transactions.length;
  const undo: CategorizationSnapshotEntry[] = [];

  for (const t of transactions) {
    const newCat = categorizeTransaction(t, categories, learnedRules);
    const prevCat = t.category_id || null;

    if (newCat) assigned += 1;
    else unassigned += 1;

    if (t.id && prevCat !== newCat) {
      changed += 1;
      // Vorzustand VOR der Änderung sichern, damit handleUndo ihn exakt
      // wiederherstellen kann (statt einer Attrappe, F-UX-1).
      undo.push({ id: t.id, category_id: prevCat, auto_mapped: t.auto_mapped ?? false });
      const result = await transactionStorage.updateTransaction(t.id, {
        category_id: newCat,
        auto_mapped: !!newCat,
      });
      if (!result.success) throw new Error(result.error || 'Neukategorisierung fehlgeschlagen');
    }
  }

  return { total, assigned, unassigned, changed, undo };
}

/**
 * Macht eine Sammel-Neukategorisierung rückgängig: setzt die gesicherten
 * Vorwerte (category_id, auto_mapped) je Buchung zurück. Gibt die Anzahl
 * wiederhergestellter Buchungen zurück.
 */
export async function restoreCategorization(entries: CategorizationSnapshotEntry[]): Promise<number> {
  let restored = 0;
  for (const e of entries) {
    const result = await transactionStorage.updateTransaction(e.id, {
      category_id: e.category_id,
      auto_mapped: e.auto_mapped,
    });
    if (result.success) restored += 1;
  }
  return restored;
}

/**
 * Auto-Kategorisierung direkt auf einem frischen Transaktionssatz (z. B. CSV-Upload).
 * Nutzt die gleiche Filterlogik wie recategorizeTransactions, setzt category_id und auto_mapped.
 */
export async function applyAutoCategorization(transactions: Transaction[]): Promise<Transaction[]> {
  const categories = await getCategories();
  const learnedRules = await getMerchantRules();
  return transactions.map((t) => {
    const newCat = categorizeTransaction(t, categories, learnedRules);
    return {
      ...t,
      category_id: newCat,
      auto_mapped: !!newCat,
    };
  });
}

export async function getCategoryPreview(categoryId: string, limit: number = 50): Promise<Transaction[]> {
  const categories = await getCategories();
  const catExists = categories.some(c => c.id === categoryId);
  if (!catExists) return [];

  const learnedRules = await getMerchantRules();
  const all = await getTransactions(2000);
  const affected = all.filter((t) => {
    const newCat = categorizeTransaction(t, categories, learnedRules);
    return t.category_id !== categoryId && newCat === categoryId;
  });

  return affected.slice(0, limit);
}

export interface CategorySuggestion {
  category: Category;
  affectedCount: number;
}

export async function getTopCategorySuggestion(): Promise<CategorySuggestion | null> {
  const categories = await getCategories();
  const learnedRules = await getMerchantRules();
  const all = await getTransactions(5000);

  if (!all.length || !categories.length) return null;

  const counts: Record<string, number> = {};

  for (const t of all) {
    const newCat = categorizeTransaction(t, categories, learnedRules);
    if (!newCat) continue;
    if (t.category_id === newCat) continue;
    counts[newCat] = (counts[newCat] || 0) + 1;
  }

  const suggestions = categories
    .map(cat => ({
      category: cat,
      affectedCount: counts[cat.id] || 0,
    }))
    .filter(s => s.affectedCount > 0)
    .sort((a, b) => b.affectedCount - a.affectedCount);

  return suggestions[0] || null;
}

// -----------------------------------------------------------------------------
// User settings (local only)
// -----------------------------------------------------------------------------

export async function getUserSettings(): Promise<UserSettings> {
  return getLocalUserSettings();
}

export async function updateUserSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
  return updateLocalUserSettings(settings);
}
