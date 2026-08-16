"use client";

import PageHeader from "@/features/shared/presentation/PageHeader";
import BillingSection from "@/features/billing/presentation/BillingSection";
import { useI18n } from "@/i18n/useI18n";

/**
 * Route `/billing` — dünner Einstieg (§3).
 *
 * `/premium` war nicht frei: Dort liegt die Analyse-Fläche (`AnalysisPage`),
 * ein Premium-**Feature**, keine Kaufseite.
 */
export default function BillingPage() {
  const { t } = useI18n();

  return (
    <div className="container mx-auto max-w-3xl space-y-6 p-4">
      <PageHeader title={t("billing.title")} description={t("billing.subtitle")} />
      <BillingSection />
    </div>
  );
}
