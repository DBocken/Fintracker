import { Link } from 'react-router-dom';
import { Settings as SettingsIcon, ShieldCheck, Tags, Wand2, Trash2, HardDrive, Palette, Languages, Home, LayoutList } from 'lucide-react';
import { useI18n } from '@/i18n/useI18n';
import type { HierarchicalCategory } from '../../types';
import { useSettingsOverview } from '@/features/settings/application/use-settings-overview';
import { CategoryManager } from './CategoryManager';
import { CategoryPreview } from './CategoryPreview';
import { TimeRangeSettings } from './TimeRangeSettings';
import { AutoCategorizationSettings } from './AutoCategorizationSettings';
import { LearnedCategorizationSettings } from './LearnedCategorizationSettings';
import { QuestionLearningSettings } from './QuestionLearningSettings';
import TaxReserveSettings from './TaxReserveSettings';
import { BulkAssignment } from './BulkAssignment';
import { PerformanceDashboard } from '../PerformanceDashboard';
import { LocalEncryptionSettings } from './LocalEncryptionSettings';
import { PrivacySyncAnalyticsSettings } from './PrivacySyncAnalyticsSettings';
import { TelemetrySettings } from './TelemetrySettings';
import { DangerZoneSettings } from './DangerZoneSettings';
import DiagnosticsSettings from './DiagnosticsSettings';
import { CloudMcpSyncCard } from './CloudMcpSyncCard';
import { AppearanceSettings } from './AppearanceSettings';
import { LanguageSettings } from './LanguageSettings';
import { WordingSettings } from './WordingSettings';
import { HouseholdSettings } from './HouseholdSettings';
import { useBusinessMode } from '@/hooks/useBusinessMode';
import NavFeatureSettings from './NavFeatureSettings';
import { FeatureGate } from '@/components/FeatureGate';
import PremiumTeaser from '@/components/premium/PremiumTeaser';
import { BackupManager } from '../BackupManager';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { InfoStatStrip } from '@/features/shared/presentation/InfoGroup';
import FinanceErrorState from '@/features/shared/presentation/FinanceErrorState';

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

/**
 * Einstellungen — Darstellung.
 *
 * **Warum diese Datei noch unter `src/components/settings/` steht — die
 * Blockade ist gefallen (WP 6.7).** WP 6.5b hat die Datenzugriffe in die Slice
 * gehoben, die Darstellung aber bewusst hier gelassen: Sie benutzt mit
 * `InfoStatStrip` und `FinanceErrorState` zwei app-eigene Bausteine, die
 * damals unter `src/components/common/` lagen — ein Umzug haette die
 * `maxBausteine`-Spalte von `pnpm check:slice-presentation` erhoeht (36 → 38),
 * eine Ratsche, die nur sinken darf (Rechnung: `src/features/settings/README.md`,
 * „Warum noch keine `presentation/`"). Seit WP 6.7 liegen beide unter
 * `@/features/shared/presentation/` und zaehlen nicht mehr. Was vom Umzug
 * dieser Flaeche bleibt, ist allein die Feature-UI-Spalte (`max`, +20 durch
 * Geschwister-Bausteine aus `components/settings/`) — eine andere Frage mit
 * einer anderen Antwort, und ein eigenes Paket.
 */
export function EnhancedSettings() {
  const { t } = useI18n();
  const businessMode = useBusinessMode();
  // Sämtliche Datenzugriffe der Fläche liegen seit WP 6.5b im ViewModel der
  // Slice (`features/settings/application`) — hier bleibt die Darstellung.
  const settings = useSettingsOverview();

  const handleCategoryDelete = (category: HierarchicalCategory) => {
    if (category.id) {
      settings.deleteCategory(category.id);
    }
  };

  if (settings.hasLoadError) {
    return <FinanceErrorState variant="data" onRetry={settings.retry} />;
  }

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
                { label: t('common.categoriesLabel'), value: settings.categoryCount },
                {
                  label: t('settings.retentionLabel', 'Aufbewahrung'),
                  value: t('settings.retentionMonthsShort', '{months} M').replace(
                    '{months}',
                    String(settings.retentionMonths),
                  ),
                },
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
              categories={settings.categories}
              suggestion={settings.categorySuggestion}
              onCategorySave={settings.saveCategory}
              onCategoryDelete={handleCategoryDelete}
              onCategoryEdit={(category) => settings.selectCategory(category.id)}
              onApplySuggestion={settings.recategorize}
            />
            <CategoryPreview
              category={settings.preview.category}
              affectedTransactions={settings.preview.transactions}
              onPreview={() => void settings.loadPreview()}
              onApply={settings.recategorize}
              onUndo={settings.undoRecategorization}
              isProcessing={settings.preview.isLoading}
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
            icon={<LayoutList className="h-5 w-5" />}
            title={t('onboarding.manage.title', 'Bereiche & Navigation')}
            description={t(
              'onboarding.manage.description',
              'Welche Bereiche in der Navigation erscheinen. Ausgeblendetes bleibt über Links und Lesezeichen erreichbar.',
            )}
          />
          <NavFeatureSettings />
        </section>

        <section className="mb-10">
          <SectionHeader
            icon={<Languages className="h-5 w-5" />}
            title={t('settings.languageSettingsTitle', 'Sprache')}
            description={t('settings.languageSettingsDescription', 'Wähle die Sprache der App (Deutsch/Englisch/Klingonisch).')}
          />
          <LanguageSettings />

          <WordingSettings />
        </section>

        <FeatureGate
          feature="familyMode"
          fallback={
            <section className="mb-10">
              <PremiumTeaser feature="familyMode" />
            </section>
          }
        >
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
              retentionMonths={settings.retentionMonths}
              onRetentionChange={settings.setRetentionMonths}
            />
            <AutoCategorizationSettings
              autoConfirm={settings.autoConfirmMapping}
              onAutoConfirmChange={settings.setAutoConfirmMapping}
            />
            <LearnedCategorizationSettings />
            <QuestionLearningSettings />
            <BulkAssignment
              status={settings.bulk.status}
              results={settings.bulk.results}
              onBulkAssign={settings.recategorize}
              onRecategorize={settings.recategorize}
              isRecategorizing={settings.bulk.isRunning}
            />
            {/* Prozent-Regler wird vom Einzelunternehmer-Modus mitgenutzt —
                im Modus sichtbar auch ohne Creator-Pack. Der Modus selbst wird
                über den Bereich „EÜR" in „Bereiche & Navigation" geschaltet. */}
            {businessMode ? (
              <TaxReserveSettings />
            ) : (
              <FeatureGate
                feature="creatorPack"
                fallback={<PremiumTeaser feature="creatorPack" />}
              >
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
          {/* WP-11.2: Der Opt-in-Schalter gehoert laut decision-log F-1 hierher
              — in denselben Abschnitt wie Verschluesselung und Sync-Datei, weil
              es dieselbe Frage ist: Was verlaesst dieses Geraet? */}
          <div className="mt-6">
            <TelemetrySettings />
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