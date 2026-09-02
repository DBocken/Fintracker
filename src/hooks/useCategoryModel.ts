import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { CategorizationContext } from '@/lib/categorization';
import { buildCategoryModel } from '@/lib/category-model-evaluation';
import { getAllTransactions } from '@/services/transaction-service';
import { getMerchantRules } from '@/services/merchant-rules-service';

/** Kein Bestand, kein Modell — die Kaskade verhält sich dann exakt wie zuvor. */
const OHNE_MODELL: CategorizationContext = {};

/**
 * Der Kaskaden-Kontext mit dem aus den EIGENEN bestätigten Buchungen
 * gelernten Modell (WP-B).
 *
 * **Warum der Hook selbst lädt, statt Daten entgegenzunehmen:** Trainiert
 * werden muss immer auf dem BESTAND. Die CSV-Vorschau (`ReviewTable`) hält
 * aber frisch eingelesene, noch unbestätigte Zeilen — würde sie ihre eigenen
 * Zeilen hereinreichen, träfe die Vorschau eine andere Aussage als der
 * Import, der danach tatsächlich schreibt. Genau diese Abweichung soll die
 * Vorschau ja verhindern.
 *
 * Der Ladevorgang liegt in `src/hooks/` und nicht in der Komponente: Die
 * Ratsche `check:view-data` zählt Datenzugriffe in `src/components/` und
 * `src/pages/` und darf nur sinken. Der Query-Schlüssel ist bewusst
 * byte-identisch zu dem, den die Aufrufer ohnehin benutzen — TanStack Query
 * dedupliziert damit, es entsteht kein zweiter Ladevorgang.
 *
 * **Nicht persistiert:** Ein Eintrag im `local-finance-store` zöge
 * Verschlüsselung (die Token SIND Händlernamen), Backup-, Restore- und
 * Schema-Pfad nach sich — der volle Migrationsapparat für ein Artefakt, das
 * nachgemessen in ~80 ms neu ableitbar ist und dessen Veralten still falsche
 * Vorschläge erzeugt. Abgeleitete Daten persistiert man nicht.
 */
export function useCategoryModel(): CategorizationContext {
  const { data: transactions = [], isError: transactionsError } = useQuery({
    queryKey: ['transactions', 1000],
    queryFn: () => getAllTransactions(),
  });
  const { data: rules = [], isError: rulesError } = useQuery({
    queryKey: ['merchant-rules'],
    queryFn: getMerchantRules,
  });

  return useMemo(() => {
    // Fehlerfall ausdrücklich: Ein aus halben Daten trainiertes Modell wäre
    // schlimmer als keins — es ordnete mit derselben Zuversicht zu, hätte
    // aber die Hälfte der Belege nie gesehen. Ohne Modell fällt die Kaskade
    // auf ihr bisheriges Verhalten zurück, und nichts wird still falsch
    // geschrieben.
    if (transactionsError || rulesError) return OHNE_MODELL;
    return { model: buildCategoryModel(transactions, rules) };
  }, [transactions, rules, transactionsError, rulesError]);
}
