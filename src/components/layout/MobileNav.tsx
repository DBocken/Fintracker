"use client";

import { Lock, Menu } from "lucide-react";
import { NavLink } from "react-router-dom";
import { NAV_GROUPS } from "@/components/layout/nav-config";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTier } from "@/hooks/useTier";
import { tierMeets } from "@/lib/tier";

export default function MobileNav() {
  const tier = useTier();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Navigation öffnen">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0">
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle>Navigation</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-56px)]">
          <div className="px-3 py-2">
            {NAV_GROUPS.map((group) => (
              <div key={group.id} className="py-2">
                <div className="px-2 pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </div>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const locked = item.requiredTier ? !tierMeets(tier, item.requiredTier) : false;
                    return (
                      <SheetClose key={item.path} asChild>
                        <NavLink
                          to={item.path}
                          title={locked ? "Vorschau – Premium noch nicht freigeschaltet" : undefined}
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
                          {locked && (
                            <Badge variant="secondary" className="gap-1">
                              <Lock className="h-3 w-3" />
                              Premium
                            </Badge>
                          )}
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
