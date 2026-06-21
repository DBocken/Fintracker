"use client";

import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Lock, Sparkles, Check, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface LockedPreviewProps {
  /** Eyebrow, z. B. "Premium-Vorschau" oder "Anmeldung nötig". */
  eyebrow: string;
  title: string;
  /** Drei konkrete Nutzenpunkte. */
  benefits: string[];
  /** Geblurrte Beispiel-/Demo-Vorschau (statisches Mock). */
  preview: ReactNode;
  /** CTA-Konfiguration. */
  cta: { label: string; to: string; icon?: "login" | "premium" };
  /** Fußnote (Datenschutz/Disclaimer). */
  note?: string;
}

/**
 * Begehrlicher „Locked Preview" statt reiner Sperre (Audit C-P1/E):
 * geblurrte Beispiel-Visualisierung + drei Nutzenpunkte + ein klarer CTA,
 * damit gesperrte Bereiche eine Upgrade-Story erzählen statt nur „verboten".
 */
export default function LockedPreview({
  eyebrow,
  title,
  benefits,
  preview,
  cta,
  note,
}: LockedPreviewProps) {
  const CtaIcon = cta.icon === "login" ? LogIn : Sparkles;
  return (
    <Card variant="premium" className="overflow-hidden p-0">
      <CardContent className="p-0">
        <div className="grid gap-0 md:grid-cols-2">
          {/* Geblurrte Vorschau */}
          <div className="relative min-h-[180px] border-b md:border-b-0 md:border-r">
            <div
              aria-hidden
              className="pointer-events-none select-none p-5 blur-sm saturate-50 [filter:blur(6px)]"
            >
              {preview}
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-background/90 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
                <Lock className="h-3.5 w-3.5" />
                Vorschau
              </span>
            </div>
          </div>

          {/* Nutzen + CTA */}
          <div className="flex flex-col gap-4 p-5">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-premium">
                <Sparkles className="h-3.5 w-3.5" />
                {eyebrow}
              </div>
              <h3 className="mt-1 text-xl font-semibold">{title}</h3>
            </div>
            <ul className="space-y-2">
              {benefits.slice(0, 3).map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-positive" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <div className="mt-auto space-y-2">
              <Button asChild className="w-full sm:w-auto">
                <Link to={cta.to}>
                  <CtaIcon className="mr-1.5 h-4 w-4" />
                  {cta.label}
                </Link>
              </Button>
              {note ? <p className={cn("text-xs text-muted-foreground")}>{note}</p> : null}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
