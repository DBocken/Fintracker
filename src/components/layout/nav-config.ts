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
  Gauge,
  HardDrive,
  Sparkles,
  Banknote,
  Coins,
} from "lucide-react";

import type { Tier } from "@/lib/tiers";

export type NavItem = {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Mindest-Tier für dieses Ziel (Issue #27). Ohne Angabe: anonym nutzbar. */
  requiredTier?: Tier;
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
      { label: "Trading", path: "/trading", icon: LineChart, requiredTier: "premium" },
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
      { label: "Performance", path: "/performance", icon: Gauge },
      { label: "Backups", path: "/backups", icon: HardDrive },
    ],
  },
];