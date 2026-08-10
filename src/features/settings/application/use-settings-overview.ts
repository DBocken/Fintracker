/**
 * ViewModel der Einstellungen (WP 6.5b, ARCH-1).
 *
 * Herausgelöst aus `components/settings/EnhancedSettings.tsx` (sieben
 * Datenzugriffe) und `components/settings/CategoryManager.tsx` (der
 * Kategorie-Vorschlag). Solange die dort standen, war die Fläche ihre eigene
 * Datenschicht: Eine zweite Präsentation (Android, anderer Shell) hätte die
 * Datenbeschaffung ein zweites Mal schreiben müssen — genau der Befund, den
 * `pnpm check:view-data` zählt, und genau das Versprechen aus AGENTS.md §4.
 *
 * Verhalten ist beim Umzug erhalten geblieben. Eine bewusste Abweichung: Die
 * ausgewählte Kategorie wird als **ID** gehalten und im Baum aufgelöst, statt
 * als Objekt festgehalten zu werden. Damit zeigt die Vorschau nach einer
 * Umbenennung den neuen Namen und nach einer Löschung gar nichts mehr, statt
 * einen Stand, den es nicht mehr gibt.
 */
import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { showError, showSuccess } from '@/utils/toast';
import { useI18n } from '@/i18n/useI18n';
import type { Category, CategorizationSnapshotEntry, Transaction } from '@/types';
import {
  getCategoryPreview,
  getHierarchicalCategories,
  getTopCategorySuggestion,
  getUserSettings,
  recategorizeTransactions,
  restoreCategorization,
  saveCategory,
  updateCategory,
  updateUserSettings,
} from '@/services/transaction-service';
import { deleteCategory } from '@/services/category-service';
import { SETTINGS_QUERY_KEYS } from '../data/settings-query-keys';
import {
  findCategoryById,
  resolveAutoConfirmMapping,
  resolveRetentionMonths,
  type BulkCategorizationResults,
  type BulkCategorizationStatus,
  type SettingsOverviewModel,
} from '../domain/settings-overview';

