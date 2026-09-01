/**
 * Globale Atmosphäre für die App-Shell (WP-3.1, Nachzug).
 *
 * `AtmosphereLayer` hing in `AppShell` seit WP-3.1 an einem fest verdrahteten
 * `{ temperature: 'neutral', intensity: 0, pulse: 'steady' }` — die Schicht war
 * eingebaut, aber unsichtbar. `deriveAtmosphere` wurde ausschließlich von der
 * Finanzstadt genutzt. Dieser Hook schließt die Lücke und speist die Shell aus
 * denselben Finanzdaten.
 *
 * ## Warum der Hook nichts lädt
 *
 * Die Shell rendert auf JEDER Route — auch auf Einstellungen und CSV-Import.
 * Würde sie ihre eigene Query starten, läge auf jeder Route ein Lesevorgang
 * über bis zu 5000 Buchungen, nur um einen Hintergrund mit maximal 8 %
 * Deckkraft einzufärben. Performance ist laut Plan §11 nicht kompensierbar,
 * und das Plattform-Prinzip (§4) verbietet doppelte Queries ausdrücklich.
 *
 * Der Hook liest deshalb mit `enabled: false` nur MIT, was andere Seiten
 * ohnehin in den Cache legen (Dashboard, Buchungen, Budgets, Stadt teilen sich
 * diese Query-Keys). Folge: Auf den Finanzseiten ist die Atmosphäre live; ruft
 * jemand die App kalt auf einer datenlosen Seite auf, bleibt sie neutral, bis
 * das erste Mal Daten geladen wurden. Das ist der bewusste Tausch — eine
 * fehlende Tönung ist folgenlos, eine Query je Routenwechsel nicht.
 *
 * @see docs/aaa-plus/implementation-plan.md — §3 Drei-Ebenen-Modell
 * @see src/hooks/useAtmosphereState.ts — die reine Ableitung
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { financeKeys } from '@/features/shared/data/finance-query-keys';
import { getAllTransactions } from '@/services/transaction-service';
import { getBudgetOverview, currentMonthKey } from '@/services/budget-service';
import type { BudgetOverview } from '@/services/budget-service';
import { monthKeyOf } from '@/lib/budget-logic';
import { sumIncome, sumExpenses } from '@/lib/analysis-data';
import type { Transaction } from '@/types';
import { useAtmosphereState, type AtmosphereState } from './useAtmosphereState';

/**
 * Atmosphäre-Zustand aus den bereits geladenen Finanzdaten.
 *
 * @param reference Bezugsdatum für „laufender Monat". Nur für Tests gedacht —
 *   in der App bleibt es bei der aktuellen Zeit.
 */
export function useGlobalAtmosphere(reference: Date = new Date()): AtmosphereState {
  // `enabled: false`: nur am Cache lauschen, nie selbst anstoßen. Siehe Kopf.
  const { data: transactions } = useQuery<Transaction[]>({
    queryKey: financeKeys.transactionsAll,
    queryFn: () => getAllTransactions(),
    enabled: false,
  });

  const { data: budgetOverview } = useQuery<BudgetOverview>({
    // Schlüssel wie in BudgetsPage.tsx — bewusst identisch, damit derselbe
    // Cache-Eintrag getroffen wird.
    queryKey: ['budget-overview'],
    queryFn: () => getBudgetOverview(),
    enabled: false,
  });

  const monthKey = currentMonthKey(reference);

  const input = useMemo(() => {
    const ofMonth = (transactions ?? []).filter((t) => monthKeyOf(t.date) === monthKey);
    return {
      // Aggregation über @/lib/analysis-data, nicht über lokale reduce-Ketten
      // (AGENTS.md §8).
      monthlyIncome: sumIncome(ofMonth),
      monthlyExpenses: sumExpenses(ofMonth),
      hasData: ofMonth.length > 0,
      // Fehlender Budget-Cache heißt „unbekannt", nicht „nachweislich keine
      // Überschreitung" — 0 verschärft die Stimmung nicht, sondern lässt sie
      // allein am Saldo hängen.
      budgetOvercount: budgetOverview?.statuses.filter((s) => s.health === 'over').length ?? 0,
    };
  }, [transactions, budgetOverview, monthKey]);

  return useAtmosphereState(input);
}
