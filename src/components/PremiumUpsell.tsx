"use client";

import {
  BarChart3,
  TrendingUp,
  LineChart as LineChartIcon,
  CreditCard,
  SplitSquareHorizontal,
} from "lucide-react";
import LockedPreview from "@/components/premium/LockedPreview";
import { FEATURES, type FeatureKey } from "@/lib/tier";

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
    case "trading":
      return (
        <div className="space-y-3">
          <LineChartIcon className="h-5 w-5 text-brand" />
          <svg viewBox="0 0 100 50" className="h-24 w-full">
            <polyline
              points="0,40 15,30 30,35 45,20 60,25 75,10 100,15"
              fill="none"
              stroke="hsl(var(--brand))"
              strokeWidth="2"
            />
          </svg>
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

const FEATURE_COPY: Record<
  FeatureKey,
  { title: string; eyebrow: string; benefits: string[] }
> = {
  bankSync: {
    title: "Konten automatisch synchronisieren",
    eyebrow: "Anmeldung nötig",
    benefits: [
      "Umsätze landen automatisch im Tracker – kein CSV-Export mehr nötig.",
      "Deine Daten bleiben lokal auf deinem Gerät; die Bank muss nur dich kennen.",
      "Verbindung jederzeit mit einem Klick trennbar.",
    ],
  },
  premiumAnalytics: {
    title: "Tiefenanalyse deiner Finanzen",
    eyebrow: "Premium-Vorschau",
    benefits: [
      "Geldflüsse als Sankey-Diagramm – sieh sofort, wohin dein Geld geht.",
      "Heatmap & Wochenmuster decken teure Gewohnheiten auf.",
      "Smart Insights heben deine größten Hebel automatisch hervor.",
    ],
  },
  simulation: {
    title: "Finanzielle Zukunft durchspielen",
    eyebrow: "Premium-Vorschau",
    benefits: [
      "Spiele Sparpläne und größere Anschaffungen vorab durch.",
      "Sieh, wie sich Entscheidungen auf deinen Notgroschen auswirken.",
      "Erreiche deine Meilensteine planbar statt zufällig.",
    ],
  },
  trading: {
    title: "Depot & Trading im Blick",
    eyebrow: "Premium-Vorschau (Beta)",
    benefits: [
      "Behalte Wertentwicklung und Allokation an einem Ort.",
      "Verbinde Investitionen mit deiner Gesamtfinanzlage.",
      "Experimentelle Beta – ohne Anlageempfehlung.",
    ],
  },
  splitTransactions: {
    title: "Buchungen auf mehrere Kategorien aufteilen",
    eyebrow: "Premium-Vorschau",
    benefits: [
      "Teile eine Buchung cent-genau auf mehrere Kategorien auf.",
      "Großeinkäufe sauber trennen – Lebensmittel, Drogerie, Haushalt.",
      "Deine Auswertungen werden dadurch deutlich präziser.",
    ],
  },
  // Free-Kernnutzen: erscheint nur, falls einmal anonym (Login-Story).
  basicContracts: {
    title: "Verträge & Fixkosten erkennen",
    eyebrow: "Anmeldung nötig",
    benefits: [
      "Wiederkehrende Kosten und Einnahmen werden automatisch erkannt.",
      "Status setzen, ablehnen oder beenden – du behältst die Kontrolle.",
      "Kostenlos mit Login, deine Daten bleiben lokal.",
    ],
  },
  basicForecast: {
    title: "Monatsprognose",
    eyebrow: "Anmeldung nötig",
    benefits: [
      "Sieh, wie sich dein Kontostand über den Monat entwickelt.",
      "Erkenne früh, wann es eng werden könnte.",
      "Kostenlos mit Login, deine Daten bleiben lokal.",
    ],
  },
  advancedContracts: {
    title: "Vertrags-Tiefenanalyse",
    eyebrow: "Premium-Vorschau",
    benefits: [
      "Historische Entwicklung von Verträgen und Einnahmen über die Zeit.",
      "Optimierungs- und Kündigungshinweise für teure Verträge.",
      "Tiefe Insights statt nur einer Liste.",
    ],
  },
  advancedForecast: {
    title: "Erweiterte Prognose",
    eyebrow: "Premium-Vorschau",
    benefits: [
      "Szenarien und Was-wäre-wenn-Analysen durchspielen.",
      "Monte-Carlo-Bandbreiten statt nur einer Linie.",
      "Plane größere Entscheidungen mit Sicherheitspuffer.",
    ],
  },
  familyMode: {
    title: "Haushalts- & Paarmodus",
    eyebrow: "Premium-Vorschau",
    benefits: [
      "Gemeinsame Ausgaben fair aufteilen und ausgleichen.",
      "Behalte private und geteilte Kosten getrennt im Blick.",
      "Alles lokal – ohne deine Daten zu teilen.",
    ],
  },
  receiptLineItems: {
    title: "Belege bis auf Produktebene",
    eyebrow: "Premium-Vorschau",
    benefits: [
      "Einzelne Produkte vom Kassenbon erfassen.",
      "Auswertungen bis auf Artikelebene.",
      "Konservativ erkannt – im Zweifel lieber nichts Falsches.",
    ],
  },
  budgetPremium: {
    title: "Smarte Budgets mit Regeln & Übertrag",
    eyebrow: "Premium-Vorschau",
    benefits: [
      "Adaptive Limits passen sich deinem tatsächlichen Ausgabeverhalten an.",
      "Eigene Match-Regeln ordnen Buchungen automatisch dem Budget zu.",
      "Übertrag: Nicht genutztes Budget wandert in den Folgemonat.",
    ],
  },
};

interface PremiumUpsellProps {
  feature: FeatureKey;
}

/**
 * Begehrlicher Locked-Preview-Fallback (Audit C-P1/E). Wählt anhand des
 * benötigten Tiers automatisch Login- vs. Premium-Story und CTA.
 */
export function PremiumUpsell({ feature }: PremiumUpsellProps) {
  const copy = FEATURE_COPY[feature];
  const needsLogin = FEATURES[feature] === "free";

  return (
    <LockedPreview
      eyebrow={copy.eyebrow}
      title={copy.title}
      benefits={copy.benefits}
      preview={<PreviewMock feature={feature} />}
      cta={
        needsLogin
          ? { label: "Mit Google anmelden", to: "/login", icon: "login" }
          : { label: "Mehr über Premium", to: "/settings", icon: "premium" }
      }
      note="Es entstehen für dich keine Kosten und es werden keine Daten ohne deine Zustimmung übertragen."
    />
  );
}
