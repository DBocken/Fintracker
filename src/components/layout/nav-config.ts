import type React from "react";
import {
  BarChart3,
  Zap,
  PlayCircle,
  LineChart,
  Upload,
  Download,
  CreditCard,
  Wallet,
  Settings,
  Sparkles,
  Banknote,
  Coins,
} from "lucide-react";
import { isFeatureEnabled, type FeatureFlag } from "@/lib/feature-flags";

import type { Tier, FeatureKey } from "@/lib/tier";

export type NavItem = {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Mindest-Tier für dieses Ziel (Issue #27). Ohne Angabe: anonym nutzbar. */
  requiredTier?: Tier;
  /** Nur sichtbar, wenn dieses lokale Feature-Flag aktiv ist (z. B. Trading-Beta). */
  betaFlag?: FeatureFlag;
  /** Kurzer Teaser-Untertitel (nur im Nav-Sheet/Sidebar, nicht Bottom-Nav). */
  subtitle?: string;
};

export type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

/**
 * Navigation nach neuem Produktfokus (Issue #42): Coach und Schulden
 * prominent, Analysen konsolidiert, Daten & Verwaltung zusammengefasst.
 * Entwickler-Werkzeuge (Performance) und Backups leben in den
 * Einstellungen, nicht in der Hauptnavigation.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: "coach",
    label: "Coach",
    items: [
      { label: "Heute für dich", path: "/coach", icon: Sparkles },
      { label: "Schulden", path: "/debts", icon: Banknote },
      { label: "Nettovermögen", path: "/net-worth", icon: Coins },
    ],
  },
  {
    id: "analysen",
    label: "Analysen",
    items: [
      { label: "Dashboard", path: "/dashboard", icon: BarChart3 },
      {
        label: "Analyse",
        path: "/premium",
        icon: Zap,
        requiredTier: "premium",
        subtitle: "Sankey, Heatmap & Smart Insights",
      },
      {
        label: "Simulation",
        path: "/simulation",
        icon: PlayCircle,
        requiredTier: "premium",
        subtitle: "Zukunft durchspielen",
      },
      {
        label: "Trading",
        path: "/trading",
        icon: LineChart,
        requiredTier: "premium",
        betaFlag: "trading_beta",
        subtitle: "Depot im Blick (Beta)",
      },
    ],
  },
  {
    id: "daten",
    label: "Daten & Konten",
    items: [
      { label: "Konten", path: "/accounts", icon: CreditCard },
      { label: "CSV Upload", path: "/csv", icon: Upload },
      { label: "Daten Export", path: "/export", icon: Download },
      { label: "Verträge", path: "/contracts", icon: Wallet },
    ],
  },
  {
    id: "verwaltung",
    label: "Verwaltung",
    items: [
      { label: "Einstellungen", path: "/settings", icon: Settings },
    ],
  },
];

/**
 * Zentrale Route-Guard-Schicht (Audit B/D): Pfad → benötigtes Feature.
 * Statt das Gating pro Seite zu verstreuen, rendert `App.tsx` diese Routen
 * über ein gemeinsames `<RouteGuard>`. Eine Quelle der Wahrheit für den
 * Tier-Zugriff auf Route-Ebene.
 */
export const ROUTE_GUARDS: Record<string, FeatureKey> = {
  "/premium": "premiumAnalytics",
  "/simulation": "simulation",
  "/trading": "trading",
  "/contracts": "bankSync",
};

/**
 * Liefert die Nav-Gruppen, gefiltert nach aktiven lokalen Feature-Flags.
 * Gruppen ohne sichtbare Einträge fallen weg.
 */
export function getVisibleNavGroups(): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.betaFlag || isFeatureEnabled(item.betaFlag)),
  })).filter((group) => group.items.length > 0);
}

/**
 * Bottom-Nav (mobil): 4 Kernziele + „Mehr"-Tab (Issue #42).
 * Die Einträge referenzieren NAV_GROUPS über den Pfad, damit Nav-Konfiguration,
 * Command-Palette und Bottom-Nav aus derselben Quelle gespeist werden.
 * `shortLabel` ist die platzsparende Beschriftung für den Tab.
 */
const BOTTOM_NAV_TARGETS: { path: string; shortLabel: string }[] = [
  { path: "/coach", shortLabel: "Heute" },
  { path: "/debts", shortLabel: "Schulden" },
  { path: "/dashboard", shortLabel: "Analyse" },
  { path: "/accounts", shortLabel: "Konten" },
];

export type BottomNavItem = NavItem & { shortLabel: string };

export function getBottomNavItems(): BottomNavItem[] {
  const allItems = NAV_GROUPS.flatMap((group) => group.items);
  return BOTTOM_NAV_TARGETS.flatMap(({ path, shortLabel }) => {
    const item = allItems.find((i) => i.path === path);
    return item ? [{ ...item, shortLabel }] : [];
  });
}
