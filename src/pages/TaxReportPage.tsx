import { useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '@/features/shared/presentation/PageHeader';
import EmptyState from '@/features/shared/presentation/EmptyState';
import { LoadingSwap } from '@/features/shared/presentation/LoadingSwap';
import FinanceErrorState from '@/features/shared/presentation/FinanceErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/i18n/useI18n';
import { getTransactions, getCategories } from '@/services/transaction-service';
import { getTaxYearProfile } from '@/services/tax-profile-service';
import { useBusinessMode } from '@/hooks/useBusinessMode';
import { buildTaxYearReport, hasEuerMarkings } from '@/lib/tax-report';
import { listAvailablePeriods } from '@/features/shared/domain/period-options';
import { TaxYearPicker } from '@/components/tax/TaxYearPicker';
import { TaxSummaryStrip } from '@/components/tax/TaxSummaryStrip';
import { TaxRubricCard } from '@/components/tax/TaxRubricCard';
import { TaxCommuteCard } from '@/components/tax/TaxCommuteCard';
import { TaxSuggestionsSection } from '@/components/tax/TaxSuggestionsSection';
import { TaxExportCard } from '@/components/tax/TaxExportCard';
import { TaxDisclaimer } from '@/components/tax/TaxDisclaimer';
import { EuerPointerCard } from '@/components/tax/EuerPointerCard';

const FALLBACK_YEAR = new Date().getFullYear();

/**
 * „Was kannst du absetzen?" — jahresweise Übersicht steuerrelevanter Ausgaben,
 * gruppiert nach Steuer-Rubrik/Anlage. Steuerdaten bleiben strikt lokal.
 */
export default function TaxReportPage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // `isLoading`/`isError` sind hier nicht Kosmetik: Ohne sie rendert die Seite
  // im ersten Durchgang mit `transactions = []`, zeigt „Noch nichts markiert"
  // und ersetzt das Sekunden spaeter durch die Rubriken-Liste — eine Aussage,
  // die sie noch gar nicht treffen konnte, und der groesste Layout-Sprung der
  // App (CLS 0,123 gegen ein Budget von 0,1; WP-10.4).
  const {
    data: transactions = [],
    isLoading: transactionsLoading,
    isError: transactionsError,
    refetch: refetchTransactions,
  } = useQuery({
    queryKey: ['transactions', locale],
    queryFn: () => getTransactions(5000),
  });
  const {
    data: categories = [],
    isError: categoriesError,
    refetch: refetchCategories,
  } = useQuery({
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

  const {
    data: profile = null,
    isError: profileError,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: ['taxYearProfile', year],
    queryFn: () => getTaxYearProfile(year),
  });

  const businessMode = useBusinessMode();
  // Pointer zur EÜR: im Einzelunternehmer-Modus immer; sonst nur, wenn Bestandsdaten
  // existieren — die Entkopplung darf markierte Buchungen nie unsichtbar machen.
  const showEuerPointer = businessMode || hasEuerMarkings(transactions);

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

  // Eine Ursache, eine Aussage: Faellt der Speicher als Ganzes aus, scheitern
  // die Abfragen der Seite UND die der Vorschlagsrubrik. Beide zeigten dann
  // denselben Satz untereinander. Die Rubrik behaelt ihren eigenen
  // Fehlerzustand — sie kann auch allein scheitern —, tritt hier aber zurueck
  // ([REGRESSION] `TaxReportPage.error-state.test.tsx`, WP-9.6).
  const hasLoadError = transactionsError || categoriesError || profileError;

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

      {showEuerPointer && <EuerPointerCard />}

      {!hasLoadError && (
        <TaxSuggestionsSection transactions={transactions} categories={categories} onOpenTransaction={openTransaction} />
      )}

      {hasLoadError ? (
        <FinanceErrorState
          variant="transactions"
          onRetry={() => {
            void refetchTransactions();
            void refetchCategories();
            void refetchProfile();
          }}
        />
      ) : (
        // Der Ladezustand umschliesst ALLES ab hier, nicht nur die Rubriken.
        // Wie viele Rubriken es gibt, weiss erst die Antwort — jede vorher
        // gerenderte Zeile darunter (Arbeitsweg-Karte, Export, Fussnote,
        // Hinweis) muesste danach verrutschen. Genau das war der groesste
        // Layout-Sprung der App (CLS 0,123; WP-10.4).
        <LoadingSwap
          loading={transactionsLoading}
          skeleton={
            <div className="space-y-6">
              <Skeleton variant="shimmer" className="h-64 w-full rounded-2xl" />
              <Skeleton variant="shimmer" className="h-48 w-full rounded-2xl" />
            </div>
          }
        >
          <div className="space-y-6">
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
        </LoadingSwap>
      )}
    </div>
  );
}
