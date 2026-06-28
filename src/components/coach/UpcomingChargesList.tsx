import { useMemo } from "react";
import { format, parseISO } from "date-fns";
import { de } from "date-fns/locale";
import { useForecast } from "@/hooks/useForecast";
import { getUpcomingCharges, expenseCharges } from "@/lib/upcoming-charges";
import { InfoGroup } from "@/components/common/InfoGroup";
import ListRow from "@/components/common/ListRow";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { useGentleMode } from "@/components/providers/GentleModeProvider";

const ISO = "yyyy-MM-dd";

/** „heute" / „morgen" / „in N Tagen". */
function whenLabel(daysUntil: number): string {
  if (daysUntil <= 0) return "heute";
  if (daysUntil === 1) return "morgen";
  return `in ${daysUntil} Tagen`;
}

interface Props {
  /** Bezugszeitpunkt (Default jetzt) – injizierbar für deterministische Tests. */
  now?: Date;
  /** Vorschau-Fenster in Tagen (Default 30). */
  horizonDays?: number;
}

/**
 * Feature 1 – „Welche Abbuchungen stehen als Nächstes an?".
 *
 * Reines Readout (Usability-Audit „Karten sind Aktionen": kein Karten-Chrome →
 * {@link InfoGroup}). Liest die bereits konto-gebundenen, status-gefilterten
 * Flows aus dem Forecast und zeigt die nächsten Ausgaben kompakt als Liste.
 */
export default function UpcomingChargesList({ now = new Date(), horizonDays = 30 }: Props) {
  const { input, isLoading } = useForecast();
  const { enabled: gentle } = useGentleMode();
  const fromISO = format(now, ISO);

  const charges = useMemo(() => {
    const flows = input?.recurringFlows ?? [];
    return expenseCharges(getUpcomingCharges(flows, { fromISO, horizonDays }));
  }, [input, fromISO, horizonDays]);

  if (isLoading) return <Skeleton className="h-32 w-full rounded-2xl" />;

  if (charges.length === 0) {
    return (
      <InfoGroup
        title="Anstehende Abbuchungen"
        description={`Keine Abbuchungen in den nächsten ${horizonDays} Tagen erkannt.`}
      >
        <p className="text-sm text-muted-foreground">
          Sobald wiederkehrende Verträge erkannt sind, siehst du hier, was als Nächstes
          von deinem Konto abgeht.
        </p>
      </InfoGroup>
    );
  }

  const total = charges.reduce((sum, c) => sum + Math.abs(c.amount), 0);

  return (
    <InfoGroup
      title="Anstehende Abbuchungen"
      description={`Nächste ${horizonDays} Tage · ${charges.length} ${
        charges.length === 1 ? "Buchung" : "Buchungen"
      } · ${gentle ? "•••" : formatCurrency(total)} gesamt`}
    >
      <div className="divide-y divide-border/60">
        {charges.map((c) => (
          <ListRow
            key={`${c.flowId}-${c.dateISO}`}
            icon="💳"
            title={c.name}
            subtitle={`${whenLabel(c.daysUntil)} · ${format(parseISO(c.dateISO), "EEE, dd.MM.", {
              locale: de,
            })}`}
            value={gentle ? "•••" : formatCurrency(c.amount)}
          />
        ))}
      </div>
    </InfoGroup>
  );
}
