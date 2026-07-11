import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Settings as SettingsIcon, ShieldCheck, Tags, Wand2, Trash2, HardDrive, Palette, Languages, Home } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import { useI18n } from '@/i18n/useI18n';
import type { HierarchicalCategory, Transaction, Category } from '../../types';
import {
  getUserSettings,
  updateUserSettings,
  getHierarchicalCategories,
  saveCategory,
  updateCategory,
  recategorizeTransactions,
  restoreCategorization,
  getCategoryPreview,
  type CategorizationSnapshotEntry,
} from '../../services/transaction-service';
import { deleteCategory } from '../../services/category-service';
import { CategoryManager } from './CategoryManager';
import { CategoryPreview } from './CategoryPreview';
import { TimeRangeSettings } from './TimeRangeSettings';
import { AutoCategorizationSettings } from './AutoCategorizationSettings';
import TaxReserveSettings from './TaxReserveSettings';
import BusinessModeSettings from './BusinessModeSettings';
import { BulkAssignment } from './BulkAssignment';
import { PerformanceDashboard } from '../PerformanceDashboard';
import { LocalEncryptionSettings } from './LocalEncryptionSettings';
import { PrivacySyncAnalyticsSettings } from './PrivacySyncAnalyticsSettings';
import { DangerZoneSettings } from './DangerZoneSettings';
import DiagnosticsSettings from './DiagnosticsSettings';
import { CloudMcpSyncCard } from './CloudMcpSyncCard';
import { AppearanceSettings } from './AppearanceSettings';
import { LanguageSettings } from './LanguageSettings';
import { HouseholdSettings } from './HouseholdSettings';
import { FeatureGate } from '@/components/FeatureGate';
import { BackupManager } from '../BackupManager';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { InfoStatStrip } from '@/components/common/InfoGroup';

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
      <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-primary">
        {icon}
      </div>
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export function EnhancedSettings() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [editingCategory, setEditingCategory] = useState<HierarchicalCategory | null>(null);
  const [affectedTransactions, setAffectedTransactions] = useState<Transaction[]>([]);
  const [undoSnapshot, setUndoSnapshot] = useState<CategorizationSnapshotEntry[]>([]);
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
      queryClient.invalidateQueries({ queryKey: ['hierarchicalCategories'] });
      queryClient.invalidateQueries({ queryKey: ['category-suggestion'] });
      showSuccess(t('settings.categorySaved', 'Kategorie gespeichert'));
      setEditingCategory(null);
    },
    onError: () => showError(t('settings.saveFailed', 'Fehler beim Speichern')),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['hierarchicalCategories'] });
      queryClient.invalidateQueries({ queryKey: ['category-suggestion'] });
      // Referenzierende Daten wurden mitbereinigt → deren Queries auffrischen.
      queryClient.invalidateQueries({ queryKey: ['budget-overview'] });
      queryClient.invalidateQueries({ queryKey: ['merchant-rules'] });
      const cleanup = [
        result.deletedBudgets ? `${result.deletedBudgets} Budget(s) entfernt` : '',
        result.deletedRules ? `${result.deletedRules} Regel(n) entfernt` : '',
      ].filter(Boolean).join(', ');
      showSuccess(cleanup ? t('settings.categoryDeletedWithCleanup', 'Kategorie gelöscht ({cleanup})').replace('{cleanup}', cleanup) : t('settings.categoryDeleted', 'Kategorie gelöscht'));
    },
    onError: () => showError(t('settings.deleteFailed', 'Fehler beim Löschen')),
  });

  const recategorizeMutation = useMutation({
    mutationFn: recategorizeTransactions,
    onMutate: () => {
      setBulkStatus('processing');
    },
    onSuccess: (summary) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['category-suggestion'] });
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
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['category-suggestion'] });
      setUndoSnapshot([]);
      showSuccess(t('settings.undoRestored', '{count} Buchungen zurückgesetzt').replace('{count}', String(restored)));
    },
    onError: () => showError(t('settings.undoFailed', 'Rückgängig machen fehlgeschlagen')),
  });

  const handleCategorySave = (categoryData: Partial<Category> & { name: string }) => {
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
      showError(t('settings.selectCategoryFirst', 'Bitte zuerst eine Kategorie auswählen'));
      return;
    }

    setIsProcessing(true);
    try {
      const transactions = await getCategoryPreview(editingCategory.id);
      setAffectedTransactions(transactions);
    } catch {
      showError(t('settings.previewLoadError', 'Fehler beim Laden der Vorschau'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApply = () => {
    recategorizeMutation.mutate();
  };

  const handleUndo = () => {
    if (undoSnapshot.length === 0) {
      showError(t('settings.nothingToUndo', 'Nichts zum Rückgängigmachen'));
      return;
    }
    undoMutation.mutate(undoSnapshot);
  };

  return (
    <div className="bg-background">
      <div className="w-full">
        <div className="mb-8 rounded-3xl border border-border bg-card p-6 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-positive/20 bg-positive/10 px-3 py-1 text-xs font-medium text-positive">
                <ShieldCheck className="h-3.5 w-3.5" />
                {t('settings.privacyFocusedBadge', 'Datenschutzorientierte Einstellungen')}
              </div>
              <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                <SettingsIcon className="h-8 w-8 text-primary md:h-9 md:w-9" />
                {t('settings.pageTitle', 'Einstellungen')}
              </h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground md:text-base">
                {t('settings.pageDescription', 'Verwalte Kategorien, Automatisierung und lokale Datensicherheit in einer klaren, ruhigen Oberfläche.')}
              </p>
            </div>

            <InfoStatStrip
              className="md:min-w-[280px]"
              items={[
                { label: "Kategorien", value: categories.length },
                { label: "Aufbewahrung", value: `${settings?.retention_months || 36} M` },
              ]}
            />
          </div>
        </div>

        <section className="mb-10">
          <SectionHeader
            icon={<Tags className="h-5 w-5" />}
            title={t('settings.categoriesTitle', 'Kategorien')}
            description={t('settings.categoriesDescription', 'Bearbeite Regeln, prüfe Auswirkungen und optimiere deine automatische Zuordnung.')}
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
            icon={<Palette className="h-5 w-5" />}
            title={t('settings.appearanceTitle', 'Erscheinungsbild')}
            description={t('settings.appearanceDescription', 'Wähle Theme und Darstellung (hell/dunkel) für die gesamte Oberfläche.')}
          />
          <AppearanceSettings />
        </section>

        <section className="mb-10">
          <SectionHeader
            icon={<Languages className="h-5 w-5" />}
            title={t('settings.languageSettingsTitle', 'Sprache')}
            description={t('settings.languageSettingsDescription', 'Wähle die Sprache der App (Deutsch/Englisch/Klingonisch).')}
          />
          <LanguageSettings />
        </section>

        <FeatureGate feature="familyMode" fallback={null}>
          <section className="mb-10">
            <SectionHeader
              icon={<Home className="h-5 w-5" />}
              title={t('settings.householdTitle', 'Haushalt')}
              description={t('settings.householdDescription', 'Haushalt und Mitglieder für geteilte Ausgaben – lokal auf deinem Gerät.')}
            />
            <HouseholdSettings />
          </section>
        </FeatureGate>

        <section className="mb-10">
          <SectionHeader
            icon={<Wand2 className="h-5 w-5" />}
            title={t('settings.automationTitle', 'Automatisierung')}
            description={t('settings.automationDescription', 'Lege fest, wie lange Daten sichtbar bleiben und wie automatisch kategorisiert wird.')}
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
            <BusinessModeSettings />
            {/* Prozent-Regler wird vom Einzelunternehmer-Modus mitgenutzt —
                im Modus sichtbar auch ohne Creator-Pack. */}
            {settings?.business_mode ? (
              <TaxReserveSettings />
            ) : (
              <FeatureGate feature="creatorPack" fallback={null}>
                <TaxReserveSettings />
              </FeatureGate>
            )}
          </div>
        </section>

        <section className="mb-10">
          <SectionHeader
            icon={<ShieldCheck className="h-5 w-5" />}
            title={t('settings.securityTitle', 'Lokale Sicherheit & Sync-Datei')}
            description={t('settings.securityDescription', 'Deine Daten werden verschlüsselt lokal gespeichert. Hier kannst du eine Sicherungskopie erstellen oder wiederherstellen.')}
          />
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <LocalEncryptionSettings />
            <PrivacySyncAnalyticsSettings />
          </div>
          <Link
            to="/privacy"
            className="mt-4 inline-block text-sm font-medium text-positive underline-offset-2 hover:underline"
          >
            {t('settings.privacyLink', 'Wie wir mit deinen Daten umgehen →')}
          </Link>
        </section>

        <section className="mb-10" id="backups">
          <SectionHeader
            icon={<HardDrive className="h-5 w-5" />}
            title={t('settings.backupsTitle', 'Backups')}
            description={t('settings.backupsDescription', 'Verschlüsselte Sicherungen deiner lokalen Daten erstellen und wiederherstellen.')}
          />
          <BackupManager />
        </section>

        <section className="mb-10">
          <SectionHeader
            icon={<ShieldCheck className="h-5 w-5" />}
            title={t('settings.mcpTitle', 'Sprach-/KI-Zugriff (MCP) · Proof of Concept')}
            description={t('settings.mcpDescription', 'Aggregierte Finanzdaten optional in die Cloud freigeben, um sie per Sprache/Chat aus Claude oder ChatGPT abzufragen. Widerspricht bewusst dem Local-only-Prinzip.')}
          />
          <CloudMcpSyncCard />
        </section>

        <section className="mb-10">
          <Accordion type="single" collapsible>
            <AccordionItem value="technical-status" className="border-none">
              <AccordionTrigger className="gap-2 text-sm font-medium text-muted-foreground hover:no-underline hover:text-foreground">
                <span className="flex items-center gap-2">
                  <SettingsIcon className="h-4 w-4" />
                  {t('settings.technicalStatusTitle', 'Technischer Status')}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <p className="mb-3 text-xs text-muted-foreground">
                  {t('settings.technicalStatusDescription', 'Nur ergänzende Informationen zur App-Leistung und lokalen Speicherung.')}
                </p>
                <PerformanceDashboard />
                <DiagnosticsSettings />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>

        <section>
          <SectionHeader
            icon={<Trash2 className="h-5 w-5" />}
            title={t('settings.dangerZoneTitle', 'Daten & Konto löschen')}
            description={t('settings.dangerZoneDescription', 'Lokale Daten oder dein gesamtes Konto endgültig entfernen (DSGVO Art. 17).')}
          />
          <DangerZoneSettings />
        </section>
      </div>
    </div>
  );
}

export default EnhancedSettings;