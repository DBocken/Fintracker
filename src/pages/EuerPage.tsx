import { useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '@/features/shared/presentation/PageHeader';
import EmptyState from '@/features/shared/presentation/EmptyState';
import FinanceErrorState from '@/features/shared/presentation/FinanceErrorState';
import { useI18n } from '@/i18n/useI18n';
import { getAllTransactions, getCategories } from '@/services/transaction-service';
import { getAccounts } from '@/services/account-service';
import { getUserSettings } from '@/services/user-settings-service';
import { useBusinessMode } from '@/hooks/useBusinessMode';
import { getTaxReserveState } from '@/services/tax-reserve-service';
import { buildEuerReport } from '@/lib/euer-report';
import { resolveTaxReservePercent } from '@/lib/tax-reserve';
import { listAvailablePeriods } from '@/features/shared/domain/period-options';
import { TaxYearPicker } from '@/components/tax/TaxYearPicker';
import { TaxDisclaimer } from '@/components/tax/TaxDisclaimer';
import { EuerSummaryStrip } from '@/components/euer/EuerSummaryStrip';
import { EuerLinesCard } from '@/components/euer/EuerLinesCard';
import { EuerPrivatTransfersLine } from '@/components/euer/EuerPrivatTransfersLine';
import { EuerWarningsCard } from '@/components/euer/EuerWarningsCard';
import { TaxReserveTankCard } from '@/components/euer/TaxReserveTankCard';
import { EuerExportCard } from '@/components/euer/EuerExportCard';

const FALLBACK_YEAR = new Date().getFullYear();

/**
 * Einnahmenüberschussrechnung für Einzelunternehmer (v1 Kleinunternehmer §19
 * UStG, Brutto). Route ist IMMER registriert — die Nav zeigt sie nur im
 * Business-Modus (Deep-Links und Bestandsdaten bleiben erreichbar).
 */
export default function EuerPage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // WP-9.6: Der Fallback `= []` macht einen Ladefehler unsichtbar — die Seite
  // rechnet dann eine EÜR aus null Buchungen und zeigt „Gewinn 0,00 €". Das
  // ist keine leere Auskunft, das ist eine falsche.
  //
  // Die vier Abfragen werden zu EINER Aussage zusammengefasst: Wenn irgendeine
  // von ihnen fehlt, ist der Bericht nicht rechenbar. Vier getrennte
  // Fehlermeldungen für dieselbe Ursache wären für den Nutzer vier Rätsel
  // statt eines Hinweises.
  const {
    data: transactions = [],
    isError: txError,
    refetch: refetchTx,
  } = useQuery({
    queryKey: ['transactions', locale],
    queryFn: () => getAllTransactions(),
  });
  const {
    data: categories = [],
    isError: categoriesError,
    refetch: refetchCategories,
  } = useQuery({ queryKey: ['categories', locale], queryFn: getCategories });
  const {
    data: accounts = [],
    isError: accountsError,
    refetch: refetchAccounts,
  } = useQuery({ queryKey: ['accounts'], queryFn: getAccounts });
  const {
    data: settings,
    isError: settingsError,
    refetch: refetchSettings,
  } = useQuery({ queryKey: ['userSettings'], queryFn: getUserSettings });

  const businessMode = useBusinessMode();

  const years = useMemo(() => {
    const fromData = listAvailablePeriods(transactions, 'Jahr').map((p) => Number(p.value));
    const set = new Set<number>(fromData);
    set.add(FALLBACK_YEAR);
    return Array.from(set).sort((a, b) => b - a);
  }, [transactions]);

  const paramYear = Number(searchParams.get('year'));
  const year = years.includes(paramYear) ? paramYear : years[0] ?? FALLBACK_YEAR;

  const {
    data: reserve = null,
    isError: reserveError,
    refetch: refetchReserve,
  } = useQuery({
    queryKey: ['taxReserve', year],
    queryFn: () => getTaxReserveState(year),
  });

  const hasLoadError =
    txError || categoriesError || accountsError || settingsError || reserveError;
  const retryAll = () => {
    void refetchTx();
    void refetchCategories();
    void refetchAccounts();
    void refetchSettings();
    void refetchReserve();
  };

  const report = useMemo(
    () => buildEuerReport(transactions, accounts, year),
    [transactions, accounts, year],
  );

  const percent = reserve?.percent_override ?? resolveTaxReservePercent(settings);

  const setYear = (y: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('year', String(y));
    setSearchParams(next, { replace: true });
  };

  const openTransaction = (id: string) => navigate(`/transactions?tx=${encodeURIComponent(id)}`);

  const hasData =
    report.einnahmen.lines.length > 0 ||
    report.ausgaben.lines.length > 0 ||
    report.privatTransfers.entnahmen > 0 ||
    report.privatTransfers.einlagen > 0;

  return (
    <div className="mx-auto w-full max-w-screen-lg space-y-6">
      <PageHeader
        title={t('euer.page.title', 'EÜR')}
        description={t('euer.page.subtitle', 'Einnahmen − Ausgaben = Gewinn (Einnahmenüberschussrechnung)')}
        actions={<TaxYearPicker years={years} value={year} onChange={setYear} />}
      />

      {/*
        Bei einem Lesefehler endet die Seite hier. Vorher stand die
        Fehlermeldung ueber einem vollstaendig aufgebauten Bericht aus leeren
        Zahlen — inklusive „Noch keine Betriebsdaten". Zwei widersprechende
        Aussagen uebereinander, und die untere ist die gefaehrlichere: Eine
        EUeR ist eine steuerliche Aufstellung, wer ihr glaubt, meldet zu wenig
        ([REGRESSION] `EuerPage.error-state.test.tsx`, WP-12.1).
      */}
      {hasLoadError ? (
        <FinanceErrorState variant="transactions" onRetry={retryAll} />
      ) : (
        <>
      {!report.paramsExact && (
        <p className="text-xs text-warning">
          {t('tax.page.paramsClamped', 'Für {year} liegen noch keine amtlichen Werte vor – es gelten die Werte aus {used}.')
            .replace('{year}', String(year))
            .replace('{used}', String(report.paramsUsedYear))}
        </p>
      )}

      <EuerSummaryStrip report={report} />

      <EuerWarningsCard
        report={report}
        showCandidates={businessMode}
        onOpenTransaction={openTransaction}
      />

      {hasData ? (
        <div className="space-y-3">
          <EuerLinesCard
            titleKey="euer.page.linesIncome"
            titleFallback="Betriebseinnahmen"
            total={report.einnahmen.total}
            lines={report.einnahmen.lines}
            categories={categories}
            onOpenTransaction={openTransaction}
          />
          <EuerLinesCard
            titleKey="euer.page.linesExpenses"
            titleFallback="Betriebsausgaben (Anlage EÜR)"
            total={report.ausgaben.deductibleTotal}
            lines={report.ausgaben.lines}
            categories={categories}
            showDeductible
            onOpenTransaction={openTransaction}
          />
        </div>
      ) : (
        <EmptyState
          title={t('euer.page.emptyTitle', 'Noch keine Betriebsdaten')}
          description={t('euer.page.emptyBody', 'Markiere ein Konto als Geschäftskonto oder Buchungen mit EÜR-Blättern – dann entsteht hier deine EÜR.')}
        />
      )}

      <EuerPrivatTransfersLine report={report} />

      <TaxReserveTankCard
        year={year}
        businessIncomeYtd={report.einnahmen.total}
        percent={percent}
        reserve={reserve}
      />

      {hasData && <EuerExportCard report={report} transactions={transactions} categories={categories} />}

      <TaxDisclaimer />
        </>
      )}
    </div>
  );
}
