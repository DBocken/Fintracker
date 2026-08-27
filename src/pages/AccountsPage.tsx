import { AccountManager } from "@/components/accounts/AccountManager";
import { CashSection } from "@/components/accounts/CashSection";
import { ManualAssetsSection } from "@/features/accounts/presentation/ManualAssetsSection";
import { FeatureGate } from "@/components/FeatureGate";
import FinanceErrorState from "@/features/shared/presentation/FinanceErrorState";
import { useAccountsLoadState } from "@/features/accounts/application/use-accounts-load-state";

/**
 * Beide Karten dieser Seite lesen denselben Kontenbestand. Scheitert er, ist
 * das EIN Problem — also gehört die Aussage darüber der Seite und nicht jeder
 * Karte einzeln, sonst steht zweimal dasselbe „Erneut versuchen"
 * untereinander (WP-9.6, [REGRESSION] siehe `AccountsPage.error-state.test`).
 *
 * Der Lesezustand kommt seit WP 6.5a aus `features/accounts/application` und
 * ist kein zweiter Ladevorgang: Gleicher Schlüssel heißt gleicher
 * Cache-Eintrag — TanStack Query bündelt das (AGENTS.md §4, „keine doppelten
 * Queries"). Die Karten behalten ihre eigene Fehlerbehandlung, weil sie auch
 * außerhalb dieser Seite stehen können; unter ihr greift sie nie.
 */
export default function AccountsPage() {
  const { hasLoadError, retry } = useAccountsLoadState();

  if (hasLoadError) {
    return <FinanceErrorState onRetry={retry} />;
  }

  return (
    <div className="space-y-6">
      <CashSection />
      {/* Vermögenswerte ohne Buchung (Welle 4) — ohne Gate: Wer sein Auto
          erfassen will, braucht dafür keine Bankanbindung. */}
      <ManualAssetsSection />
      <FeatureGate feature="bankSync">
        <AccountManager />
      </FeatureGate>
    </div>
  );
}
