import { Outlet, useLocation } from "react-router-dom";
import { Search } from "lucide-react";
import SideNav from "@/components/layout/SideNav";
import MobileNav from "@/components/layout/MobileNav";
import BottomNav from "@/components/layout/BottomNav";
import CommandPalette from "@/components/CommandPalette";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import PrivacyIndicator from "@/components/PrivacyIndicator";
import DemoDataBanner from "@/components/DemoDataBanner";
import NotificationsBell from "@/components/NotificationsBell";
import UserQuickProfile from "@/components/UserQuickProfile";
import { Button } from "@/components/ui/button";
import { NAV_GROUPS } from "@/components/layout/nav-config";
import { useI18n } from "@/i18n/useI18n";

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

  return (
    // overflow-x-clip: globaler Schutz gegen horizontales Seiten-Scrollen. Clip
    // (statt hidden) auf nur einer Achse lässt Sticky-/Fixed-Positionierung
    // (Sidebar, Header, Bottom-Nav) unberührt.
    <div className="min-h-screen overflow-x-clip bg-background text-foreground">
      <CommandPalette />
      <div className="flex min-h-screen">
        <aside className="hidden md:block w-72 h-screen sticky top-0 self-start border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
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

                <PrivacyIndicator />

                {/* Sekundäre Steuerungen erst ab sm sichtbar — auf dem schmalen
                    Mobil-Header würden Sprache + Theme überlaufen. Beide sind in
                    den Einstellungen (Darstellung/Sprache) erreichbar. */}
                <div className="hidden items-center gap-1 sm:flex sm:gap-2">
                  <LanguageSwitcher />
                  <ThemeToggle />
                </div>

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
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}