"use client";

import { NavLink } from "react-router-dom";
import { NAV_GROUPS } from "@/components/layout/nav-config";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import UserProfile from "@/components/UserProfile";

export default function SideNav() {
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-4">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Finanz-Copilot</div>
        <div className="text-sm font-semibold">Ausgabentracker</div>
      </div>

      <div className="flex-1 overflow-auto px-2">
        <Accordion type="multiple" defaultValue={NAV_GROUPS.map((g) => g.id)} className="w-full">
          {NAV_GROUPS.map((group) => (
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
                        <span className="flex-1">{item.premium ? `${item.label} (Premium)` : item.label}</span>
                        {item.premium && <Badge variant="secondary">Premium</Badge>}
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