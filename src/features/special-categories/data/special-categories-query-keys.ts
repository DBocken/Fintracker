// Query-Keys der Anlass-Slice. Transaktionen teilen sich bewusst den globalen
// Finance-Key (financeKeys.transactions), damit kein zweiter 5000er-Load neben
// Dashboard/Buchungen entsteht (keine Doppel-Query).
export const specialCategoriesKeys = {
  root: ['special-categories'] as const,
  categories: ['special-categories', 'list'] as const,
  assignments: ['special-categories', 'assignments'] as const,
} as const;
