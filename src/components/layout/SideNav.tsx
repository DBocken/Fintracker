import { NavLink } from "react-router-dom";
import { getVisibleNavGroups } from "@/components/layout/nav-config";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import UserProfile from "@/components/UserProfile";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";

export default function SideNav() {
  // Re-render, wenn das Trading-Beta-Flag umgeschaltet wird.
  useFeatureFlag("trading_beta");
  const navGroups = getVisibleNavGroups();
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-5">
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-sidebar-muted">
          Finanz-Copilot
        </div>
        <div className="font-display text-base font-semibold text-sidebar-foreground">
          Ausgabentracker
        </div>
      </div>

      <div className="flex-1 overflow-auto px-2">
        <Accordion type="multiple" defaultValue={navGroups.map((g) => g.id)} className="w-full">
          {navGroups.map((group) => (
            <AccordionItem key={group.id} value={group.id} className="border-none">
              <AccordionTrigger className="px-3 py-2 text-[11px] font-medium uppercase tracking-[0.14em] text-sidebar-muted hover:no-underline hover:text-sidebar-foreground">
                {group.label}
              </AccordionTrigger>
              <AccordionContent className="pb-2">
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink
                        key={item.path}
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
                        <Icon className="h-4 w-4" />
                        <span className="flex-1">{item.label}</span>
                        {item.requiredTier === "premium" && (
                          <Badge className="border-none bg-premium text-premium-foreground hover:bg-premium">
                            Pro
                          </Badge>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      <div className="border-t border-sidebar-border p-3">
        <UserProfile />
      </div>
    </div>
  );
}
