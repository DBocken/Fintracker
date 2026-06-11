"use client";

import { supabase } from '../integrations/supabase/client';
import type { Transaction, Category, UserSettings, HierarchicalCategory } from '../types';
import { requireUserId } from './auth-service';
import { transactionStorage } from './transaction-storage-service';

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
  if (amountStr === null || amountStr === undefined) return 0;
  const asString = amountStr.toString();
  const cleanAmount = asString.replace(/\s/g, '').replace(/[^\d,\.-]/g, '');
  const normalized = cleanAmount.replace(',', '.');
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `tx_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

// Kern der intelligenten Kategorien: Filter-Matching
export function categorizeTransaction(transaction: Transaction, categories: Category[]): string | null {
  let bestMatch: Category | null = null;
  let bestSpecificity = 0;

  for (const category of categories) {
    const filters = (category.filters || []) as string[];
    const matches = filters.filter(filter =>
      (transaction.payee || '').toLowerCase().includes(filter.toLowerCase()) ||
      (transaction.description || '').toLowerCase().includes(filter.toLowerCase()) ||
      (transaction.original_text || '').toLowerCase().includes(filter.toLowerCase())
    );

    if (matches.length > bestSpecificity) {
      bestMatch = category;
      bestSpecificity = matches.length;
    }
  }

  return bestMatch?.id || null;
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
      csvCategoryName: (t as any).csvCategoryName ?? (t as any).csvcategoryname ?? undefined,
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

export async function updateTransaction(
  updates: { id: string; category_id: string }[]
): Promise<Transaction[]> {
  const updated: Transaction[] = [];
  for (const u of updates) {
    const result = await transactionStorage.updateTransaction(u.id, {
      category_id: u.category_id || null,
      auto_mapped: true,
    });
    if (!result.success || !result.data) throw new Error(result.error || 'Update fehlgeschlagen');
    updated.push(result.data);
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
// Categories (Supabase)
// -----------------------------------------------------------------------------

export async function getCategories(): Promise<Category[]> {
  // Uses RLS to return: user categories + public defaults (user_id IS NULL)
  const uid = await requireUserId();

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .or(`user_id.is.null,user_id.eq.${uid}`)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []) as Category[];
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
  const uid = await requireUserId();

  // Duplikate vermeiden (Name + User)
  const { data: existing, error: existsError } = await supabase
    .from('categories')
    .select('id, name')
    .eq('user_id', uid)
    .eq('name', category.name || '')
    .limit(1);

  if (existsError) throw new Error(existsError.message);
  if (existing && existing.length > 0) {
    throw new Error('Eine Kategorie mit diesem Namen existiert bereits');
  }

  const payload: any = {
    user_id: uid,
    name: category.name || 'Kategorie',
    color: category.color || '#22c55e',
    icon: category.icon || '🛒',
    filters: category.filters || [],
    is_default: false,
    parent_id: category.parent_id || null,
    attributes: category.attributes || {},
  };

  const { data, error } = await supabase
    .from('categories')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as Category;
}

export async function updateCategory(category: Category): Promise<Category> {
  const uid = await requireUserId();

  // Prüfe, wem die Kategorie gehört
  const { data: existingRow, error: fetchError } = await supabase
    .from('categories')
    .select('id, user_id')
    .eq('id', category.id)
    .single();

  if (fetchError) throw new Error(fetchError.message);

  // Falls es eine Standard-Kategorie ist (user_id = NULL), lege eine Benutzer-Kopie an
  if (!existingRow.user_id) {
    return await saveCategory({
      name: category.name,
      color: category.color,
      icon: category.icon,
      filters: category.filters || [],
      parent_id: category.parent_id || null,
      attributes: category.attributes || {},
    });
  }

  // Duplikate prüfen (ohne sich selbst) innerhalb der Benutzer-Kategorien
  const { data: dup, error: dupError } = await supabase
    .from('categories')
    .select('id, name')
    .eq('user_id', uid)
    .eq('name', category.name)
    .neq('id', category.id)
    .limit(1);

  if (dupError) throw new Error(dupError.message);
  if (dup && dup.length > 0) {
    throw new Error('Eine Kategorie mit diesem Namen existiert bereits');
  }

  const payload: any = {
    name: category.name,
    color: category.color,
    icon: category.icon,
    filters: category.filters || [],
    parent_id: category.parent_id || null,
    attributes: category.attributes || {},
  };

  const { data, error } = await supabase
    .from('categories')
    .update(payload)
    .eq('id', category.id)
    .eq('user_id', uid)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as Category;
}

// -----------------------------------------------------------------------------
// Auto-Kategorisierung & intelligente Vorschläge (jetzt auf nutzerlokalen Transaktionen)
// -----------------------------------------------------------------------------

export async function recategorizeTransactions(): Promise<{
  total: number;
  assigned: number;
  unassigned: number;
  changed: number;
}> {
  const categories = await getCategories();
  const transactions = await getTransactions(10000);

  let assigned = 0;
  let unassigned = 0;
  let changed = 0;
  const total = transactions.length;

  for (const t of transactions) {
    const newCat = categorizeTransaction(t, categories);
    const prevCat = t.category_id || null;

    if (newCat) assigned += 1;
    else unassigned += 1;

    if (t.id && prevCat !== newCat) {
      changed += 1;
      const result = await transactionStorage.updateTransaction(t.id, {
        category_id: newCat,
        auto_mapped: !!newCat,
      });
      if (!result.success) throw new Error(result.error || 'Neukategorisierung fehlgeschlagen');
    }
  }

  return { total, assigned, unassigned, changed };
}

/**
 * Auto-Kategorisierung direkt auf einem frischen Transaktionssatz (z. B. CSV-Upload).
 * Nutzt die gleiche Filterlogik wie recategorizeTransactions, setzt category_id und auto_mapped.
 */
export async function applyAutoCategorization(transactions: Transaction[]): Promise<Transaction[]> {
  const categories = await getCategories();
  return transactions.map((t) => {
    const newCat = categorizeTransaction(t, categories);
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

  const all = await getTransactions(2000);
  const affected = all.filter((t) => {
    const newCat = categorizeTransaction(t, categories);
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
  const all = await getTransactions(5000);

  if (!all.length || !categories.length) return null;

  const counts: Record<string, number> = {};

  for (const t of all) {
    const newCat = categorizeTransaction(t, categories);
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
// User settings (Supabase)
// -----------------------------------------------------------------------------

export async function getUserSettings(): Promise<UserSettings> {
  const uid = await requireUserId();

  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', uid)
    .single();

  // Wenn noch kein Eintrag existiert, mit Defaults anlegen
  if (error && (error as any).code === 'PGRST116') {
    const defaultSettings: UserSettings = {
      user_id: uid,
      auto_confirm_mapping: false,
      retention_months: 36,
      default_currency: 'EUR',
      enable_subcategories: true,
      theme: 'legacy',
      kpi_prefs: {
        order: ['net_cashflow', 'savings_rate', 'transactions_count'],
        active: ['net_cashflow', 'savings_rate', 'transactions_count'],
      },
    };

    const { data: inserted, error: insertError } = await supabase
      .from('user_settings')
      .insert(defaultSettings)
      .select('*')
      .single();

    if (insertError) throw new Error(insertError.message);
    return inserted as UserSettings;
  }

  if (error) throw new Error(error.message);
  // Ensure theme has a default
  const withTheme = { ...(data as UserSettings), theme: (data as any)?.theme ?? 'legacy' };
  return withTheme as UserSettings;
}

export async function updateUserSettings(settings: Partial<UserSettings>): Promise<UserSettings> {
  const uid = await requireUserId();

  const toSave: Partial<UserSettings> = {
    ...settings,
    user_id: uid,
  };

  const { data, error } = await supabase
    .from('user_settings')
    .upsert(toSave, { onConflict: 'user_id' })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  // Ensure theme default
  const withTheme = { ...(data as UserSettings), theme: (data as any)?.theme ?? 'legacy' };
  return withTheme as UserSettings;
}