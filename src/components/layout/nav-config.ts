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
  Gauge,
  HandCoins,
  Landmark,
  Briefcase,
  Building2,
  PartyPopper,
  GraduationCap,
  MessageCircleQuestion,
} from "lucide-react";
import type { Tier, FeatureKey } from "@/lib/tier";
import { isNavPathVisible, type NavFeatureId } from "@/lib/life-situations";

export type NavItem = {
  label: string;
  /** i18n-Key für das Label; `label` dient als Fallback (DE). */
  labelKey?: string;
  /**
   * Langform des Seitennamens für die Überschrift im Inhalt.
   *
   * `labelKey` ist bewusst die KURZFORM — Navigationslabels sind
   * breitenbegrenzt (Bodennavigation), weshalb dort „Verfügbar" statt
   * „Verfügbares Geld" und „Unterm Strich" statt „Besitz minus Schulden"
   * steht. Als Überschrift wäre das eine Verschlechterung. Ohne Angabe gilt
   * `labelKey`; gemessen weichen nur drei Ziele ab.
   */
  titleKey?: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Mindest-Tier für dieses Ziel (Issue #27). Ohne Angabe: anonym nutzbar. */
  requiredTier?: Tier;
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
      { label: "Schulden", labelKey: "nav.items.debts", titleKey: "debts.title", path: "/debts", icon: Banknote },
      { label: "Nettovermögen", labelKey: "nav.items.netWorth", titleKey: "netWorth.title", path: "/net-worth", icon: Coins },
      {
        label: "Liquidität",
        labelKey: "nav.items.liquidity",
        titleKey: "other.liquidityTitle",
        path: "/liquidity",
        icon: Activity,
        subtitle: "Wann wird dein Geld knapp?",
        subtitleKey: "nav.subtitles.liquidity",
      },
      {
        label: "Budgets",
        labelKey: "nav.items.budgets",
        path: "/budgets",
        icon: Gauge,
        subtitle: "Tanks für deine Ausgaben",
        subtitleKey: "nav.subtitles.budgets",
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
      {
        label: "Einkommen",
        labelKey: "nav.items.income",
        path: "/income",
        icon: HandCoins,
        subtitle: "Woher kommt mein Geld?",
        subtitleKey: "nav.subtitles.income",
      },
      { label: "Buchungen", labelKey: "nav.items.transactions", path: "/transactions", icon: Receipt },
      {
        label: "Nachfragen",
        labelKey: "financeQuestions.title",
        path: "/fragen",
        icon: MessageCircleQuestion,
        subtitle: "Frag nach deinen Zahlen",
        subtitleKey: "financeQuestions.navSubtitle",
      },
      {
        // Label/Subtitle teilen sich bewusst die specialCategories-Keys (kein
        // eigener nav.items.occasions-Key nötig – DRY über 4 Locales).
        label: "Anlässe",
        labelKey: "specialCategories.title",
        path: "/occasions",
        icon: PartyPopper,
        requiredTier: "premium",
        subtitle: "Was hat der Urlaub wirklich gekostet?",
        subtitleKey: "specialCategories.subtitle",
      },
      {
        label: "Steuer",
        labelKey: "nav.items.tax",
        path: "/tax",
        icon: Landmark,
        subtitle: "Was kannst du absetzen?",
        subtitleKey: "nav.subtitles.tax",
      },
      {
        label: "EÜR",
        labelKey: "nav.items.euer",
        path: "/euer",
        icon: Briefcase,
        subtitle: "Einnahmen − Ausgaben = Gewinn",
        subtitleKey: "nav.subtitles.euer",
      },
      {
        label: "Trends & Berichte",
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
        subtitle: "Depot im Blick",
        subtitleKey: "nav.subtitles.trading",
      },
      {
        // Kein Beta-Etikett mehr: Die Finanzstadt ist die zentrale Darstellung
        // (docs/tutorial-sequence.md) und Ziel der ersten Sitzung. Zentral und
        // „noch im Versuch" widersprechen sich — wer das Finale des
        // Onboardings mit einem Vorbehalt beschriftet, entwertet es.
        label: "Finanzstadt",
        labelKey: "nav.items.city",
        path: "/city",
        icon: Building2,
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
      { label: "Abos & Verträge", labelKey: "nav.items.contracts", path: "/contracts", icon: Wallet },
    ],
  },
  {
    id: "verwaltung",
    label: "Verwaltung",
    labelKey: "nav.groups.verwaltung",
    items: [
      {
        // Der zweite Weg zu den Fuehrungen neben dem Kopfzeilen-Knopf: Wer
        // etwas nachschlagen will, sucht es in der Navigation, nicht in einem
        // Popup. Kein waehlbarer Bereich (`NavFeatureId`) — eine Anleitung
        // abwaehlen zu koennen hilft niemandem.
        label: "Tutorials",
        labelKey: "nav.items.tutorials",
        path: "/tutorials",
        icon: GraduationCap,
        subtitle: "Alle Fuehrungen, Bereich fuer Bereich",
        subtitleKey: "nav.subtitles.tutorials",
      },
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
  "/contracts": "bankSync",
  "/occasions": "specialCategories",
};

/**
 * Liefert die sichtbaren Nav-Gruppen anhand der im Onboarding getroffenen
 * Bereichsauswahl (`@/lib/life-situations`).
 *
 * `null`/`undefined` heißt „keine Auswahl getroffen" und zeigt alles bis auf
 * die Opt-in-Bereiche (`DEFAULT_OFF_FEATURES`, aktuell die EÜR) —
 * Bestandsnutzer verlieren durch das Onboarding nichts und bekommen zugleich
 * nichts ungefragt dazu.
 *
 * Betrifft ausschließlich die **Anzeige**: die Routen bleiben immer
 * registriert (Deep-Links, Coach-Verlinkungen, Bestandsdaten), und jeder
 * Bereich lässt sich in den Einstellungen wieder einschalten.
 */
export function getVisibleNavGroups(
  enabledFeatures?: readonly NavFeatureId[] | null,
  unlockedFeatures?: readonly NavFeatureId[] | null,
): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => isNavPathVisible(item.path, enabledFeatures, unlockedFeatures)),
  })).filter((group) => group.items.length > 0);
}

