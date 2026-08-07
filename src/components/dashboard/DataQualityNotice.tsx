import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getAccounts } from "@/services/account-service";
import { deriveAccountDataQuality } from "@/services/account-data-quality-service";
import { useI18n } from "@/i18n/useI18n";
import type { Account } from "@/types";

const MAX_ACCOUNTS_SHOWN = 3;

/**
 * Warnt im Forecast/Liquidity-Kontext vor unvollständiger Datenbasis: Wenn
 * Konten veraltet oder nicht synchronisiert sind, ist jede Prognose nur so gut
 * wie ihre Daten. Es werden ausschließlich Hinweise gezeigt – die
 * Forecast-Berechnung selbst bleibt unverändert.
 */
export function DataQualityNotice() {
  const { t } = useI18n();
  const { data: accounts = [], isError: accountsError } = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: () => getAccounts(),
  });

  // Bewusst kein Fehlerzustand: Dieser Hinweis erscheint ohnehin nur, WENN es
  // etwas zu bemaengeln gibt. Ein Fehlerblock an seiner Stelle waere eine
  // Meldung, wo sonst nichts steht — laut, ohne dem Nutzer zu helfen. Die
  // Flaechen, die dieselben Konten anzeigen, benennen den Lesefehler bereits.
  if (accountsError) return null;

  const problematic = accounts
    .map((account) => deriveAccountDataQuality(account))
    .filter((q) => q.status === "warning" || q.status === "critical");

  if (problematic.length === 0) return null;

  const accountName = (accountId: string) =>
    accounts.find((a) => a.id === accountId)?.name ?? t("dataQuality.accountLabel");

  const shown = problematic.slice(0, MAX_ACCOUNTS_SHOWN);
  const hasCritical = problematic.some((q) => q.status === "critical");

  return (
    <Alert variant={hasCritical ? "destructive" : "default"}>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{t("dataQuality.noticeTitle")}</AlertTitle>
      <AlertDescription>
        <p>
          {t("dataQuality.noticeDescription")}
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
            {t("dataQuality.moreAccounts")
              .replace("{count}", String(problematic.length - shown.length))
              .replace("{plural}", problematic.length - shown.length === 1 ? "Konto" : "Konten")}
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}
