import { Outlet, useLocation } from "react-router-dom";
import { Search } from "lucide-react";
import { withErrorBoundary } from "@/components/ErrorBoundary";
import SideNav from "@/components/layout/SideNav";
import MobileNav from "@/components/layout/MobileNav";
import BottomNav from "@/components/layout/BottomNav";
import CommandPalette from "@/components/CommandPalette";
import DataSourceDialog from "@/components/onboarding/DataSourceDialog";
import TutorialHost from "@/components/tutorial/TutorialHost";
import OnboardingDialog from "@/components/onboarding/OnboardingDialog";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import PrivacyIndicator from "@/components/PrivacyIndicator";
import OfflineIndicator from "@/features/shared/presentation/OfflineIndicator";
import DemoDataBanner from "@/components/DemoDataBanner";
import NotificationsBell from "@/components/NotificationsBell";
import UserQuickProfile from "@/components/UserQuickProfile";
import { AtmosphereLayer } from "@/features/shared/presentation/AtmosphereLayer";
import { useGlobalAtmosphere } from "@/hooks/useGlobalAtmosphere";
import { Button } from "@/components/ui/button";
import { NAV_GROUPS } from "@/components/layout/nav-config";
import { useI18n } from "@/i18n/useI18n";

// Route-Level-Fehlergrenze (RES-7 / WP 1.6): faengt einen Render-Crash EINER
// Flaeche ab, ohne die AppShell-Navigation (SideNav/BottomNav/Header) mit
// abzureissen — vorher gab es nur den globalen ErrorBoundary in main.tsx, der
// beim Absturz die gesamte App inklusive Navigation ersetzte. `withErrorBoundary`
// hatte bis hierher keinen Aufrufer (KOMP-6).
const SafeOutlet = withErrorBoundary(Outlet);

function getTitle(pathname: string, t: (key: string, fallback?: string) => string) {
  for (const g of NAV_GROUPS) {
    for (const item of g.items) {
      if (item.path === pathname) {
        const label = t(item.labelKey ?? "", item.label);
        return item.requiredTier === "premium" ? `${label} (${t("shell.premium")})` : label;
      }
    }
  }
  return t("shell.appName");
}

export default function AppShell() {
  const location = useLocation();
  const { t } = useI18n();
  const title = getTitle(location.pathname, t);
  // Datengetriebene Grundstimmung. Vorher stand hier ein festes
  // `{ temperature: 'neutral', intensity: 0, pulse: 'steady' }` — die Schicht
  // war eingebaut, aber dauerhaft unsichtbar. Der Hook laedt nichts nach,
  // sondern liest den vorhandenen Query-Cache mit (siehe useGlobalAtmosphere).
  const atmosphere = useGlobalAtmosphere();

  return (
    // overflow-x-clip: globaler Schutz gegen horizontales Seiten-Scrollen. Clip
    // (statt hidden) auf nur einer Achse lässt Sticky-/Fixed-Positionierung
    // (Sidebar, Header, Bottom-Nav) unberührt.
    <div className="min-h-screen overflow-x-clip bg-background text-foreground">
      <AtmosphereLayer state={atmosphere} />
      <CommandPalette />
      {/* Reihenfolge ist Inhalt: erst woher die Daten kommen (Kapitel 0),
          dann die Lebenssituation — siehe docs/tutorial-sequence.md. */}
      <DataSourceDialog />
      <OnboardingDialog />
      {/* Der Host umschließt den Seiteninhalt als Provider: nachrangige
          Hinweise (Coach-Streifen) lesen darüber, ob gerade eine Tutorial-
          Hinweisebene sichtbar ist (Befund A-2). Sein Einladungs-Banner
          rendert weiterhin an genau dieser Stelle, vor dem Flex-Container. */}
      <TutorialHost>
      <div className="flex min-h-screen">
        {/* h-[100dvh] statt h-screen (100vh): An die *sichtbare* Viewport-Höhe
            koppeln, damit die ein-/ausblendende Browser-Leiste (Adressleiste/
            Navigationsleiste) das untere Ende der Seitennavigation nicht verdeckt. */}
        <aside className="hidden md:block w-72 h-[100dvh] sticky top-0 self-start border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
          <SideNav />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
            <div className="flex h-14 items-center gap-1 px-3 sm:gap-2 sm:px-4 lg:px-6">
              <MobileNav />

              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{title}</div>
              </div>

              <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden sm:inline-flex"
                  onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
                >
                  <Search className="mr-2 h-4 w-4" />
                  {t("shell.search")}
                  <span className="ml-2 text-xs text-muted-foreground">⌘K</span>
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="sm:hidden"
                  aria-label={t("shell.search")}
                  onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
                >
                  <Search className="h-4 w-4" />
                </Button>

                {/* WP-9.3: Neben den anderen Statusanzeigen und bewusst NICHT
                    als Streifen ueber dem Inhalt — ein eingeschobener Streifen
                    verschiebt beim Auftauchen die ganze Seite nach unten
                    (Befund aus WP-8.3). Rendert nichts, solange Verbindung
                    besteht. */}
                <OfflineIndicator />

                <PrivacyIndicator />

                {/* Sprachwahl als kompaktes Popup — bleibt auch auf Mobil im
                    Header erreichbar, ohne ihn zu überlaufen. */}
                <LanguageSwitcher />

                {/* Theme erst ab sm sichtbar (auch in den Einstellungen unter
                    Darstellung erreichbar), um den Mobil-Header ruhig zu halten. */}
                <ThemeToggle className="hidden sm:inline-flex" />

                <NotificationsBell />
                <UserQuickProfile />
              </div>
            </div>
          </header>

          <DemoDataBanner />

          {/* overflow-x-hidden: kein horizontales Seiten-Scrollen auf Mobil; breite
              Inhalte (KPI-Strip, Tabellen, Sankey) scrollen in eigenen overflow-x-auto-
              Containern weiter. min-w-0 erlaubt dem Flex-Kind das Schrumpfen. */}
          <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
            <div className="w-full min-w-0 px-4 py-6 sm:px-6 lg:px-8 2xl:px-10">
              {/* `key={location.pathname}` setzt die Fehlergrenze bei jedem
                  Routenwechsel zurueck — sonst bliebe die Fallback-UI eines
                  Absturzes stehen, obwohl per Navigation laengst eine andere
                  (gesunde) Flaeche angefordert wurde. */}
              <SafeOutlet key={location.pathname} />
            </div>
          </main>
        </div>
      </div>

      <BottomNav />
      </TutorialHost>
    </div>
  );
}