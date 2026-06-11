import { NavLink } from "react-router-dom";
import { Sparkles, Banknote, BarChart3, Coins, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { label: "Coach", path: "/coach", icon: Sparkles },
  { label: "Schulden", path: "/debts", icon: Banknote },
  { label: "Vermögen", path: "/net-worth", icon: Coins },
  { label: "Dashboard", path: "/dashboard", icon: BarChart3 },
  { label: "Konten", path: "/accounts", icon: Wallet },
];

export default function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur md:hidden">
      <div className="flex items-stretch justify-around">
        {ITEMS.map((item) => {
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
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
