import { NavLink } from "react-router-dom";
import { getVisibleNavGroups } from "@/components/layout/nav-config";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import UserProfile from "@/components/UserProfile";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";

export default function SideNav() {
  // Re-render, wenn das Trading-Beta-Flag umgeschaltet wird.
  useFeatureFlag("trading_beta");
  const navGroups = getVisibleNavGroups();
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Finanz-Copilot</div>
        <div className="text-sm font-semibold">Ausgabentracker</div>
      </div>

      <div className="flex-1 overflow-auto px-2">
        <Accordion type="multiple" defaultValue={navGroups.map((g) => g.id)} className="w-full">
          {navGroups.map((group) => (
            <AccordionItem key={group.id} value={group.id} className="border-none">
              <AccordionTrigger className="py-2 text-sm text-muted-foreground hover:no-underline">
                {group.label}
              </AccordionTrigger>
              <AccordionContent className="pb-2">
                <div className="space-y-1">
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
                              ? "bg-accent text-accent-foreground"
                              : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                          )
                        }
                      >
                        <Icon className="h-4 w-4" />
                        <span className="flex-1">{item.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      <div className="border-t p-3">
        <UserProfile />
      </div>
    </div>
  );
}