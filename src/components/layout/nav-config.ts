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
  HardDrive,
  Sparkles,
  Banknote,
  Coins,
} from "lucide-react";
import { isFeatureEnabled, type FeatureFlag } from "@/lib/feature-flags";

import type { Tier } from "@/lib/tiers";

export type NavItem = {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Mindest-Tier für dieses Ziel (Issue #27). Ohne Angabe: anonym nutzbar. */
  requiredTier?: Tier;
  /** Nur sichtbar, wenn dieses lokale Feature-Flag aktiv ist (z. B. Trading-Beta). */
  betaFlag?: FeatureFlag;
};

export type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

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
      { label: "Analyse", path: "/premium", icon: Zap, requiredTier: "premium" },
      { label: "Simulation", path: "/simulation", icon: PlayCircle, requiredTier: "premium" },
      {
        label: "Trading",
        path: "/trading",
        icon: LineChart,
        requiredTier: "premium",
        betaFlag: "trading_beta",
      },
    ],
  },
  {
    id: "daten",
    label: "Daten",
    items: [
      { label: "CSV Upload", path: "/csv", icon: Upload },
      { label: "Daten Export", path: "/export", icon: Download },
    ],
  },
  {
    id: "verwaltung",
    label: "Verwaltung",
    items: [
      { label: "Konten", path: "/accounts", icon: CreditCard },
      { label: "Verträge", path: "/contracts", icon: Wallet },
      { label: "Einstellungen", path: "/settings", icon: Settings },
    ],
  },
  {
    id: "mehr",
    label: "Mehr",
    items: [
      { label: "Backups", path: "/backups", icon: HardDrive },
    ],
  },
];

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
