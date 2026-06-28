import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Lock } from "lucide-react";
import PageHeader from "@/components/common/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { evaluateMilestones } from "@/services/milestones-service";
import { useI18n } from "@/i18n/useI18n";

export default function MilestonesPage() {
  const { t } = useI18n();
  const { data: milestones, isLoading } = useQuery({
    queryKey: ["milestones"],
    queryFn: evaluateMilestones,
  });

  const achievedCount = milestones?.filter((m) => m.achieved).length ?? 0;
  const total = milestones?.length ?? 0;
  const pct = total > 0 ? Math.round((achievedCount / total) * 100) : 0;
  const nextGoalKey = milestones?.find((m) => !m.achieved)?.definition.key;

  return (
    <div>
      <PageHeader
        title={t("milestones.title")}
        description={t("milestones.description")}
      />

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : milestones ? (
        <div className="mx-auto max-w-2xl space-y-6">
          {/* Fortschritts-Readout ohne Karte (Usability-Audit „Karten sind
              Aktionen"): kein Rahmen → wirkt nicht antippbar; die Liste darunter
              ist die eigentliche Information. */}
          <div className="overflow-hidden rounded-xl bg-gradient-to-br from-brand/10 via-premium/15 to-transparent p-5 sm:p-6">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-sm text-muted-foreground">{t("milestones.achieved")}</div>
                <div className="mt-1 text-3xl font-semibold tabular-nums">
                  {achievedCount}
                  <span className="text-lg font-normal text-muted-foreground"> / {total}</span>
                </div>
              </div>
              <div className="text-2xl font-semibold tabular-nums text-primary">{pct}%</div>
            </div>
            <Progress value={pct} className="mt-3" />
          </div>

          {/* Fortschrittspfad */}
          <ol className="relative space-y-4 before:absolute before:left-5 before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-border">
            {milestones.map((m) => {
              const isNext = m.definition.key === nextGoalKey;
              return (
                <li key={m.definition.key} className="relative flex gap-4">
                  <div
                    className={cn(
                      "z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 bg-background text-lg",
                      m.achieved
                        ? "border-positive text-positive"
                        : isNext
                          ? "border-primary"
                          : "border-dashed border-muted-foreground/40"
                    )}
                  >
                    {m.achieved ? <CheckCircle2 className="h-5 w-5" /> : <span>{m.definition.icon}</span>}
                  </div>
                  <div
                    className={cn(
                      "flex-1 rounded-lg p-3",
                      m.achieved ? "bg-positive/5" : isNext ? "bg-primary/5" : ""
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn("font-medium", !m.achieved && !isNext && "text-muted-foreground")}>{m.definition.title}</span>
                      {m.achieved ? (
                        <span className="text-xs font-medium text-positive">{t("milestones.achievedBadge")}</span>
                      ) : isNext ? (
                        <span className="text-xs font-medium text-primary">{t("milestones.next")}</span>
                      ) : (
                        <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{m.definition.description}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
    </div>
  );
}
