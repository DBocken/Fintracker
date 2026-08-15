"use client";

import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useI18n } from "@/i18n/useI18n";
import { cn } from "@/lib/utils";
import type { FeatureKey } from "@/lib/tier";
import { getFeatureCopy } from "./feature-copy";

interface PremiumTeaserProps {
  feature: FeatureKey;
  /**
   * `data-tour-id`, damit die Führung auf die gesperrte Funktion zeigen kann
   * (`TutorialStep.premium`). Ohne den Teaser gäbe es für Freinutzer gar kein
   * Element, auf das ein solcher Schritt zeigen könnte.
   */
  tourId?: string;
  /**
   * Rein dekoratives Abbild der Funktion. **Nicht** die Funktion selbst:
   * siehe Bauform-Kommentar unten.
   */
  children?: ReactNode;
  className?: string;
}

/**
 * Zeigt eine gesperrte Premium-Funktion **ausgegraut an**, statt sie zu
 * verschweigen. Ersetzt die Stellen, an denen `FeatureGate` bisher
 * `fallback={null}` bekam: Wer die Funktion nicht hat, sah dort nichts und
 * konnte folglich auch nicht wissen, dass es sie gibt.
 *
 * Abgrenzung zu {@link LockedPreview}: Der dort gezeigte Locked-Preview ist
 * eine ganzseitige Upgrade-Story (Vorschau + drei Nutzenpunkte + CTA) und
 * steht, wo sonst der ganze Bereich stünde. Der Teaser ist die kleine Form
 * für eine einzelne Funktion **innerhalb** einer sonst nutzbaren Fläche.
 *
 * **Es wird nur ein Dummy übertragen.** Der Teaser rendert bewusst NICHT die
 * echten `children` mit `opacity`/`pointer-events-none` darüber: Dann läge
 * die echte Premium-Funktion samt ihrer Logik weiterhin im Baum und wäre
 * allein durch Wegnehmen einer CSS-Klasse bedienbar. Sichtbarkeit ist hier
 * eine Produktentscheidung, keine Zugriffsentscheidung — die Sperre bleibt
 * das Nicht-Rendern in `FeatureGate`.
 *
 * Karten-Regel (AGENTS.md §9): Die Karte ist als Ganzes der Link zur
 * Freischaltung — kein toter Rahmen um einen inneren Knopf.
 */
export default function PremiumTeaser({
  feature,
  tourId,
  children,
  className,
}: PremiumTeaserProps) {
  const { t } = useI18n();
  // Gemeinsame Quelle mit `PremiumUpsell` — siehe `feature-copy.ts`, warum das
  // hier nicht wiederholt wird.
  const { title, benefits } = getFeatureCopy(t, feature);
  const benefit = benefits[0];

  return (
    <Link
      to="/settings"
      data-premium-teaser=""
      data-tour-id={tourId}
      aria-label={`${title} – ${t("premiumTeaser.unlock")}`}
      className={cn(
        "group block rounded-xl border border-dashed bg-muted/30 p-4 transition",
        "hover:border-premium/60 hover:bg-muted/50",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-premium/50",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-muted-foreground">{title}</span>
            <span className="shrink-0 rounded-full bg-premium px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide text-premium-foreground">
              {t("premiumTeaser.badge")}
            </span>
          </div>
          <p className="pt-1 text-xs text-muted-foreground">{benefit}</p>
        </div>
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-premium" aria-hidden="true" />
      </div>

      {children ? (
        <div
          data-premium-preview=""
          aria-hidden="true"
          className="pointer-events-none mt-3 select-none opacity-50 grayscale"
        >
          {children}
        </div>
      ) : null}

      <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-premium group-hover:underline">
        {t("premiumTeaser.unlock")}
      </span>
    </Link>
  );
}
