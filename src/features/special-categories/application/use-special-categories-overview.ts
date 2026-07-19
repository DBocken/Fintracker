import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SpecialCategory, SpecialCategoryAssignment, Transaction } from '@/types';
import { getTransactions } from '@/services/transaction-service';
import {
  assignTransaction,
  deleteSpecialCategory,
  getSpecialCategories,
  getSpecialCategoryAssignments,
  saveSpecialCategory,
  unassign,
} from '@/services/special-category-service';
import { financeKeys, FINANCE_TRANSACTION_LIMIT } from '@/features/shared/data/finance-query-keys';
import { suggestTransactionsForEvent } from '../domain/assignment-suggestions';
import { specialCategoriesKeys } from '../data/special-categories-query-keys';
import {
  buildSpecialCategoriesData,
  type SpecialCategoriesOverviewViewModel,
} from './special-categories-view-model';

const EMPTY_CATS: SpecialCategory[] = [];
const EMPTY_ASSIGNMENTS: SpecialCategoryAssignment[] = [];
const EMPTY_TX: Transaction[] = [];

/**
 * UI-neutrales ViewModel der Anlass-Übersicht: lädt Anlässe, Zuordnungen und
 * Buchungen (geteilter Finance-Cache), leitet Baum + Summen + Vorschläge ab und
 * stellt Mutationen samt Invalidierungen bereit. Desktop- und Mobile-Sicht
 * konsumieren dasselbe Objekt (Feature-Parität).
 */
export function useSpecialCategoriesOverview(): SpecialCategoriesOverviewViewModel {
  const qc = useQueryClient();

  const { data: cats = EMPTY_CATS, isLoading: catsLoading } = useQuery({
    queryKey: specialCategoriesKeys.categories,
    queryFn: getSpecialCategories,
  });
  const { data: assignments = EMPTY_ASSIGNMENTS } = useQuery({
    queryKey: specialCategoriesKeys.assignments,
    queryFn: getSpecialCategoryAssignments,
  });
  const { data: transactions = EMPTY_TX } = useQuery({
    // Geteilter Key mit Dashboard/Buchungen – kein zweiter 5000er-Load.
    queryKey: financeKeys.transactions(FINANCE_TRANSACTION_LIMIT),
    queryFn: () => getTransactions(FINANCE_TRANSACTION_LIMIT),
  });

  const data = useMemo(
    () => buildSpecialCategoriesData(cats, assignments, transactions),
    [cats, assignments, transactions],
  );

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: specialCategoriesKeys.root });
  }, [qc]);

  const saveMutation = useMutation({
    mutationFn: (input: Partial<SpecialCategory>) => saveSpecialCategory(input),
    onSuccess: invalidate,
  });
  const removeMutation = useMutation({
    mutationFn: ({ id, options }: { id: string; options?: { deleteChildren?: boolean } }) =>
      deleteSpecialCategory(id, options),
    onSuccess: invalidate,
  });
  const assignMutation = useMutation({
    mutationFn: (input: Parameters<SpecialCategoriesOverviewViewModel['actions']['assign']>[0]) =>
      assignTransaction(input),
    onSuccess: invalidate,
  });
  const unassignMutation = useMutation({
    mutationFn: (assignmentId: string) => unassign(assignmentId),
    onSuccess: invalidate,
  });

  const suggestionsFor = useCallback(
    (eventId: string) => {
      const cat = cats.find((c) => c.id === eventId);
      if (!cat) return [];
      return suggestTransactionsForEvent(cat, transactions, assignments);
    },
    [cats, transactions, assignments],
  );

  const saving =
    saveMutation.isPending ||
    removeMutation.isPending ||
    assignMutation.isPending ||
    unassignMutation.isPending;

  const actions = useMemo(
    () => ({
      save: (input: Partial<SpecialCategory>) => saveMutation.mutateAsync(input),
      remove: async (id: string, options?: { deleteChildren?: boolean }) => {
        await removeMutation.mutateAsync({ id, options });
      },
      assign: async (
        input: Parameters<SpecialCategoriesOverviewViewModel['actions']['assign']>[0],
      ) => {
        await assignMutation.mutateAsync(input);
      },
      unassign: async (assignmentId: string) => {
        await unassignMutation.mutateAsync(assignmentId);
      },
      saving,
    }),
    [saveMutation, removeMutation, assignMutation, unassignMutation, saving],
  );

  return useMemo<SpecialCategoriesOverviewViewModel>(
    () => ({
      ...data,
      loading: catsLoading,
      isEmpty: !catsLoading && cats.length === 0,
      suggestionsFor,
      actions,
    }),
    [data, catsLoading, cats.length, suggestionsFor, actions],
  );
}
