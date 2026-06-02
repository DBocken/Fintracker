"use client";

import { useEffect, useMemo, useState } from "react";
import { KPI_BY_ID, KPI_DEFINITIONS, type KpiComputeInput, type KpiId } from "@/components/kpi/kpis";
import { KpiCard } from "@/components/kpi/KpiCard";

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
  const limit = isDesktop ? 3 : 1;

  const orderedActive = useMemo(() => {
    const byOrder = order.filter((id) => active.includes(id));
    // Ensure any newly-active KPI not present in order still shows.
    const missing = active.filter((id) => !byOrder.includes(id));
    return [...byOrder, ...missing];
  }, [order, active]);

  const visible = orderedActive.slice(0, limit);

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

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {visible.map((id) => {
        const def = KPI_BY_ID[id];
        if (!def) return null;
        return (
          <KpiCard
            key={id}
            label={def.label}
            value={computed[id] ?? def.format(0)}
            icon={def.icon}
          />
        );
      })}
    </div>
  );
}
