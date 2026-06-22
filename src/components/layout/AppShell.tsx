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

function getTitle(pathname: string) {
  for (const g of NAV_GROUPS) {
    for (const item of g.items) {
      if (item.path === pathname) {
        return item.requiredTier === "premium" ? `${item.label} (Premium)` : item.label;
      }
    }
  }
  return "Ausgabentracker";
}

export default function AppShell() {
  const location = useLocation();
  const title = getTitle(location.pathname);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <CommandPalette />
      <div className="flex min-h-screen">
        <aside className="hidden md:block w-72 h-screen border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
          <SideNav />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
            <div className="flex h-14 items-center gap-2 px-4 sm:px-6">
              <MobileNav />

              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{title}</div>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="hidden sm:inline-flex"
                onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
              >
                <Search className="mr-2 h-4 w-4" />
                Suchen
                <span className="ml-2 text-xs text-muted-foreground">⌘K</span>
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="sm:hidden"
                aria-label="Suchen"
                onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
              >
                <Search className="h-4 w-4" />
              </Button>

              <PrivacyIndicator />
              <LanguageSwitcher />
              <ThemeToggle />
              <NotificationsBell />
              <UserQuickProfile />
            </div>
          </header>

          <DemoDataBanner />

          <main className="flex-1 overflow-y-auto pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
            <div className="w-full px-4 py-6 sm:px-6 lg:px-8 2xl:px-10">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}