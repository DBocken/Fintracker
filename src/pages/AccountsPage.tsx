import { useQuery } from "@tanstack/react-query";
import { AccountManager } from "@/components/accounts/AccountManager";
import { CashSection } from "@/components/accounts/CashSection";
import { FeatureGate } from "@/components/FeatureGate";
import FinanceErrorState from "@/components/common/FinanceErrorState";
import { getAccounts } from "@/services/account-service";

/**
 * Beide Karten dieser Seite lesen dieselbe Abfrage `["accounts"]`. Scheitert
 * sie, ist das EIN Problem — also gehört die Aussage darüber der Seite und
 * nicht jeder Karte einzeln, sonst steht zweimal dasselbe „Erneut versuchen"
 * untereinander (WP-9.6, [REGRESSION] siehe `AccountsPage.error-state.test`).
 *
 * Die Abfrage hier ist kein zweiter Ladevorgang: Gleicher Schlüssel heißt
 * gleicher Cache-Eintrag — TanStack Query bündelt das (AGENTS.md §4, „keine
 * doppelten Queries"). Die Karten behalten ihre eigene Fehlerbehandlung, weil
 * sie auch außerhalb dieser Seite stehen können; unter ihr greift sie nie.
 */
export default function AccountsPage() {
  const { isError, refetch } = useQuery({ queryKey: ["accounts"], queryFn: getAccounts });

  if (isError) {
    return <FinanceErrorState onRetry={() => void refetch()} />;
  }

  return (
    <div className="space-y-6">
      <CashSection />
      <FeatureGate feature="bankSync">
        <AccountManager />
      </FeatureGate>
    </div>
  );
}
