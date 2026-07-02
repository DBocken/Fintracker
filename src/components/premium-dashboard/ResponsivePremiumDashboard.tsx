import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import SegmentedControl from "@/components/common/SegmentedControl";
import { getTransactions, getCategories } from "../../services/transaction-service";
import { sumIncome, sumExpenses } from "../../lib/analysis-data";
import { getAccounts } from "../../services/account-service";
import { parseISO, startOfMonth, format } from "date-fns";
import type { Transaction, Category, Account } from "../../types";
import { TimelineChart } from "./TimelineChart";
import { SmartInsightsPanel } from "./SmartInsightsPanel";
import { HeatmapCalendar } from "./HeatmapCalendar";
import { SankeyChart } from "./SankeyChart";
import { WeeklyPatternCharts } from "./WeeklyPatternCharts";
import { KpiSection } from "@/components/kpi/KpiSection";
import { dyadProps } from "@/lib/dyad";
import { buildSankeyData, buildWeekdayPattern } from "@/lib/analysis-data";

type FlowMode = "live" | "month" | "average";

export function ResponsivePremiumDashboard() {
  const [flowMode, setFlowMode] = useState<FlowMode>("live");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  // Gleiche Query wie das Basis-Dashboard (gleicher queryKey ⇒ gleiches Limit),
  // damit der Cache konsistent bleibt (Issue #40).
  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ["transactions"],
    queryFn: () => getTransactions(5000),
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories"],
    queryFn: getCategories,
  });

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ["accounts"],
    queryFn: () => getAccounts(),
  });

  const flowTransactions = useMemo(() => {
    if (!transactions.length) return [];

    if (flowMode === "month") {
      if (!selectedMonth) return [];
      return transactions.filter((t) => {
        const ym = format(parseISO(t.date), "yyyy-MM");
        return ym === selectedMonth;
      });
    }

    return transactions;
  }, [transactions, flowMode, selectedMonth]);

  const financialData = useMemo(() => {
    if (!flowTransactions.length) return null;

    let scaleFactor = 1;
    if (flowMode === "average") {
      const monthSet = new Set<string>();
      transactions.forEach((t) => {
        monthSet.add(format(parseISO(t.date), "yyyy-MM"));
      });
      const monthCount = monthSet.size || 1;
      scaleFactor = 1 / monthCount;
    }

    // Transferbereinigte Summen (Invariante 2) aus der zentralen Quelle —
    // interne Überträge dürfen Einnahmen/Ausgaben nicht aufblähen (F-MONEY-3).
    const totalIncomeRaw = sumIncome(flowTransactions);
    const totalExpensesRaw = sumExpenses(flowTransactions);

    const totalIncome = totalIncomeRaw * scaleFactor;
    const totalExpenses = totalExpensesRaw * scaleFactor;

    // Auch die Kategorien-Aggregation ohne interne Überträge (Invariante 2).
    const expenseTransactions = flowTransactions.filter((t) => !t.is_transfer && t.amount < 0);

    const categoryMap = new Map<string, Category>();
    categories.forEach((c) => {
      categoryMap.set(c.id, c);
    });

    const UNC_MAIN_ID = "__uncategorized_main";
    const UNC_MAIN_NAME = "Unkategorisiert";
    const UNC_SUB_ID = "__uncategorized_sub";
    const UNC_SUB_NAME = "Unkategorisiert";

    const resolveCategoryHierarchy = (
      catId: string | null
    ): { mainId: string; mainName: string; subId: string | null; subName: string | null } => {
      if (!catId) {
        return { mainId: UNC_MAIN_ID, mainName: UNC_MAIN_NAME, subId: UNC_SUB_ID, subName: UNC_SUB_NAME };
      }

      const cat = categoryMap.get(catId);
      if (!cat) {
        return { mainId: UNC_MAIN_ID, mainName: UNC_MAIN_NAME, subId: UNC_SUB_ID, subName: UNC_SUB_NAME };
      }

      let main: Category = cat;
      let current: Category | undefined = cat;
      const visited = new Set<string>();

      while (current && current.parent_id) {
        if (visited.has(current.id)) break;
        visited.add(current.id);
        const parent = categoryMap.get(current.parent_id);
        if (!parent) break;
        main = parent;
        current = parent;
      }

      const isSame = main.id === cat.id;

      if (isSame) {
        return { mainId: main.id, mainName: main.name, subId: null, subName: null };
      }

      return { mainId: main.id, mainName: main.name, subId: cat.id, subName: cat.name };
    };

    type MainAgg = { id: string; name: string; amount: number };
    const mainTotals: Record<string, MainAgg> = {};
    const getOrCreateMain = (id: string, name: string): MainAgg => {
      if (!mainTotals[id]) {
        mainTotals[id] = { id, name, amount: 0 };
      }
      return mainTotals[id];
    };

    expenseTransactions.forEach((t) => {
      const amountAbs = Math.abs(t.amount) * scaleFactor;
      const assignedId = t.subcategory_id ?? t.category_id ?? null;
      const { mainId, mainName } = resolveCategoryHierarchy(assignedId);
      const mainAgg = getOrCreateMain(mainId, mainName);
      mainAgg.amount += amountAbs;
    });

    const mainCategories = Object.values(mainTotals).filter((m) => m.amount > 0).sort((a, b) => b.amount - a.amount);
    const topExpenseCategories = mainCategories.slice(0, 5).map((m) => ({ name: m.name, amount: m.amount }));

    return {
      totalIncome,
      totalExpenses,
      transactionCount: flowTransactions.length,
      topExpenseCategories,
    };
  }, [flowTransactions, categories, flowMode, transactions]);

  const timelineData = useMemo(() => {
    const map = new Map<string, { formattedDate: string; income: number; expenses: number; net: number }>();

    flowTransactions.forEach((t) => {
      const monthStart = startOfMonth(parseISO(t.date));
      const monthIso = format(monthStart, "yyyy-MM-01");
      const label = format(monthStart, "MMM yyyy");

      if (!map.has(monthIso)) {
        map.set(monthIso, { formattedDate: label, income: 0, expenses: 0, net: 0 });
      }

      const bucket = map.get(monthIso)!;
      if (t.amount > 0) bucket.income += t.amount;
      else bucket.expenses += Math.abs(t.amount);
      bucket.net = bucket.income - bucket.expenses;
    });

    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, v]) => v);
  }, [flowTransactions]);

  // Sankey mit Drilldown + Wochenmuster (Issue #40) — gleiche Datenbasis
  // wie das Basis-Sankey, eine Implementierung (lib/analysis-data).
  const sankeyData = useMemo(
    () => buildSankeyData(flowTransactions, categories, accounts),
    [flowTransactions, categories, accounts]
  );
  const weekdayPattern = useMemo(() => buildWeekdayPattern(flowTransactions), [flowTransactions]);

  const fd = financialData ?? {
    totalIncome: 0,
    totalExpenses: 0,
    transactionCount: flowTransactions.length,
    topExpenseCategories: [],
  };

  const topExpense = fd.topExpenseCategories[0] ?? { name: "Keine Ausgaben", amount: 0 };

  return (
    <div {...dyadProps("ResponsivePremiumDashboard")} className="space-y-8 sm:space-y-12">
      <KpiSection data={{ transactions: flowTransactions }} />

      <section {...dyadProps("PremiumTimelineSection")} className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-semibold">Zeitverlauf</div>
            <div className="text-xs text-muted-foreground">Ein Chart pro Bereich, Details über Filter.</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SegmentedControl
              aria-label="Zeitverlauf-Modus"
              fill={false}
              size="sm"
              value={flowMode}
              onValueChange={(v) => setFlowMode(v as FlowMode)}
              options={[
                { value: "live", label: "Alle Daten" },
                { value: "month", label: "Monat" },
                { value: "average", label: "Durchschnitt" },
              ]}
            />
            {flowMode === "month" && (
              <Input
                type="month"
                className="h-10 w-[150px]"
                value={selectedMonth ?? ""}
                onChange={(e) => setSelectedMonth(e.target.value || null)}
              />
            )}
          </div>
        </div>

        <TimelineChart data={timelineData} flowTransactions={flowTransactions} categories={categories} />
      </section>

      <section {...dyadProps("PremiumSankeySection")} className="space-y-4">
        <div>
          <div className="text-sm font-semibold">Wohin fließt mein Geld?</div>
          <div className="text-xs text-muted-foreground">
            Klicke auf eine Hauptkategorie, um in die Unterkategorien einzutauchen.
          </div>
        </div>
        <SankeyChart data={sankeyData} enableDrilldown />
      </section>

      <section {...dyadProps("PremiumWeekdaySection")} className="space-y-4">
        <div>
          <div className="text-sm font-semibold">Wann fließt mein Geld?</div>
          <div className="text-xs text-muted-foreground">Einnahmen und Ausgaben nach Wochentag.</div>
        </div>
        <WeeklyPatternCharts weeklyData={weekdayPattern} />
      </section>

      <section {...dyadProps("PremiumInsightsSection")} className="space-y-4">
        <div>
          <div className="text-sm font-semibold">Insights</div>
          <div className="text-xs text-muted-foreground">Kurze Hinweise basierend auf deinen Daten.</div>
        </div>
        <SmartInsightsPanel
          totalIncome={fd.totalIncome}
          totalExpenses={fd.totalExpenses}
          topExpense={topExpense}
          topIncome={{ name: "Einnahmen", amount: fd.totalIncome }}
        />
      </section>

      <section {...dyadProps("PremiumCalendarSection")} className="space-y-4">
        <div>
          <div className="text-sm font-semibold">Aktivitätskalender</div>
          <div className="text-xs text-muted-foreground">Optionaler Überblick über Buchungen.</div>
        </div>
        <HeatmapCalendar transactions={flowTransactions} />
      </section>
    </div>
  );
}