/**
 * Bottom-Nav (mobil): Kernziele + „Mehr"-Tab (Issue #42).
 * Die Einträge referenzieren NAV_GROUPS über den Pfad, damit Nav-Konfiguration,
 * Command-Palette und Bottom-Nav aus derselben Quelle gespeist werden.
 * `shortLabel` ist die platzsparende Beschriftung für den Tab.
 *
 * Die Finanzstadt steht hier, weil „zentrale Darstellung" und „nur über Mehr →
 * Scrollen erreichbar" sich widersprechen. Vier Tabs plus „Mehr" sind damit
 * das Maximum — danach ist die Leiste auf 375 px zu.
 */
const BOTTOM_NAV_TARGETS: { path: string; shortLabel: string; shortLabelKey: string }[] = [
  { path: "/coach", shortLabel: "Heute", shortLabelKey: "nav.short.coach" },
  { path: "/dashboard", shortLabel: "Übersicht", shortLabelKey: "nav.short.dashboard" },
  { path: "/city", shortLabel: "Stadt", shortLabelKey: "nav.short.city" },
  { path: "/transactions", shortLabel: "Buchungen", shortLabelKey: "nav.short.transactions" },
];

export type BottomNavItem = NavItem & { shortLabel: string; shortLabelKey: string };

/**
 * Bislang brauchte die Bottom-Nav keine Sichtbarkeitsprüfung: Ihre drei Ziele
 * waren durchweg Kernbereiche. Die Finanzstadt ist der erste Eintrag, der
 * (noch) abwählbar ist — ohne Filter erschiene sie hier auch dem, der sie in
 * den Einstellungen ausgeblendet hat, während die Seitenleiste sie versteckt.
 *
 * Sobald `/city` Kernbereich ist (`docs/tutorial-sequence.md`), ist der Filter
 * für sie wirkungslos — und bleibt als Schutz für jeden künftigen Eintrag.
 */
export function getBottomNavItems(
  enabledFeatures?: readonly NavFeatureId[] | null,
  unlockedFeatures?: readonly NavFeatureId[] | null,
): BottomNavItem[] {
  const allItems = NAV_GROUPS.flatMap((group) => group.items);
  return BOTTOM_NAV_TARGETS.flatMap(({ path, shortLabel, shortLabelKey }) => {
    if (!isNavPathVisible(path, enabledFeatures, unlockedFeatures)) return [];
    const item = allItems.find((i) => i.path === path);
    return item ? [{ ...item, shortLabel, shortLabelKey }] : [];
  });
}
