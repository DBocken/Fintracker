"use client";

import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Lock, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTier } from "@/hooks/useTier";
import type { FeatureKey } from "@/lib/tiers";

type RequireTierProps = {
  feature: FeatureKey;
  children: ReactNode;
  /** Eigener Fallback statt des Standard-Hinweises. */
  fallback?: ReactNode;
};

function LoginHint() {
  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-3 p-5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <LogIn className="h-4 w-4" aria-hidden="true" />
          Anmeldung nötig
        </div>
        <p className="text-sm text-muted-foreground">
          Für dieses Feature muss deine Bank uns kennen — nicht wir dich. Deine
          Finanzdaten bleiben auch nach der Anmeldung lokal auf deinem Gerät.
        </p>
        <Button asChild size="sm">
          <Link to="/login">Mit Google anmelden</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function PremiumHint() {
  return (
    <Card>
      <CardContent className="flex flex-col items-start gap-3 p-5">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Lock className="h-4 w-4" aria-hidden="true" />
          Premium-Feature
        </div>
        <p className="text-sm text-muted-foreground">
          Dieses Feature gehört zum Premium-Bereich.
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Deklaratives Feature-Gating (Issue #27):
 *
 *   <RequireTier feature="bank_sync">…</RequireTier>
 *
 * Zeigt im anonymen Modus einen freundlichen Login-Hinweis statt der Kinder.
 */
export default function RequireTier({ feature, children, fallback }: RequireTierProps) {
  const { isEnabled, requiredTier, loading } = useTier();

  if (loading) return null;
  if (isEnabled(feature)) return <>{children}</>;
  if (fallback !== undefined) return <>{fallback}</>;

  return requiredTier(feature) === "premium" ? <PremiumHint /> : <LoginHint />;
}
