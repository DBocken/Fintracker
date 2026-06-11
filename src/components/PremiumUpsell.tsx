"use client";

import { Lock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { FeatureKey } from "@/lib/tier";

const FEATURE_COPY: Record<FeatureKey, { title: string; description: string }> = {
  bankSync: {
    title: "Login nötig",
    description:
      "Für die Bankanbindung benötigen wir eine Anmeldung, weil deine Bank wissen muss, wer den Zugriff anfragt — nicht weil wir dich kennen wollen.",
  },
  premiumAnalytics: {
    title: "Premium-Vorschau",
    description:
      "Die erweiterte Analyse ist Teil von Premium und noch nicht freigeschaltet. Sobald Premium verfügbar ist, siehst du hier detaillierte Auswertungen deiner Finanzen.",
  },
  simulation: {
    title: "Premium-Vorschau",
    description:
      "Die Finanzsimulation ist Teil von Premium und noch nicht freigeschaltet. Du kannst hier schon einmal sehen, was dich erwartet.",
  },
  trading: {
    title: "Premium-Vorschau",
    description:
      "Das Trading-Dashboard ist Teil von Premium und noch nicht freigeschaltet. Du kannst hier schon einmal sehen, was dich erwartet.",
  },
};

interface PremiumUpsellProps {
  feature: FeatureKey;
}

/**
 * Honest fallback shown for features that require a higher tier: explains
 * *why* access is restricted instead of a hard error or blank page.
 */
export function PremiumUpsell({ feature }: PremiumUpsellProps) {
  const copy = FEATURE_COPY[feature];

  return (
    <Card variant="premium">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          {copy.title}
        </CardTitle>
        <CardDescription>{copy.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Es entstehen für dich keine Kosten und es werden keine Daten ohne deine Zustimmung übertragen.
        </p>
      </CardContent>
    </Card>
  );
}
