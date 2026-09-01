import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CategoryModelReport } from '@/lib/category-model-evaluation';
import { evaluateCategorizationModel } from '@/lib/category-model-evaluation';
import { getAllTransactions, getCategories } from '@/services/transaction-service';
import { getMerchantRules } from '@/services/merchant-rules-service';

export interface CategoryModelReportState {
  report: CategoryModelReport | null;
  isLoading: boolean;
  isError: boolean;
}

/**
 * Rechenschaftsbericht der gelernten Zuordnung für die Einstellungen.
 *
 * Getrennt von `useCategoryModel`: Der Bericht vergleicht die GANZE Kaskade
 * mit und ohne gelernte Stufe und kostet dafür nachgemessen ~1,4 s bei 5000
 * Buchungen. Das ist für eine vom Nutzer aufgerufene Fläche mit Ladezustand
 * vertretbar, für den Import- und Sync-Pfad nicht — dort läuft die schlanke
 * Variante (`buildCategoryModel`, ~80 ms).
 *
 * Der Ladevorgang liegt in `src/hooks/`, damit die Ratsche `check:view-data`
 * nicht steigt.
 */
export function useCategoryModelReport(): CategoryModelReportState {
  const {
    data: transactions = [],
    isError: transactionsError,
    isLoading: transactionsLoading,
  } = useQuery({
    queryKey: ['transactions', 1000],
    queryFn: () => getAllTransactions(),
  });
  const {
    data: categories = [],
    isError: categoriesError,
    isLoading: categoriesLoading,
  } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });
  const { data: rules = [], isError: rulesError, isLoading: rulesLoading } = useQuery({
    queryKey: ['merchant-rules'],
    queryFn: getMerchantRules,
  });

  const isError = transactionsError || categoriesError || rulesError;
  const isLoading = transactionsLoading || categoriesLoading || rulesLoading;

  const report = useMemo(() => {
    // Fehler- und Ladefall ausdrücklich: Ein Bericht aus halben Daten nennt
    // eine Quote, die nichts belegt — und eine falsche Quote ist hier
    // schlimmer als gar keine.
    if (isError || isLoading) return null;
    return evaluateCategorizationModel(transactions, categories, rules);
  }, [transactions, categories, rules, isError, isLoading]);

  return { report, isLoading, isError };
}
