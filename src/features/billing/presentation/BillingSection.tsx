"use client";

import { AlertTriangle, Check, CreditCard, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import EmptyState from "@/features/shared/presentation/EmptyState";
import InteractiveCard from "@/features/shared/presentation/InteractiveCard";
import { useI18n } from "@/i18n/useI18n";
import { useBilling } from "../application/use-subscription";
import type { StartCheckoutOptions } from "../application/use-start-checkout";

/**
 * Kauf-Fläche (WP 6.3).
 *
 * **Ein ViewModel, eine Präsentation** (§4): Die Breitenunterschiede sind
 * Dichte (Spaltenzahl, Textgröße), keine Feature-Unterschiede — deshalb kein
 * `hidden md:*` ohne Gegenstück und kein zweiter Datenweg.
 *
 * Die vier Zustände werden **auseinandergehalten**: „kein Abo" und „Status
 * nicht prüfbar" sehen einander zum Verwechseln ähnlich, sagen aber das
 * Gegenteil. Genau diese Verwechslung hat `/debts` einmal behaupten lassen, es
 * gebe keine Schulden — hier wäre sie teurer: Sie behauptet gegenüber einem
 * zahlenden Nutzer, er habe kein Abo.
 */
export default function BillingSection(options: StartCheckoutOptions = {}) {
  const { t } = useI18n();
  const billing = useBilling(options);

  if (billing.screen === "loading") {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        {t("billing.loading")}
      </p>
    );
  }

  if (billing.screen === "unavailable") {
    // Kein Zahlungsweg hinterlegt (Normalfall vor dem Deployment). Ehrlich
    // benennen statt eine Kauf-Schaltfläche zu zeigen, die ins Leere führt.
    return (
      <EmptyState
        icon={CreditCard}
        title={t("billing.unavailableTitle")}
        description={t("billing.unavailableBody")}
      />
    );
  }

  if (billing.screen === "error") {
    return (
      <EmptyState
        icon={AlertTriangle}
        title={t("billing.errorTitle")}
        description={t("billing.errorBody")}
        action={
          <Button variant="outline" onClick={() => window.location.reload()}>
            <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("billing.retry")}
          </Button>
        }
      />
    );
  }

  if (billing.screen === "active") {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-positive/40 bg-positive/10 p-4">
          <Check className="mt-0.5 h-5 w-5 shrink-0 text-positive" aria-hidden="true" />
          <div>
            <p className="font-medium">{t("billing.activeTitle")}</p>
            {billing.validUntilLabel ? (
              <p className="text-sm text-muted-foreground">
                {t("billing.activeUntil").replace("{date}", billing.validUntilLabel)}
              </p>
            ) : null}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{t("billing.cancelHint")}</p>
      </div>
    );
  }

  // screen === "empty": kein Abo — das Kaufangebot.
  return (
    <div className="space-y-4">
      <InteractiveCard
        onClick={billing.startCheckout}
        disabled={billing.isStarting}
        aria-label={t("billing.upgradeCta")}
        indicator="arrow"
      >
        <div className="flex items-start gap-3 p-4">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-brand" aria-hidden="true" />
          <div className="space-y-1 text-left">
            <p className="font-medium">{t("billing.upgradeTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("billing.upgradeBody")}</p>
            <p className="text-sm font-medium text-brand">
              {billing.isStarting ? t("billing.starting") : t("billing.upgradeCta")}
            </p>
          </div>
        </div>
      </InteractiveCard>

      {billing.checkoutFailed ? (
        <p className="text-sm text-destructive" role="alert">
          {t("billing.checkoutFailed")}
        </p>
      ) : null}

      <p className="text-xs text-muted-foreground">{t("billing.providerHint")}</p>
    </div>
  );
}