export function useSettingsOverview(): SettingsOverviewModel {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [previewTransactions, setPreviewTransactions] = useState<Transaction[]>([]);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [undoSnapshot, setUndoSnapshot] = useState<CategorizationSnapshotEntry[]>([]);
  const [bulkStatus, setBulkStatus] = useState<BulkCategorizationStatus>('idle');
  const [bulkResults, setBulkResults] = useState<BulkCategorizationResults | null>(null);

  const {
    data: settings,
    isError: settingsError,
    refetch: refetchSettings,
  } = useQuery({
    queryKey: SETTINGS_QUERY_KEYS.userSettings,
    queryFn: getUserSettings,
  });

  const {
    data: categories = [],
    isError: categoriesError,
    refetch: refetchCategories,
  } = useQuery({
    queryKey: SETTINGS_QUERY_KEYS.hierarchicalCategories,
    queryFn: getHierarchicalCategories,
  });

  const { data: categorySuggestion } = useQuery({
    queryKey: SETTINGS_QUERY_KEYS.categorySuggestion,
    queryFn: getTopCategorySuggestion,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: updateUserSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEYS.userSettings });
      showSuccess(t('settings.settingsSaved', 'Einstellungen gespeichert'));
    },
    onError: () => showError(t('settings.saveFailed', 'Fehler beim Speichern')),
  });

  const saveCategoryMutation = useMutation({
    mutationFn: (category: Partial<Category> & { name: string }) => {
      if (category.id) {
        return updateCategory(category as Category);
      }
      return saveCategory(category as Omit<Category, 'id'>);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEYS.hierarchicalCategories });
      queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEYS.categorySuggestion });
      showSuccess(t('settings.categorySaved', 'Kategorie gespeichert'));
      setSelectedCategoryId(null);
    },
    onError: () => showError(t('settings.saveFailed', 'Fehler beim Speichern')),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEYS.hierarchicalCategories });
      queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEYS.categorySuggestion });
      // Referenzierende Daten wurden mitbereinigt → deren Queries auffrischen.
      queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEYS.budgetOverview });
      queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEYS.merchantRules });
      const cleanup = [
        result.deletedBudgets
          ? t('settings.budgetsRemoved').replace('{count}', String(result.deletedBudgets))
          : '',
        result.deletedRules
          ? t('settings.rulesRemoved').replace('{count}', String(result.deletedRules))
          : '',
      ]
        .filter(Boolean)
        .join(', ');
      showSuccess(
        cleanup
          ? t('settings.categoryDeletedWithCleanup', 'Kategorie gelöscht ({cleanup})').replace(
              '{cleanup}',
              cleanup,
            )
          : t('settings.categoryDeleted', 'Kategorie gelöscht'),
      );
    },
    onError: () => showError(t('settings.deleteFailed', 'Fehler beim Löschen')),
  });

  const recategorizeMutation = useMutation({
    mutationFn: recategorizeTransactions,
    onMutate: () => {
      setBulkStatus('processing');
    },
    onSuccess: (summary) => {
      queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEYS.transactions });
      queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEYS.categorySuggestion });
      showSuccess(t('settings.recategorizationSuccess', 'Transaktionen neu kategorisiert'));
      // Vorwerte der geänderten Buchungen für ein echtes Undo vorhalten (F-UX-1).
      setUndoSnapshot(summary.undo);
      setBulkResults({
        total: summary.total,
        assigned: summary.assigned,
        unassigned: summary.unassigned,
      });
      setBulkStatus('completed');
    },
    onError: () => {
      showError(t('settings.recategorizationError', 'Fehler bei der Neukategorisierung'));
      setBulkStatus('idle');
    },
  });

  const undoMutation = useMutation({
    mutationFn: restoreCategorization,
    onSuccess: (restored) => {
      queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEYS.transactions });
      queryClient.invalidateQueries({ queryKey: SETTINGS_QUERY_KEYS.categorySuggestion });
      setUndoSnapshot([]);
      showSuccess(
        t('settings.undoRestored', '{count} Buchungen zurückgesetzt').replace(
          '{count}',
          String(restored),
        ),
      );
    },
    onError: () => showError(t('settings.undoFailed', 'Rückgängig machen fehlgeschlagen')),
  });

  const selectedCategory = findCategoryById(categories, selectedCategoryId);

  const selectCategory = useCallback((id: string | null) => {
    setSelectedCategoryId(id);
  }, []);

  const loadPreview = useCallback(async () => {
    if (!selectedCategoryId) {
      showError(t('settings.selectCategoryFirst', 'Bitte zuerst eine Kategorie auswählen'));
      return;
    }
    setIsPreviewLoading(true);
    try {
      setPreviewTransactions(await getCategoryPreview(selectedCategoryId));
    } catch {
      showError(t('settings.previewLoadError', 'Fehler beim Laden der Vorschau'));
    } finally {
      setIsPreviewLoading(false);
    }
  }, [selectedCategoryId, t]);

  return {
    categories,
    categoryCount: categories.length,
    retentionMonths: resolveRetentionMonths(settings),
    autoConfirmMapping: resolveAutoConfirmMapping(settings),
    categorySuggestion: categorySuggestion ?? null,
    hasLoadError: settingsError || categoriesError,
    retry: () => {
      void refetchSettings();
      void refetchCategories();
    },
    preview: {
      category: selectedCategory,
      transactions: previewTransactions,
      isLoading: isPreviewLoading,
    },
    bulk: {
      status: bulkStatus,
      results: bulkResults,
      isRunning: recategorizeMutation.isPending,
      canUndo: undoSnapshot.length > 0,
    },
    selectCategory,
    loadPreview,
    saveCategory: (category) => saveCategoryMutation.mutate(category),
    deleteCategory: (id) => deleteCategoryMutation.mutate(id),
    setRetentionMonths: (months) => updateSettingsMutation.mutate({ retention_months: months }),
    setAutoConfirmMapping: (enabled) =>
      updateSettingsMutation.mutate({ auto_confirm_mapping: enabled }),
    recategorize: () => recategorizeMutation.mutate(),
    undoRecategorization: () => {
      if (undoSnapshot.length === 0) {
        showError(t('settings.nothingToUndo', 'Nichts zum Rückgängigmachen'));
        return;
      }
      undoMutation.mutate(undoSnapshot);
    },
  };
}
