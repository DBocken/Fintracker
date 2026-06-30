import { HeartHandshake, ExternalLink } from "lucide-react";
import type { CounselingRecommendation } from "@/services/debt-guardrails-service";

/**
 * Schuldnerberatungs-Brücke (Issue #50, Epic #24): erscheint NUR, wenn der
 * Tilgungsplan auf eine Überschuldung hindeutet. Vermittelt aktiv an
 * anerkannte, KOSTENLOSE Beratungsstellen und warnt vor kommerziellen
 * „Schuldenregulierern".
 *
 * Bewusst KEIN Karten-Chrome (kein bg-card/Schatten): ein Hinweis-Callout mit
 * mehreren externen Ziel-Links ist keine „eine-Fläche-eine-Aktion"-Karte
 * (siehe docs/design-principles.md, Prinzip 8). RDG: informiert, berät nicht.
 */
export function CounselingBridgeCard({
  recommendation,
}: {
  recommendation: CounselingRecommendation;
}) {
  if (!recommendation.recommended) return null;

  return (
    <section
      className="rounded-xl border border-brand/40 bg-brand/5 p-4 sm:p-5"
      aria-labelledby="counseling-bridge-heading"
    >
      <div className="flex items-start gap-3">
        <HeartHandshake className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
        <div className="min-w-0 space-y-3">
          <div>
            <h3 id="counseling-bridge-heading" className="text-sm font-semibold">
              Hol dir kostenlose Unterstützung
            </h3>
            {recommendation.reason && (
              <p className="mt-1 text-sm text-muted-foreground">{recommendation.reason}</p>
            )}
          </div>

          <ul className="space-y-2">
            {recommendation.services.map((s) => (
              <li key={s.url}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-2 rounded-lg border bg-background p-2.5 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-sm font-medium">
                      {s.name}
                      <ExternalLink
                        className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </span>
                    <span className="block text-xs text-muted-foreground">{s.note}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>

          <p className="text-[11px] text-muted-foreground">{recommendation.warning}</p>
        </div>
      </div>
    </section>
  );
}
