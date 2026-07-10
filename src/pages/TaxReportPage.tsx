import { useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '@/components/common/PageHeader';
import EmptyState from '@/components/common/EmptyState';
import { useI18n } from '@/i18n/useI18n';
import { getTransactions, getCategories } from '@/services/transaction-service';
import { getTaxYearProfile } from '@/services/tax-profile-service';
import { buildTaxYearReport } from '@/lib/tax-report';
import { listAvailablePeriods } from '@/components/dashboard/period-utils';
import { TaxYearPicker } from '@/components/tax/TaxYearPicker';
import { TaxSummaryStrip } from '@/components/tax/TaxSummaryStrip';
import { TaxRubricCard } from '@/components/tax/TaxRubricCard';
import { TaxCommuteCard } from '@/components/tax/TaxCommuteCard';
import { TaxSuggestionsSection } from '@/components/tax/TaxSuggestionsSection';
import { TaxExportCard } from '@/components/tax/TaxExportCard';
import { TaxDisclaimer } from '@/components/tax/TaxDisclaimer';

const FALLBACK_YEAR = new Date().getFullYear();

/**
 * „Was kannst du absetzen?" — jahresweise Übersicht steuerrelevanter Ausgaben,
 * gruppiert nach Steuer-Rubrik/Anlage. Steuerdaten bleiben strikt lokal.
 */
export default function TaxReportPage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions', locale],
    queryFn: () => getTransactions(5000),
  });
  const { data: categories = [] } = useQuery({
    queryKey: ['categories', locale],
    queryFn: getCategories,
  });

  const years = useMemo(() => {
    const fromData = listAvailablePeriods(transactions, 'Jahr').map((p) => Number(p.value));
    const set = new Set<number>(fromData);
    set.add(FALLBACK_YEAR);
    return Array.from(set).sort((a, b) => b - a);
  }, [transactions]);

  const paramYear = Number(searchParams.get('year'));
  const year = years.includes(paramYear) ? paramYear : years[0] ?? FALLBACK_YEAR;

  const { data: profile = null } = useQuery({
    queryKey: ['taxYearProfile', year],
    queryFn: () => getTaxYearProfile(year),
  });

  const report = useMemo(
    () => buildTaxYearReport(transactions, year, profile),
    [transactions, year, profile],
  );

  const setYear = (y: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('year', String(y));
    setSearchParams(next, { replace: true });
  };

  // Deep-Link auf die konkrete Buchung — TransactionsPage öffnet sie via ?tx=.
  const openTransaction = (id: string) => navigate(`/transactions?tx=${encodeURIComponent(id)}`);

  const hasMarked = report.txCount > 0;

  return (
    <div className="mx-auto w-full max-w-screen-lg space-y-6">
      <PageHeader
        title={t('tax.page.title', 'Steuer')}
        description={t('tax.page.subtitle', 'Was kannst du absetzen?')}
        actions={<TaxYearPicker years={years} value={year} onChange={setYear} />}
      />

      {!report.paramsExact && (
        <p className="text-xs text-warning">
          {t('tax.page.paramsClamped', 'Für {year} liegen noch keine amtlichen Werte vor – es gelten die Werte aus {used}.')
            .replace('{year}', String(year))
            .replace('{used}', String(report.paramsUsedYear))}
        </p>
      )}

      <TaxSummaryStrip report={report} />

      <TaxSuggestionsSection transactions={transactions} categories={categories} onOpenTransaction={openTransaction} />

      {hasMarked ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground">{t('tax.page.rubrikenTitle', 'Nach Steuer-Rubrik')}</h2>
          <div className="space-y-3">
            {report.rubrics.map((r) => (
              <TaxRubricCard key={r.rubricId} report={r} onOpenTransaction={openTransaction} />
            ))}
          </div>
        </section>
      ) : (
        <EmptyState title={t('tax.page.emptyTitle', 'Noch nichts markiert')} description={t('tax.page.emptyBody', '')} />
      )}

      <TaxCommuteCard year={year} />

      {hasMarked && <TaxExportCard report={report} transactions={transactions} />}

      <p className="text-xs text-muted-foreground">
        {t('tax.page.valuesForYear', 'Werte für Veranlagungszeitraum {year}').replace('{year}', String(report.paramsUsedYear))}
      </p>
      <TaxDisclaimer />
    </div>
  );
}
