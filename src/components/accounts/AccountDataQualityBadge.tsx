import { Badge } from "@/components/ui/badge";
import type {
  AccountDataQuality,
  AccountDataQualityStatus,
} from "@/services/account-data-quality-service";

const STATUS_BADGE_CLASS: Record<AccountDataQualityStatus, string> = {
  good: "bg-positive/15 text-positive dark:text-positive",
  warning: "border-warning/40 text-warning dark:text-warning",
  critical: "bg-destructive/15 text-destructive dark:text-destructive",
  manual: "bg-muted text-muted-foreground",
  unknown: "bg-muted text-muted-foreground",
};

interface AccountDataQualityBadgeProps {
  quality: AccountDataQuality;
  /** Wie viele Issues maximal direkt sichtbar angezeigt werden (Default 2). */
  maxIssues?: number;
}

/**
 * Zeigt pro Konto die Datenqualität: Badge mit Label, Score in Prozent und die
 * wichtigsten Issues. Texte kommen aus dem Service und bleiben bewusst freundlich.
 */
export function AccountDataQualityBadge({
  quality,
  maxIssues = 2,
}: AccountDataQualityBadgeProps) {
  const visibleIssues = quality.issues.slice(0, maxIssues);

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className={`text-xs shrink-0 ${STATUS_BADGE_CLASS[quality.status]}`}
          title={quality.description}
        >
          Datenqualität: {quality.label}
        </Badge>
        <span className="text-xs text-muted-foreground tabular-nums">
          {quality.score}%
        </span>
      </div>
      {visibleIssues.length > 0 && (
        <ul className="space-y-0.5">
          {visibleIssues.map((issue, index) => (
            <li
              key={`${issue.code}-${index}`}
              className={`text-xs ${
                issue.severity === "critical"
                  ? "text-destructive"
                  : issue.severity === "warning"
                    ? "text-warning"
                    : "text-muted-foreground"
              }`}
            >
              {issue.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
