import { useEffect, useMemo, useRef, useState } from "react";
import { KPI_BY_ID, KPI_DEFINITIONS, type KpiComputeInput, type KpiId } from "@/components/kpi/kpis";
import { KpiCard } from "@/components/kpi/KpiCard";
import { cn } from "@/lib/utils";

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 768px)");
    const onChange = () => setIsDesktop(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isDesktop;
}

type Props = {
  data: KpiComputeInput;
  order: KpiId[];
  active: KpiId[];
};

export function KpiGrid({ data, order, active }: Props) {
  const isDesktop = useIsDesktop();

  const orderedActive = useMemo(() => {
    const byOrder = order.filter((id) => active.includes(id));
    // Ensure any newly-active KPI not present in order still shows.
    const missing = active.filter((id) => !byOrder.includes(id));
    return [...byOrder, ...missing];
  }, [order, active]);

  // Desktop zeigt die ersten 3 als Raster; mobil sind ALLE aktiven KPIs in einem
  // swipebaren Snap-Streifen erreichbar (statt nur einer einzigen Kennzahl).
  const visible = isDesktop ? orderedActive.slice(0, 3) : orderedActive;

  const computed = useMemo(() => {
    const out: Record<string, string> = {};
    for (const id of visible) {
      const def = KPI_BY_ID[id] ?? KPI_DEFINITIONS.find((k) => k.id === id);
      if (!def) continue;
      const v = def.compute(data);
      out[id] = def.format(v);
    }
    return out;
  }, [data, visible]);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  if (isDesktop) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {visible.map((id) => {
          const def = KPI_BY_ID[id];
          if (!def) return null;
          return <KpiCard key={id} label={def.label} value={computed[id] ?? def.format(0)} icon={def.icon} />;
        })}
      </div>
    );
  }

  const onScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setActiveIndex(Math.max(0, Math.min(idx, visible.length - 1)));
  };

  return (
    <div className="space-y-2">
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {visible.map((id) => {
          const def = KPI_BY_ID[id];
          if (!def) return null;
          return (
            <div key={id} className="w-full shrink-0 snap-center">
              <KpiCard label={def.label} value={computed[id] ?? def.format(0)} icon={def.icon} />
            </div>
          );
        })}
      </div>
      {visible.length > 1 && (
        <div className="flex justify-center gap-1.5" role="tablist" aria-label="Kennzahlen">
          {visible.map((id, i) => (
            <span
              key={id}
              className={cn(
                "h-1.5 rounded-full transition-all",
                i === activeIndex ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
