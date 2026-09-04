import { useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { useForecast } from '@/hooks/useForecast';
import { getNextIncomeCharge } from '@/lib/upcoming-charges';
import { computeDisposableUntilPayday } from '@/lib/disposable-budget';
import { useQuery } from '@tanstack/react-query';
import { useI18n } from '@/i18n/useI18n';
import { getCoachOverview } from '@/services/coach-service';
import { getFinancialHealth } from '@/services/financial-health-service';
import { evaluateMilestones } from '@/services/milestones-service';
import { getTransactionsPage } from '@/services/transaction-service';
import { getDebts } from '@/services/debt-service';
import { getReceivables } from '@/services/receivable-service';
import { useTier } from '@/hooks/useTier';
import { useTutorialRun } from '@/hooks/useTutorialRun';
import { hasFeatureAccess } from '@/lib/tier';
import { coachKeys } from '../data/coach-query-keys';
import type { CoachViewModel } from './coach-overview-view-model';

/** Leere Rangfolge als stabile Referenz — sonst bricht das Memo bei jedem Render. */
const NO_RECOMMENDATIONS: never[] = [];

/**
 * UI-neutrales ViewModel der Coach-Fläche: die vier Abfragen, ihr gemeinsamer
 * Lade-/Leer-/Fehlerzustand und die fachliche Rangfolge der Empfehlungen.
 * Desktop- und Mobile-Präsentation konsumieren dasselbe Ergebnis.
 *
 * Stand vor der Migration: dieselben vier `useQuery` lagen direkt in
 * `src/pages/CoachPage.tsx`. Solange eine Fläche ihre eigene Datenschicht
 * **ist**, lässt sich keine zweite Präsentation danebenstellen, ohne die
 * Datenbeschaffung ein zweites Mal zu schreiben — genau das misst
 * `check:view-data`.
 */
export function useCoachOverview(): CoachViewModel {
  const { locale } = useI18n();
  const tier = useTier();
  const tutorialRun = useTutorialRun();
  const includeTaxReserve = hasFeatureAccess(tier, 'creatorPack');

  const {
    data: coach,
    isLoading: coachLoading,
    isError: coachError,
    refetch: refetchCoach,
  } = useQuery({
    queryKey: coachKeys.overview(locale, includeTaxReserve, tutorialRun.upcoming),
    queryFn: () => getCoachOverview({ includeTaxReserve, tutorialChapter: tutorialRun.upcoming }),
  });

  const {
    data: health,
    isError: healthError,
    refetch: refetchHealth,
  } = useQuery({
    queryKey: coachKeys.financialHealth(locale),
    queryFn: getFinancialHealth,
  });

  const {
    data: milestones,
    isLoading: milestonesLoading,
    isError: milestonesError,
    refetch: refetchMilestones,
  } = useQuery({
    queryKey: coachKeys.milestones(locale),
    queryFn: evaluateMilestones,
  });

  // Leerer Zustand (Issue #39): ohne Daten gibt es nichts zu coachen — klare
  // nächste Aktion statt leerer Karten. Gefragt wird nur, OB es Bestand gibt
  // (`total`), nicht der Bestand selbst.
  //
  // WP-9.6: `isError` ist hier besonders wichtig — scheitert diese eine
  // Abfrage, bliebe `hasData` `undefined` und die Fläche zeigte weder
  // Leerzustand noch Inhalt, sondern eine halb gefüllte Seite ohne jede
  // Erklärung. Das ist noch undurchsichtiger als eine falsche Auskunft.
  const {
    data: hasData,
    isError: hasDataError,
    refetch: refetchHasData,
  } = useQuery({
    queryKey: coachKeys.hasFinanceData(),
    queryFn: async () => {
      const [txs, debts, receivables] = await Promise.all([
        getTransactionsPage(1, 0),
        getDebts(),
        getReceivables(),
      ]);
      return txs.total > 0 || debts.length > 0 || receivables.length > 0;
    },
  });

  const hasError = coachError || healthError || milestonesError || hasDataError;

  const retry = useCallback(() => {
    void refetchCoach();
    void refetchHealth();
    void refetchMilestones();
    void refetchHasData();
  }, [refetchCoach, refetchHealth, refetchMilestones, refetchHasData]);

  // „Wie viel bleibt bis zum nächsten Gehalt?" — die eine Zahl, die eine
  // Coach-Fläche heute wirklich beantworten soll. Sie lag bisher IN der
  // Darstellung (`DisposableTankCard` holte sich `useForecast` selbst); damit
  // konnte keine zweite Präsentation sie zeigen, ohne die Beschaffung ein
  // zweites Mal zu schreiben — genau der Befund von ADR Regel 1.
  //
  // `useForecast` teilt sich seinen Cache mit der Karte, es entsteht also
  // keine zweite Abfrage; die Rechnung selbst ist rein
  // (`computeDisposableUntilPayday`).
  const { input: forecastInput, isLoading: forecastLoading } = useForecast();

  const disposable = useMemo(() => {
    if (!forecastInput) return null;
    const flows = forecastInput.recurringFlows ?? [];
    const fromISO = format(new Date(), 'yyyy-MM-dd');
    // Sichtfenster gut zwei Monate, falls gerade erst gezahlt wurde.
    const nextIncome = getNextIncomeCharge(flows, { fromISO, horizonDays: 62 });
    // Ohne erkannten regelmäßigen Eingang gibt es kein „bis zum Gehalt".
    // `null` heißt hier ausdrücklich „nicht bestimmbar", nicht „null Euro".
    if (!nextIncome) return null;
    return computeDisposableUntilPayday({
      accounts: forecastInput.accounts,
      recurringFlows: flows,
      fromISO,
      paydayISO: nextIncome.dateISO,
      daysUntilPayday: nextIncome.daysUntil,
    });
  }, [forecastInput]);

  const recommendations = coach?.recommendations ?? NO_RECOMMENDATIONS;
  const focus = recommendations[0];
  const followUps = useMemo(() => recommendations.slice(1), [recommendations]);

  return {
    loading: coachLoading,
    // `hasData === false` statt `!hasData`: Solange die Abfrage läuft, ist der
    // Wert `undefined` — „noch nicht gefragt" ist kein Leerzustand.
    isEmpty: hasData === false && !hasError,
    hasError,
    retry,
    coach,
    health,
    milestones,
    milestonesLoading,
    disposable,
    disposableLoading: forecastLoading,
    focus,
    followUps,
    hasDebt: (coach?.debtSummary.totalDebt ?? 0) > 0,
  };
}
