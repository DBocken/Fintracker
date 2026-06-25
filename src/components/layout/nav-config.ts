import type React from "react";
import {
  BarChart3,
  Zap,
  LineChart,
  Upload,
  Download,
  CreditCard,
  Wallet,
  Settings,
  Sparkles,
  Banknote,
  Coins,
  Trophy,
  Receipt,
  Activity,
} from "lucide-react";
import { isFeatureEnabled, type FeatureFlag } from "@/lib/feature-flags";

import type { Tier, FeatureKey } from "@/lib/tier";

export type NavItem = {
  label: string;
  /** i18n-Key für das Label; `label` dient als Fallback (DE). */
  labelKey?: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Mindest-Tier für dieses Ziel (Issue #27). Ohne Angabe: anonym nutzbar. */
  requiredTier?: Tier;
  /** Nur sichtbar, wenn dieses lokale Feature-Flag aktiv ist (z. B. Trading-Beta). */
  betaFlag?: FeatureFlag;
  /** Kurzer Teaser-Untertitel (nur im Nav-Sheet/Sidebar, nicht Bottom-Nav). */
  subtitle?: string;
  /** i18n-Key für den Untertitel; `subtitle` dient als Fallback (DE). */
  subtitleKey?: string;
};

export type NavGroup = {
  id: string;
  label: string;
  /** i18n-Key für das Gruppen-Label; `label` dient als Fallback (DE). */
  labelKey?: string;
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
    labelKey: "nav.groups.coach",
    items: [
      { label: "Heute für dich", labelKey: "nav.items.coach", path: "/coach", icon: Sparkles },
      { label: "Schulden", labelKey: "nav.items.debts", path: "/debts", icon: Banknote },
      { label: "Nettovermögen", labelKey: "nav.items.netWorth", path: "/net-worth", icon: Coins },
      {
        label: "Liquidität",
        labelKey: "nav.items.liquidity",
        path: "/liquidity",
        icon: Activity,
        subtitle: "Wann wird dein Geld knapp?",
        subtitleKey: "nav.subtitles.liquidity",
      },
      { label: "Meilensteine", labelKey: "nav.items.milestones", path: "/milestones", icon: Trophy },
    ],
  },
  {
    id: "analysen",
    label: "Analysen",
    labelKey: "nav.groups.analysen",
    items: [
      { label: "Dashboard", labelKey: "nav.items.dashboard", path: "/dashboard", icon: BarChart3 },
      { label: "Buchungen", labelKey: "nav.items.transactions", path: "/transactions", icon: Receipt },
      {
        label: "Analyse",
        labelKey: "nav.items.premium",
        path: "/premium",
        icon: Zap,
        requiredTier: "premium",
        subtitle: "Sankey, Heatmap & Smart Insights",
        subtitleKey: "nav.subtitles.premium",
      },
      {
        label: "Trading",
        labelKey: "nav.items.trading",
        path: "/trading",
        icon: LineChart,
        requiredTier: "premium",
        betaFlag: "trading_beta",
        subtitle: "Depot im Blick (Beta)",
        subtitleKey: "nav.subtitles.trading",
      },
    ],
  },
  {
    id: "daten",
    label: "Daten & Konten",
    labelKey: "nav.groups.daten",
    items: [
      { label: "Konten", labelKey: "nav.items.accounts", path: "/accounts", icon: CreditCard },
      { label: "CSV Upload", labelKey: "nav.items.csv", path: "/csv", icon: Upload },
      { label: "Daten Export", labelKey: "nav.items.export", path: "/export", icon: Download },
      { label: "Verträge", labelKey: "nav.items.contracts", path: "/contracts", icon: Wallet },
    ],
  },
  {
    id: "verwaltung",
    label: "Verwaltung",
    labelKey: "nav.groups.verwaltung",
    items: [
      { label: "Einstellungen", labelKey: "nav.items.settings", path: "/settings", icon: Settings },
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
const BOTTOM_NAV_TARGETS: { path: string; shortLabel: string; shortLabelKey: string }[] = [
  { path: "/coach", shortLabel: "Heute", shortLabelKey: "nav.short.coach" },
  { path: "/dashboard", shortLabel: "Übersicht", shortLabelKey: "nav.short.dashboard" },
  { path: "/transactions", shortLabel: "Buchungen", shortLabelKey: "nav.short.transactions" },
];

export type BottomNavItem = NavItem & { shortLabel: string; shortLabelKey: string };

export function getBottomNavItems(): BottomNavItem[] {
  const allItems = NAV_GROUPS.flatMap((group) => group.items);
  return BOTTOM_NAV_TARGETS.flatMap(({ path, shortLabel, shortLabelKey }) => {
    const item = allItems.find((i) => i.path === path);
    return item ? [{ ...item, shortLabel, shortLabelKey }] : [];
  });
}
