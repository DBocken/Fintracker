import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getAccounts } from "@/services/account-service";
import { deriveAccountDataQuality } from "@/services/account-data-quality-service";
import type { Account } from "@/types";

const MAX_ACCOUNTS_SHOWN = 3;

/**
 * Warnt im Forecast/Liquidity-Kontext vor unvollständiger Datenbasis: Wenn
 * Konten veraltet oder nicht synchronisiert sind, ist jede Prognose nur so gut
 * wie ihre Daten. Es werden ausschließlich Hinweise gezeigt – die
 * Forecast-Berechnung selbst bleibt unverändert.
 */
export function DataQualityNotice() {
  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: () => getAccounts(),
  });

  const problematic = accounts
    .map((account) => deriveAccountDataQuality(account))
    .filter((q) => q.status === "warning" || q.status === "critical");

  if (problematic.length === 0) return null;

  const accountName = (accountId: string) =>
    accounts.find((a) => a.id === accountId)?.name ?? "Konto";

  const shown = problematic.slice(0, MAX_ACCOUNTS_SHOWN);
  const hasCritical = problematic.some((q) => q.status === "critical");

  return (
    <Alert variant={hasCritical ? "destructive" : "default"}>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Prognose eingeschränkt</AlertTitle>
      <AlertDescription>
        <p>
          Die Vorschau basiert auf veralteten oder unvollständigen Kontodaten.
          Synchronisiere die folgenden Konten für eine genauere Prognose:
        </p>
        <ul className="mt-1 list-disc pl-5">
          {shown.map((q) => (
            <li key={q.accountId}>
              {accountName(q.accountId)}
              {q.issues[0] ? ` – ${q.issues[0].message}` : ""}
            </li>
          ))}
        </ul>
        {problematic.length > shown.length && (
          <p className="mt-1 text-xs">
            … und {problematic.length - shown.length} weitere{" "}
            {problematic.length - shown.length === 1 ? "Konto" : "Konten"}.
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}
