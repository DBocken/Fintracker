import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Settings as SettingsIcon, ShieldCheck, Tags, Wand2, FlaskConical, Trash2, HardDrive, Palette, Languages, Home } from 'lucide-react';
import { showError, showSuccess } from '@/utils/toast';
import type { HierarchicalCategory, Transaction, Category } from '../../types';
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
import { DangerZoneSettings } from './DangerZoneSettings';
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
    mutationFn: (category: Partial<Category> & { name: string }) => {
      if (category.id) {
        return updateCategory(category as Category);
      }
      return saveCategory(category as Omit<Category, 'id'>);
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
    <div className="bg-background">
      <div className="w-full">
        <div className="mb-8 rounded-3xl border border-border bg-card p-6 shadow-sm backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-positive/20 bg-positive/10 px-3 py-1 text-xs font-medium text-positive">
                <ShieldCheck className="h-3.5 w-3.5" />
                Datenschutzorientierte Einstellungen
              </div>
              <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                <SettingsIcon className="h-8 w-8 text-primary md:h-9 md:w-9" />
                Einstellungen
              </h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground md:text-base">
                Verwalte Kategorien, Automatisierung und lokale Datensicherheit in einer klaren, ruhigen Oberfläche.
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
            icon={<Palette className="h-5 w-5" />}
            title="Erscheinungsbild"
            description="Wähle Theme und Darstellung (hell/dunkel) für die gesamte Oberfläche."
          />
          <AppearanceSettings />
        </section>

        <section className="mb-10">
          <SectionHeader
            icon={<Languages className="h-5 w-5" />}
            title="Sprache"
            description="Wähle die Sprache der App (Deutsch/Englisch)."
          />
          <LanguageSettings />
        </section>

        <FeatureGate feature="familyMode" fallback={null}>
          <section className="mb-10">
            <SectionHeader
              icon={<Home className="h-5 w-5" />}
              title="Haushalt"
              description="Haushalt und Mitglieder für geteilte Ausgaben – lokal auf deinem Gerät."
            />
            <HouseholdSettings />
          </section>
        </FeatureGate>

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
            description="Deine Daten werden verschlüsselt lokal gespeichert. Hier kannst du eine Sicherungskopie erstellen oder wiederherstellen."
          />
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <LocalEncryptionSettings />
            <PrivacySyncAnalyticsSettings />
          </div>
          <Link
            to="/privacy"
            className="mt-4 inline-block text-sm font-medium text-positive underline-offset-2 hover:underline"
          >
            Wie wir mit deinen Daten umgehen →
          </Link>
        </section>

        <section className="mb-10" id="backups">
          <SectionHeader
            icon={<HardDrive className="h-5 w-5" />}
            title="Backups"
            description="Verschlüsselte Sicherungen deiner lokalen Daten erstellen und wiederherstellen."
          />
          <BackupManager />
        </section>

        <section className="mb-10">
          <SectionHeader
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Sprach-/KI-Zugriff (MCP) · Proof of Concept"
            description="Aggregierte Finanzdaten optional in die Cloud freigeben, um sie per Sprache/Chat aus Claude oder ChatGPT abzufragen. Widerspricht bewusst dem Local-only-Prinzip."
          />
          <CloudMcpSyncCard />
        </section>

        <section className="mb-10">
          <SectionHeader
            icon={<FlaskConical className="h-5 w-5" />}
            title="Beta-Funktionen"
            description="Experimentelle Bereiche, die noch nicht zum Kern gehören. Standardmäßig aus."
          />
          <BetaFeaturesSettings />
        </section>

        <section className="mb-10">
          <Accordion type="single" collapsible>
            <AccordionItem value="technical-status" className="border-none">
              <AccordionTrigger className="gap-2 text-sm font-medium text-muted-foreground hover:no-underline hover:text-foreground">
                <span className="flex items-center gap-2">
                  <SettingsIcon className="h-4 w-4" />
                  Technischer Status
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <p className="mb-3 text-xs text-muted-foreground">
                  Nur ergänzende Informationen zur App-Leistung und lokalen Speicherung.
                </p>
                <PerformanceDashboard />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>

        <section>
          <SectionHeader
            icon={<Trash2 className="h-5 w-5" />}
            title="Daten & Konto löschen"
            description="Lokale Daten oder dein gesamtes Konto endgültig entfernen (DSGVO Art. 17)."
          />
          <DangerZoneSettings />
        </section>
      </div>
    </div>
  );
}

export default EnhancedSettings;