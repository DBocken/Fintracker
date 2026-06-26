import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: ReactNode;
  /** Optionales Icon links vor dem Titel. */
  icon?: ReactNode;
  /** Aktion rechts (z. B. „Alle anzeigen"-Link oder Button). */
  action?: ReactNode;
  className?: string;
}

/**
 * Einheitlicher Abschnittskopf: Titel (optional mit Icon) links, optionale
 * Aktion rechts. Vereinheitlicht die vielen handgebauten
 * „flex items-center justify-between"-Köpfe über die Screens hinweg und gibt
 * jedem Block dieselbe ruhige Hierarchie.
 */
export default function SectionHeader({ title, icon, action, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
        {icon}
        <span className="truncate">{title}</span>
      </h2>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
