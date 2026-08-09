import type {
  Transaction,
  Category,
  UserSettings,
  HierarchicalCategory,
  Rhythmus,
  CategorySuggestion,
  CategorizationSnapshotEntry,
} from '../types';
import { transactionStorage } from './transaction-storage-service';
import {
  getLocalCategories,
  saveLocalCategory,
  updateLocalCategory,
  getLocalUserSettings,
  updateLocalUserSettings,
} from './local-settings-service';
import { backfillAusgabenklasse } from '@/lib/category-migrations';
import { normalizeMerchantName } from '@/lib/merchant-normalization';
import { getMerchantRules, upsertMerchantRule } from './merchant-rules-service';
import { categorizeTransaction, categorizeTransactionConfident } from '@/lib/categorization';
import { parseGermanNumber, isCentPrecise } from '../lib/money';
import { t } from '@/i18n/serviceT';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Parst ein Buchungsdatum in ISO (YYYY-MM-DD) — oder `null`, wenn es nicht
 * parsebar ist. KEIN stiller Fallback auf „heute": Ein falsches Datum würde
 * Monats-/Budgetauswertungen unbemerkt verfälschen (Invariante 18, F-MONEY-4).
 */
function parseGermanDate(dateStr: string): string | null {
  if (!dateStr) return null;
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
  if (!isNaN(d.getTime())) {
    // Lokale Datumsteile statt toISOString(): Letzteres verschiebt lokal
    // geparste Daten in Zeitzonen östlich von UTC um einen Tag zurück.
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  return null;
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `tx_${Math.random().toString(36).slice(2)}_${Date.now()}`;
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

/**
 * In-Memory-Filter + Slice über den voll entschlüsselten Transaktionsbestand —
 * KEIN Storage-Level-Paging: die Storage-Schicht lädt/entschlüsselt immer den
 * gesamten Blob (siehe docs/performance.md, Phase B für echtes
 * Cursor-Paging über Monats-Chunks). Nützlich bleibt die Funktion für
 * Filterung + seitenweise UI-Anzeige, nicht als IO-Optimierung.
 */
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

  // Kein Re-Sort: getTransactions liefert bereits datum-absteigend (Storage-
  // Contract), .filter erhält die Ordnung (transaction-service.ordering.test).
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
 * Lädt die (limitierte) Transaktionsliste, datum-absteigend sortiert.
 * Sortier-Contract: transaction-storage-service sortiert VOR dem Limit
 * (sonst verliert das Limit die jüngsten Buchungen) — hier bewusst kein
 * zweites Sort. Gepinnt durch transaction-service.ordering.test.ts.
 */
export async function getTransactions(limit: number = 1000): Promise<Transaction[]> {
  const result = await transactionStorage.getTransactions(limit, 0);
  if (!result.success) throw new Error(result.error || t('transactionService.loadError'));
  return result.data || [];
}

export async function saveTransactions(transactions: Transaction[]): Promise<Transaction[]> {
  const prepared = transactions.map((tx) => {
    // Strikte Validierung an der fachlichen Grenze (Invariante 18, F-MONEY-4):
    // Ungültige Beträge/Daten werden abgelehnt statt still als 0 € bzw. „heute"
    // gespeichert. Die frühere weiche Normalisierung galt für alle Nicht-CSV-
    // Pfade (Bank, Restore, programmatisch) und erzeugte falsche Geldbeträge.
    const normalizedDate = parseGermanDate(tx.date);
    if (!normalizedDate) {
      throw new Error(t('transactionService.invalidDate', '{date}').replace('{date}', String(tx.date)).replace('{payee}', tx.payee || 'ohne Empfänger'));
    }
    const normalizedAmount = parseGermanNumber(tx.amount);
    if (normalizedAmount === null) {
      throw new Error(t('transactionService.invalidAmount', '{amount}').replace('{amount}', String(tx.amount)).replace('{payee}', tx.payee || 'ohne Empfänger').replace('{date}', normalizedDate || ''));
    }
    // Invariante 5 (docs/domain-invariants.md): Persistenzformat bleibt
    // Euro-Float, aber die Grenze validiert cent-genau — per toMinor-Roundtrip
    // (Betrag * 100 muss verlustfrei auf ganze Cent runden). Eine Abweichung
    // wie 0.005 € ist ein Validierungsfehler, nie ein still gerundeter Wert
    // (Toleranzbegründung: `isCentPrecise` in `src/lib/money.ts`).
    if (!isCentPrecise(normalizedAmount)) {
      throw new Error(t('transactionService.amountNotCentPrecise', '{amount}').replace('{amount}', String(normalizedAmount)).replace('{payee}', tx.payee || 'ohne Empfänger').replace('{date}', normalizedDate || ''));
    }

    return {
      id: tx.id && !tx.id.toString().startsWith('temp-') ? tx.id : generateId(),
      account_id: tx.account_id ?? null,
      date: normalizedDate,
      amount: normalizedAmount,
      payee: tx.payee || t('transactionService.unknownPayee'),
      description: tx.description || '',
      original_text: tx.original_text || tx.description || '',
      currency: tx.currency || 'EUR',
      category_id: tx.category_id ?? null,
      subcategory_id: tx.subcategory_id ?? null,
      auto_mapped: tx.auto_mapped ?? false,
      confirmed: tx.confirmed ?? false,
      is_transfer: tx.is_transfer ?? false,
      transfer_pair_id: tx.transfer_pair_id ?? null,
      counterparty_iban: tx.counterparty_iban ?? null,
      // Steuer-Markierungen sind nutzergepflegte Daten und müssen einen
      // Restore-/Reimport-Roundtrip an dieser strikten Grenze überleben.
      tax_category_id: tx.tax_category_id ?? null,
      tax_labor_costs: tx.tax_labor_costs ?? null,
      tax_note: tx.tax_note ?? null,
      euer_private: tx.euer_private ?? false,
      csvCategoryName: (tx as Transaction & { csvCategoryName?: string; csvcategoryname?: string }).csvCategoryName ?? (tx as Transaction & { csvCategoryName?: string; csvcategoryname?: string }).csvcategoryname ?? undefined,
    };
  });

  const result = await transactionStorage.saveTransactions(prepared as Transaction[]);
  if (!result.success) throw new Error(result.error || t('transactionService.saveFailed'));
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
  if (!resultA.success) throw new Error(resultA.error || t('transactionService.updateFailed'));

  const resultB = await transactionStorage.updateTransaction(idB, {
    is_transfer: true,
    transfer_pair_id: idA,
  });
  if (!resultB.success) throw new Error(resultB.error || t('transactionService.updateFailed'));
}

/** Hebt die Transfer-Markierung einer Transaktion (und ihrer Gegenbuchung) wieder auf. */
export async function unmarkTransfer(transaction: Transaction): Promise<void> {
  const result = await transactionStorage.updateTransaction(transaction.id!, {
    is_transfer: false,
    transfer_pair_id: null,
  });
  if (!result.success) throw new Error(result.error || t('transactionService.removeFailed'));

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
  tax_category_id?: string | null;
  tax_labor_costs?: number | null;
  tax_note?: string | null;
  euer_private?: boolean;
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
    // Steuer-Felder rein durchleiten: KEIN confirmed/auto_mapped-Flip und KEINE
    // Merchant-Lernregel (das ist keine Kategorie-Korrektur, nur eine Markierung).
    if (Object.prototype.hasOwnProperty.call(u, 'tax_category_id')) {
      patch.tax_category_id = u.tax_category_id || null;
    }
    if (Object.prototype.hasOwnProperty.call(u, 'tax_labor_costs')) {
      patch.tax_labor_costs = u.tax_labor_costs ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(u, 'tax_note')) {
      patch.tax_note = u.tax_note ?? null;
    }
    // Wie die Steuer-Felder: reine Markierung, kein Status-Flip, keine Lernregel.
    if (Object.prototype.hasOwnProperty.call(u, 'euer_private')) {
      patch.euer_private = u.euer_private ?? false;
    }

    // Bei manueller Kategorie-Korrektur als bestätigt markieren (nicht mehr
    // "automatisch zugeordnet") und als Lernregel für künftige Buchungen merken.
    if (touchesCategory) {
      patch.auto_mapped = false;
      patch.confirmed = true;
    }

    const result = await transactionStorage.updateTransaction(u.id, patch);
    if (!result.success || !result.data) throw new Error(result.error || t('transactionService.updateFailed'));
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
  if (!result.success) throw new Error(result.error || t('transactionService.removeFailed'));
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
      if (!result.success) throw new Error(result.error || t('transactionService.remapFailed'));
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

  for (const tx of transactions) {
    // Vom Nutzer bestätigte Kategorien sind manuelle Arbeit und werden vom
    // Bulk-Lauf NIE überschrieben (nur unbestätigte/automatische Zuordnungen).
    if (tx.confirmed) {
      if (tx.category_id) assigned += 1;
      else unassigned += 1;
      continue;
    }

    const newCat = categorizeTransactionConfident(tx, categories, learnedRules);
    const prevCat = tx.category_id || null;

    if (newCat) assigned += 1;
    else unassigned += 1;

    if (tx.id && prevCat !== newCat) {
      changed += 1;
      // Vorzustand VOR der Änderung sichern, damit handleUndo ihn exakt
      // wiederherstellen kann (statt einer Attrappe, F-UX-1).
      undo.push({ id: tx.id, category_id: prevCat, auto_mapped: tx.auto_mapped ?? false });
      const result = await transactionStorage.updateTransaction(tx.id, {
        category_id: newCat,
        auto_mapped: !!newCat,
      });
      if (!result.success) throw new Error(result.error || t('transactionService.recategorizationFailed'));
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
    const newCat = categorizeTransactionConfident(t, categories, learnedRules);
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
