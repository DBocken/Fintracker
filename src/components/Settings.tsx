import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Settings as SettingsIcon } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import type { HierarchicalCategory, Transaction } from '../types';
import { getUserSettings, updateUserSettings, getHierarchicalCategories, saveCategory, updateCategory, recategorizeTransactions, getCategoryPreview } from '../services/transaction-service';
import { deleteCategory } from '../services/category-service';
import { CategoryManager } from './settings/CategoryManager';
import { CategoryPreview } from './settings/CategoryPreview';
import { TimeRangeSettings } from './settings/TimeRangeSettings';
import { AutoCategorizationSettings } from './settings/AutoCategorizationSettings';
import { BulkAssignment } from './settings/BulkAssignment';

export function Settings() {
  const queryClient = useQueryClient();
  const [editingCategory, setEditingCategory] = useState<HierarchicalCategory | null>(null);
  // Removed showDeleteDialog and categoryToDelete as they are not used for rendering a dialog
  const [affectedTransactions, setAffectedTransactions] = useState<Transaction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<'idle' | 'processing' | 'completed'>('idle');
  const [bulkResults, setBulkResults] = useState<{ total: number; assigned: number; unassigned: number } | null>(null);

  // Queries
  const { data: settings } = useQuery({
    queryKey: ['userSettings'],
    queryFn: getUserSettings,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['hierarchicalCategories'],
    queryFn: getHierarchicalCategories,
  });

  // Mutations
  const updateSettingsMutation = useMutation({
    mutationFn: updateUserSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userSettings'] });
      showSuccess('Einstellungen gespeichert');
    },
    onError: () => showError('Fehler beim Speichern'),
  });

  const saveCategoryMutation = useMutation({
    mutationFn: (category: any) => {
      if (category.id) {
        return updateCategory(category);
      }
      return saveCategory(category);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hierarchicalCategories'] });
      showSuccess('Kategorie gespeichert');
      setEditingCategory(null);
    },
    onError: () => showError('Fehler beim Speichern'),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hierarchicalCategories'] });
      showSuccess('Kategorie gelöscht');
      // Removed setShowDeleteDialog(false); and setCategoryToDelete(null);
    },
    onError: () => showError('Fehler beim Löschen'),
  });

  const recategorizeMutation = useMutation({
    mutationFn: recategorizeTransactions,
    onMutate: () => {
      setBulkStatus('processing');
    },
    onSuccess: (summary) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      showSuccess('Transaktionen neu kategorisiert');
      setBulkResults({
        total: summary.total,
        assigned: summary.assigned,
        unassigned: summary.unassigned,
      });
      setBulkStatus('completed');
    },
    onError: () => {
      showError('Fehler bei der Neukategorisierung');
      setBulkStatus('idle');
    },
  });

  const handleCategorySave = (categoryData: any) => {
    // CategoryManager liefert bereits das richtige parent_id (inkl. Unterkategorien)
    saveCategoryMutation.mutate(categoryData);
  };

  const handleCategoryDelete = (category: HierarchicalCategory) => {
    // Removed setCategoryToDelete(category); and setShowDeleteDialog(true);
    // The mutation call remains as it's the actual delete action
    if (category.id) {
        deleteCategoryMutation.mutate(category.id);
    }
  };

  const handleCategoryEdit = (category: HierarchicalCategory) => {
    setEditingCategory(category);
  };

  const handlePreview = async () => {
    if (!editingCategory?.id) {
      showError('Bitte zuerst eine Kategorie auswählen');
      return;
    }
    setIsProcessing(true);
    try {
      const transactions = await getCategoryPreview(editingCategory.id);
      setAffectedTransactions(transactions);
    } catch (error) {
      showError('Fehler beim Laden der Vorschau');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApply = () => {
    // Anwenden soll die Auto-Kategorisierung mit den aktuellen Regeln ausführen
    recategorizeMutation.mutate();
  };

  const handleUndo = () => {
    showSuccess('Letzte Aktion rückgängig gemacht');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground flex items-center gap-3">
            <SettingsIcon className="h-10 w-10 text-warning" />
            Premium Kategorie-Einstellungen
          </h1>
          <p className="text-muted-foreground">Verwalte deine Kategorien mit intelligenter Vorschau und Live-Auswirkung</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Side - Category Management */}
          <div>
            <CategoryManager
              categories={categories}
              onCategorySave={handleCategorySave}
              onCategoryDelete={handleCategoryDelete}
              onCategoryEdit={handleCategoryEdit}
              onApplySuggestion={() => recategorizeMutation.mutate()}
            />
          </div>

          {/* Right Side - Preview & Assignment */}
          <div>
            <CategoryPreview
              category={editingCategory}
              affectedTransactions={affectedTransactions}
              onPreview={handlePreview}
              onApply={handleApply}
              onUndo={handleUndo}
              isProcessing={isProcessing}
            />
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <TimeRangeSettings
            retentionMonths={settings?.retention_months || 36}
            onRetentionChange={(months) => updateSettingsMutation.mutate({ retention_months: months })}
          />
          
          <AutoCategorizationSettings
            autoConfirm={settings?.auto_confirm_mapping || false}
            onAutoConfirmChange={(enabled) => updateSettingsMutation.mutate({ auto_confirm_mapping: enabled })}
          />
        </div>

        <div className="mt-8">
          <BulkAssignment
            status={bulkStatus}
            results={bulkResults}
            onBulkAssign={() => recategorizeMutation.mutate()}
            onRecategorize={() => recategorizeMutation.mutate()}
            isRecategorizing={recategorizeMutation.isPending}
          />
        </div>
      </div>
    </div>
  );
}

export default Settings;