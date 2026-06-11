import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { dyadProps } from "@/lib/dyad";

type Props = {
  label: string;
  value: string;
  icon?: LucideIcon;
  hint?: string;
  className?: string;
};

export function KpiCard({ label, value, icon: Icon, hint, className }: Props) {
  return (
    <Card {...dyadProps("KpiCard")} className={cn("p-5 md:p-6", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted-foreground">{label}</div>
          <div className="mt-2 text-3xl md:text-4xl font-semibold tracking-tight">
            {value}
          </div>
          {hint ? <div className="mt-2 text-xs text-muted-foreground">{hint}</div> : null}
        </div>
        {Icon ? (
          <div className="shrink-0 rounded-md border bg-background p-2 text-muted-foreground">
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
      </div>
    </Card>
  );
}