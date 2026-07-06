import PageHeader from '@/components/common/PageHeader';
import IncomeStreamsPanel from '@/components/income/IncomeStreamsPanel';
import { useI18n } from '@/i18n/useI18n';

/**
 * "Woher kommt mein Geld?" — Spiegelbild des Ausgaben-Dashboards für Einnahmen:
 * Aufschlüsselung nach Einkommens-Hauptkategorie, Verlauf über Zeit und die
 * automatisch erkannten Einkommensströme.
 */
export default function IncomePage() {
  const { t } = useI18n();
  return (
    <div className="mx-auto w-full max-w-screen-2xl">
      <PageHeader title={t('income.title')} description={t('income.subtitle')} />
      <IncomeStreamsPanel />
    </div>
  );
}
