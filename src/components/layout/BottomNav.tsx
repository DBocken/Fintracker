import { NavLink } from "react-router-dom";
import { MoreHorizontal } from "lucide-react";
import { getBottomNavItems } from "@/components/layout/nav-config";
import { OPEN_NAV_SHEET_EVENT } from "@/components/layout/MobileNav";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/useI18n";

/**
 * Mobile Bottom-Nav (Audit P1.3): Heute · Übersicht · Buchungen + „Mehr"-Tab.
 * Die Kernziele kommen aus nav-config (eine Quelle für SideNav,
 * Command-Palette und Bottom-Nav); „Mehr" öffnet das bestehende
 * Navigations-Sheet mit allen übrigen Zielen (Schulden, Konten, Verträge …).
 */
export default function BottomNav() {
  const { t } = useI18n();
  const items = getBottomNavItems();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex items-stretch justify-around">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground"
                )
              }
            >
              <Icon className="h-5 w-5" />
              <span>{t(item.shortLabelKey ?? "", item.shortLabel)}</span>
            </NavLink>
          );
        })}

        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event(OPEN_NAV_SHEET_EVENT))}
          className="flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] text-muted-foreground transition-colors"
          aria-label={t("shell.openMore")}
        >
          <MoreHorizontal className="h-5 w-5" />
          <span>{t("shell.more")}</span>
        </button>
      </div>
    </nav>
  );
}
