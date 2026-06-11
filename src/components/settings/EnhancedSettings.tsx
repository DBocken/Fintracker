import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Settings as SettingsIcon, ShieldCheck, Tags, Wand2, FlaskConical } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import type { HierarchicalCategory, Transaction } from '../../types';
import {
  getUserSettings,
  updateUserSettings,
  getHierarchicalCategories,
  saveCategory,
  updateCategory,
  recategorizeTransactions,
  getCategoryPreview,
} from '../../services/transaction-service';
import { deleteCategory } from '../../services/category-service';
import { CategoryManager } from './CategoryManager';
import { CategoryPreview } from './CategoryPreview';
import { TimeRangeSettings } from './TimeRangeSettings';
import { AutoCategorizationSettings } from './AutoCategorizationSettings';
import { BulkAssignment } from './BulkAssignment';
import { PerformanceDashboard } from '../PerformanceDashboard';
import { LocalEncryptionSettings } from './LocalEncryptionSettings';
import { PrivacySyncAnalyticsSettings } from './PrivacySyncAnalyticsSettings';
import { BetaFeaturesSettings } from './BetaFeaturesSettings';

function SectionHeader({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/70 text-positive">
        {icon}
      </div>
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-white">{title}</h2>
        <p className="text-sm text-slate-400">{description}</p>
      </div>
    </div>
  );
}

export function EnhancedSettings() {
  const queryClient = useQueryClient();
  const [editingCategory, setEditingCategory] = useState<HierarchicalCategory | null>(null);
  const [affectedTransactions, setAffectedTransactions] = useState<Transaction[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<'idle' | 'processing' | 'completed'>('idle');
  const [bulkResults, setBulkResults] = useState<{ total: number; assigned: number; unassigned: number } | null>(null);

  const { data: settings } = useQuery({
    queryKey: ['userSettings'],
    queryFn: getUserSettings,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['hierarchicalCategories'],
    queryFn: getHierarchicalCategories,
  });

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
      queryClient.invalidateQueries({ queryKey: ['category-suggestion'] });
      showSuccess('Kategorie gespeichert');
      setEditingCategory(null);
    },
    onError: () => showError('Fehler beim Speichern'),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hierarchicalCategories'] });
      queryClient.invalidateQueries({ queryKey: ['category-suggestion'] });
      showSuccess('Kategorie gelöscht');
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
      queryClient.invalidateQueries({ queryKey: ['category-suggestion'] });
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
    saveCategoryMutation.mutate(categoryData);
  };

  const handleCategoryDelete = (category: HierarchicalCategory) => {
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
    } catch {
      showError('Fehler beim Laden der Vorschau');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApply = () => {
    recategorizeMutation.mutate();
  };

  const handleUndo = () => {
    showSuccess('Letzte Aktion rückgängig gemacht');
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(46,125,114,0.10),_transparent_30%),linear-gradient(180deg,_#020617_0%,_#0f172a_45%,_#111827_100%)]">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8">
        <div className="mb-8 rounded-3xl border border-slate-800/80 bg-slate-950/70 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-positive/20 bg-positive/10 px-3 py-1 text-xs font-medium text-positive">
                <ShieldCheck className="h-3.5 w-3.5" />
                Datenschutzorientierte Einstellungen
              </div>
              <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-white md:text-4xl">
                <SettingsIcon className="h-8 w-8 text-positive md:h-9 md:w-9" />
                Einstellungen
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-400 md:text-base">
                Verwalte Kategorien, Automatisierung und lokale Datensicherheit in einer klaren, ruhigen Oberfläche.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 md:min-w-[280px]">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Kategorien</div>
                <div className="mt-2 text-2xl font-semibold text-white">{categories.length}</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">Aufbewahrung</div>
                <div className="mt-2 text-2xl font-semibold text-white">{settings?.retention_months || 36} M</div>
              </div>
            </div>
          </div>
        </div>

        <section className="mb-10">
          <SectionHeader
            icon={<Tags className="h-5 w-5" />}
            title="Kategorien"
            description="Bearbeite Regeln, prüfe Auswirkungen und optimiere deine automatische Zuordnung."
          />
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <CategoryManager
              categories={categories}
              onCategorySave={handleCategorySave}
              onCategoryDelete={handleCategoryDelete}
              onCategoryEdit={handleCategoryEdit}
              onApplySuggestion={() => recategorizeMutation.mutate()}
            />
            <CategoryPreview
              category={editingCategory}
              affectedTransactions={affectedTransactions}
              onPreview={handlePreview}
              onApply={handleApply}
              onUndo={handleUndo}
              isProcessing={isProcessing}
            />
          </div>
        </section>

        <section className="mb-10">
          <SectionHeader
            icon={<Wand2 className="h-5 w-5" />}
            title="Automatisierung"
            description="Lege fest, wie lange Daten sichtbar bleiben und wie automatisch kategorisiert wird."
          />
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <TimeRangeSettings
              retentionMonths={settings?.retention_months || 36}
              onRetentionChange={(months) => updateSettingsMutation.mutate({ retention_months: months })}
            />
            <AutoCategorizationSettings
              autoConfirm={settings?.auto_confirm_mapping || false}
              onAutoConfirmChange={(enabled) => updateSettingsMutation.mutate({ auto_confirm_mapping: enabled })}
            />
            <BulkAssignment
              status={bulkStatus}
              results={bulkResults}
              onBulkAssign={() => recategorizeMutation.mutate()}
              onRecategorize={() => recategorizeMutation.mutate()}
              isRecategorizing={recategorizeMutation.isPending}
            />
          </div>
        </section>

        <section className="mb-10">
          <SectionHeader
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Lokale Sicherheit & Sync-Datei"
            description="Die Sync-Datei ist dein verschlüsselter lokaler Datenstand und ersetzt das klassische Backup-Konzept."
          />
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <LocalEncryptionSettings />
            <PrivacySyncAnalyticsSettings />
          </div>
        </section>

        <section className="mb-10">
          <SectionHeader
            icon={<FlaskConical className="h-5 w-5" />}
            title="Beta-Funktionen"
            description="Experimentelle Bereiche, die noch nicht zum Kern gehören. Standardmäßig aus."
          />
          <BetaFeaturesSettings />
        </section>

        <section>
          <SectionHeader
            icon={<SettingsIcon className="h-5 w-5" />}
            title="Technischer Status"
            description="Nur ergänzende Informationen zur App-Leistung und lokalen Speicherung."
          />
          <PerformanceDashboard />
        </section>
      </div>
    </div>
  );
}

export default EnhancedSettings;