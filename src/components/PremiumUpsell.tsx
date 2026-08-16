"use client";

import {
  BarChart3,
  TrendingUp,
  CreditCard,
  SplitSquareHorizontal,
} from "lucide-react";
import LockedPreview from "@/components/premium/LockedPreview";
import { FEATURES, type FeatureKey } from "@/lib/tier";
import { getFeatureCopy } from "@/components/premium/feature-copy";
import { useI18n } from "@/i18n/useI18n";

/**
 * Statische, geblurrte Mini-Mocks je Feature. Bewusst rein dekorativ
 * (aria-hidden im LockedPreview) — sie zeigen „wie es aussehen wird".
 */
function PreviewMock({ feature }: { feature: FeatureKey }) {
  switch (feature) {
    case "bankSync":
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-brand" />
            <div className="h-3 w-28 rounded bg-muted" />
          </div>
          {[72, 48, 60].map((w, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg border p-2">
              <div className="h-2.5 rounded bg-muted" style={{ width: `${w}px` }} />
              <div className="h-2.5 w-12 rounded bg-brand/40" />
            </div>
          ))}
        </div>
      );
    case "simulation":
      return (
        <div className="space-y-3">
          <TrendingUp className="h-5 w-5 text-brand" />
          <div className="flex h-24 items-end gap-1.5">
            {[30, 45, 40, 60, 75, 70, 90].map((h, i) => (
              <div key={i} className="flex-1 rounded-t bg-brand/40" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      );
    case "splitTransactions":
      return (
        <div className="space-y-3">
          <SplitSquareHorizontal className="h-5 w-5 text-brand" />
          {[
            [60, 40],
            [45, 55],
          ].map((parts, i) => (
            <div key={i} className="flex items-center gap-1.5 rounded-lg border p-2">
              <div className="h-2.5 rounded bg-brand/40" style={{ width: `${parts[0]}%` }} />
              <div className="h-2.5 rounded bg-muted" style={{ width: `${parts[1]}%` }} />
            </div>
          ))}
        </div>
      );
    case "premiumAnalytics":
    default:
      return (
        <div className="space-y-3">
          <BarChart3 className="h-5 w-5 text-brand" />
          <div className="grid grid-cols-2 gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg border p-2">
                <div className="h-2 w-10 rounded bg-muted" />
                <div className="mt-2 h-4 w-16 rounded bg-brand/40" />
              </div>
            ))}
          </div>
        </div>
      );
  }
}

interface PremiumUpsellProps {
  feature: FeatureKey;
}

/**
 * Begehrlicher Locked-Preview-Fallback (Audit C-P1/E). Wählt anhand des
 * benötigten Tiers automatisch Login- vs. Premium-Story und CTA.
 */
export function PremiumUpsell({ feature }: PremiumUpsellProps) {
  const { t } = useI18n();
  const copy = getFeatureCopy(t, feature);
  const needsLogin = FEATURES[feature] === "free";

  return (
    <LockedPreview
      eyebrow={copy.eyebrow}
      title={copy.title}
      benefits={copy.benefits}
      preview={<PreviewMock feature={feature} />}
      cta={
        needsLogin
          ? { label: t('upsell.loginCta'), to: "/login", icon: "login" }
          // Bis WP 6.3 zeigte dieser Weg auf /settings — ein Platzhalter, weil
          // es nichts zu kaufen gab. Jetzt fuehrt er dorthin, wo gekauft wird.
          : { label: t('upsell.premiumCta'), to: "/billing", icon: "premium" }
      }
      note={t('upsell.note')}
    />
  );
}
