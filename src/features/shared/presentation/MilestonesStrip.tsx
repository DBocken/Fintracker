import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/useI18n";
import type { MilestoneStatus } from "@/lib/milestone-types";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { SignatureMoment } from "@/features/shared/presentation/SignatureMoment";

/**
 * Meilenstein-Anzeige. `variant="compact"` (Coach) zeigt nur den letzten Erfolg
 * und das nächste erreichbare Ziel; `variant="full"` (eigene Seite) zeigt den
 * kompletten Fortschrittspfad. Animationen laufen nur beim erstmaligen Erreichen
 * und respektieren `prefers-reduced-motion` – kein beschämendes Hervorheben
 * schlechter Werte.
 */
export default function MilestonesStrip({
  milestones,
  variant = "full",
}: {
  milestones: MilestoneStatus[];
  variant?: "full" | "compact";
}) {
  const { t } = useI18n();
  const justAchieved = milestones.filter((m) => m.justAchieved);
  const reduce = useReducedMotion();

  if (variant === "compact") {
    const lastAchieved = [...milestones].reverse().find((m) => m.achieved);
    const nextGoal = milestones.find((m) => !m.achieved);
    const cards = [lastAchieved, nextGoal].filter(Boolean) as MilestoneStatus[];

    return (
      <div className="space-y-4">
        {justAchieved.length > 0 && (
            <SignatureMoment
              title={t("milestones.justAchieved")}
              icon={justAchieved[0].definition.icon}
              subtitle={justAchieved.map((m) => m.definition.title).join(", ")}
              variant="default"
            />
          )}
  
          {/* KEIN `sm:` in dieser Datei, und das ist kein Geschmack: Die
              fokussierte Dichte reicht bis 768 px, `sm` beginnt bei 640 —
              zwischen beiden Werten waere `sm:grid-cols-2` in fokussiert AKTIV
              und brauchte eine Gegenregel. `kompakt:` beginnt bei genau der
              Dichteschwelle und laesst die Frage gar nicht erst entstehen
              (dieselbe Lehre wie bei InfoStatStrip). */}
          <div className="grid grid-cols-1 gap-3 kompakt:grid-cols-2">
            {cards.map((m) => (
            <div
              key={m.definition.key}
              className={cn(
                // Regel 10: ein wiederholter Eintrag bekommt keine Karte je
                // Stueck. In kompakt liegen die Kacheln NEBENeinander, dort
                // ordnet die Toenung wirklich; in fokussiert stehen sie
                // untereinander, und dann ordnet die Reihenfolge — der Rahmen
                // erzeugt nur Schachtelung.
                "flex items-center gap-3 py-2 kompakt:rounded-lg kompakt:p-3",
                m.achieved
                  ? "kompakt:bg-positive/5"
                  : "opacity-70 kompakt:bg-muted/20 kompakt:opacity-100"
              )}
            >
              <div className="relative text-2xl">
                {m.definition.icon}
                {!m.achieved && <Lock className="absolute -right-1 -top-1 h-3.5 w-3.5 text-muted-foreground" />}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase text-muted-foreground">
                  {m.achieved ? t("health.lastAchieved") : t("health.nextGoal")}
                </div>
                <div className="truncate text-sm font-medium">{m.definition.title}</div>
                {!m.achieved && (
                  <div className="truncate text-xs text-muted-foreground">{m.definition.description}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {justAchieved.length > 0 && (
        <SignatureMoment
          title={t("milestones.justAchieved")}
          icon={justAchieved[0].definition.icon}
          subtitle={justAchieved.map((m) => m.definition.title).join(", ")}
          variant="large"
        />
      )}

      {/* `lg` (1024) liegt vollstaendig oberhalb der Dichteschwelle (768) und
          ist deshalb nur in kompakt je wahr — es darf bleiben. `sm` (640)
          liegt darunter und ist ersetzt. */}
      <div className="grid grid-cols-1 gap-3 kompakt:grid-cols-3 lg:grid-cols-5">
        {milestones.map((m, i) => (
          <motion.div
            key={m.definition.key}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? { duration: 0 } : { delay: i * 0.04 }}
            className={cn(
              "py-2 kompakt:rounded-lg kompakt:p-3 kompakt:text-center",
              m.achieved
                ? "kompakt:bg-positive/5"
                : "opacity-70 kompakt:bg-muted/20"
            )}
          >
            <div className="relative text-2xl">
              {m.definition.icon}
              {!m.achieved && (
                <Lock className="absolute -right-1 -top-1 h-3.5 w-3.5 text-muted-foreground" />
              )}
            </div>
            <div className="mt-1 text-xs font-medium leading-tight">{m.definition.title}</div>
            {!m.achieved && (
              <div className="mt-1 text-[11px] leading-snug text-muted-foreground">{m.definition.description}</div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
