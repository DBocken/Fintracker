import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { NavLink } from "react-router-dom";
import { getVisibleNavGroups } from "@/components/layout/nav-config";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { useI18n } from "@/i18n/useI18n";

/** Event, mit dem z. B. der „Mehr"-Tab der Bottom-Nav dieses Sheet öffnet (Issue #42). */
export const OPEN_NAV_SHEET_EVENT = "open-nav-sheet";

export default function MobileNav() {
  // Re-render, wenn das Trading-Beta-Flag umgeschaltet wird.
  useFeatureFlag("trading_beta");
  const { t } = useI18n();
  const navGroups = getVisibleNavGroups();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_NAV_SHEET_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_NAV_SHEET_EVENT, onOpen);
  }, []);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label={t("shell.openNavigation")}>
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
      >
        <SheetHeader className="border-b border-sidebar-border px-4 py-3">
          <SheetTitle className="text-sidebar-foreground">{t("shell.navigation")}</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-56px)]">
          <div className="px-3 py-2">
            {navGroups.map((group) => (
              <div key={group.id} className="py-2">
                <div className="px-2 pb-2 text-xs font-medium uppercase tracking-wide text-sidebar-muted">
                  {t(group.labelKey ?? "", group.label)}
                </div>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <SheetClose key={item.path} asChild>
                        <NavLink
                          to={item.path}
                          className={({ isActive }) =>
                            cn(
                              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                              isActive
                                ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                                : "text-sidebar-muted hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                            )
                          }
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate">{t(item.labelKey ?? "", item.label)}</span>
                            {item.subtitle && (
                              <span className="truncate text-[11px] text-sidebar-muted">
                                {t(item.subtitleKey ?? "", item.subtitle)}
                              </span>
                            )}
                          </span>
                          {item.requiredTier === "premium" && <Badge variant="secondary">{t("shell.premium")}</Badge>}
                        </NavLink>
                      </SheetClose>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
