// Reiner, getesteter Aufbau des Sankey-Graphen (Knoten + Links) aus SankeyData.
//
// Korrektheit ist hart: Flusserhaltung gilt pro Knoten (Summe ausgehend = Höhe),
// Aggregationen ("Weitere"/"Übrig"/Rest) sind ehrlich und vollständig, Rundung
// wird über einen Ausgleichsposten geführt (Σ gerundeter Kinder == gerundeter
// Elternwert). Desktop bleibt strukturell wie bisher; nur der Drilldown-Rest
// wird – plattformübergreifend – korrigiert (er unterschlug bisher direkt auf
// der Hauptkategorie gebuchte Beträge ohne Unterkategorie).

import type { SankeyData } from "@/lib/analysis-data";

export interface SankeyModelNode {
  name: string;
  id: string;
  type?: string;
  amount?: number;
  net?: number;
  color?: string;
}

export interface SankeyModelLink {
  source: number;
  target: number;
  value: number;
  label?: string;
}

export interface SankeyModel {
  nodes: SankeyModelNode[];
  links: SankeyModelLink[];
}

export interface BuildSankeyOptions {
  /** Mobile Flachansicht (Konten-Ebene weglassen). */
  isMobile?: boolean;
  /** Fokussierte Hauptkategorie (Drilldown) oder null = Gesamtansicht. */
  expandedMainId?: string | null;
  /** Max. Top-Unterkategorien im Drilldown (Default 6, mobil 4). */
  maxSubs?: number;
  /** Max. Top-Hauptkategorien in der mobilen Flachansicht (Default 5). */
  maxMains?: number;
}

/** Schwelle (EUR), ab der ein "Übrig"-Knoten überhaupt gezeichnet wird. */
const SAVINGS_MIN = 0.5;
const REST_LABEL = "Weitere / ohne Unterkategorie";

function accountsWithFallback(data: SankeyData, totalExpenses: number) {
  return data.accounts && data.accounts.length > 0
    ? data.accounts
    : [
        {
          id: "account",
          name: "Konto",
          income: data.totalIncome,
          expenses: totalExpenses,
          net: data.totalIncome - totalExpenses,
          color: undefined as string | undefined,
        },
      ];
}

/**
 * Baut Knoten + Links für das Sankey. Reine Funktion – alle Korrektheits-
 * Invarianten sind ohne Browser testbar.
 */
export function buildSankeyModel(data: SankeyData, opts: BuildSankeyOptions = {}): SankeyModel {
  const isMobile = opts.isMobile ?? false;
  const expandedMainId = opts.expandedMainId ?? null;
  const maxSubs = opts.maxSubs ?? (isMobile ? 4 : 6);
  const maxMains = opts.maxMains ?? 5;

  const nodes: SankeyModelNode[] = [];
  const links: SankeyModelLink[] = [];
  const indexById: Record<string, number> = {};

  if (!data || !Array.isArray(data.mainCategories) || data.mainCategories.length === 0) {
    return { nodes, links };
  }

  const mains = data.mainCategories; // bereits amount>0, absteigend sortiert
  const totalExpenses = mains.reduce((sum, m) => sum + m.amount, 0);

  const push = (node: SankeyModelNode): number => {
    indexById[node.id] = nodes.length;
    nodes.push(node);
    return indexById[node.id];
  };

  // Rest-Knoten im Drilldown: schließt direkt-auf-Hauptkategorie gebuchte
  // Beträge ein (main.amount − Σ angezeigte Subs), gerundet als Ausgleichsposten.
  const pushDrilldownRest = (mainIndex: number, mainName: string, mainId: string, mainAmount: number, shownSubs: { amount: number }[]) => {
    const subsRounded = shownSubs.reduce((s, x) => s + Math.round(x.amount), 0);
    const restRounded = Math.round(mainAmount) - subsRounded;
    if (restRounded > 0) {
      const ri = push({ name: REST_LABEL, id: `__rest_${mainId}`, type: "expense-sub", amount: restRounded });
      links.push({ source: mainIndex, target: ri, value: restRounded, label: `${mainName} → ${REST_LABEL}` });
    }
  };

  // ---------------------------------------------------------------- Drilldown
  if (expandedMainId) {
    const focusedMain = mains.find((m) => m.id === expandedMainId);
    if (!focusedMain) return { nodes, links };

    const topSubs = data.subCategories
      .filter((s) => s.mainId === expandedMainId && s.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, maxSubs);

    if (isMobile) {
      // Fokussierte Hauptkategorie als Wurzel → Top-Subs + Rest (keine Konten).
      const mainIndex = push({ name: focusedMain.name, id: focusedMain.id, type: "expense-main", amount: focusedMain.amount });
      topSubs.forEach((sub) => {
        const i = push({ name: sub.name, id: sub.id, type: "expense-sub", amount: sub.amount });
        const v = Math.round(sub.amount);
        if (v > 0) links.push({ source: mainIndex, target: i, value: v, label: `${focusedMain.name} → ${sub.name}` });
      });
      pushDrilldownRest(mainIndex, focusedMain.name, focusedMain.id, focusedMain.amount, topSubs);
      return { nodes, links };
    }

    // Desktop: Konten (gefiltert) → fokussierte Hauptkategorie → Top-Subs + Rest.
    const accounts = accountsWithFallback(data, totalExpenses).filter((acc) => (focusedMain.byAccount[acc.id] ?? 0) > 0);
    accounts.forEach((acc) => {
      push({ name: acc.name, id: acc.id, type: "account", amount: focusedMain.byAccount[acc.id] ?? 0, color: acc.color });
    });
    const mainIndex = push({ name: focusedMain.name, id: focusedMain.id, type: "expense-main", amount: focusedMain.amount });
    accounts.forEach((acc) => {
      const v = Math.round(focusedMain.byAccount[acc.id] ?? 0);
      if (v > 0) links.push({ source: indexById[acc.id], target: mainIndex, value: v, label: `${acc.name} → ${focusedMain.name}` });
    });
    topSubs.forEach((sub) => {
      const i = push({ name: sub.name, id: sub.id, type: "expense-sub", amount: sub.amount });
      const v = Math.round(sub.amount);
      if (v > 0) links.push({ source: mainIndex, target: i, value: v, label: `${focusedMain.name} → ${sub.name}` });
    });
    pushDrilldownRest(mainIndex, focusedMain.name, focusedMain.id, focusedMain.amount, topSubs);
    return { nodes, links };
  }

  // ----------------------------------------------------------- Desktop-Übersicht
  if (!isMobile) {
    const accounts = accountsWithFallback(data, totalExpenses);
    let incomeIndex = -1;
    if (data.totalIncome > 0) {
      incomeIndex = push({ name: "Einnahmen", id: "income", type: "income", amount: data.totalIncome });
    }
    accounts.forEach((acc) => {
      const ai = push({ name: acc.name, id: acc.id, type: "account", amount: acc.expenses, net: acc.net, color: acc.color });
      if (incomeIndex >= 0 && acc.income > 0) {
        links.push({ source: incomeIndex, target: ai, value: Math.round(acc.income), label: `Einnahmen → ${acc.name}` });
      }
    });
    mains.forEach((main) => {
      const mi = push({ name: main.name, id: main.id, type: "expense-main", amount: main.amount });
      accounts.forEach((acc) => {
        const v = Math.round(main.byAccount[acc.id] ?? 0);
        if (v > 0) links.push({ source: indexById[acc.id], target: mi, value: v, label: `${acc.name} → ${main.name}` });
      });
    });
    return { nodes, links };
  }

  // ------------------------------------------------------- Mobile Flachansicht
  // Einnahmen → Top-N Hauptkategorien (+ "Weitere") (+ "Übrig" bei Überschuss).
  const surplus = data.totalIncome - totalExpenses;
  // Im Defizit KEIN Einnahmen-Wurzelknoten zeichnen (sonst Σ ausgehend > Höhe).
  const drawIncome = data.totalIncome > 0 && surplus > -SAVINGS_MIN;

  const topMains = mains.slice(0, maxMains);
  const weitereAmount = totalExpenses - topMains.reduce((s, m) => s + m.amount, 0);

  let incomeIndex = -1;
  if (drawIncome) incomeIndex = push({ name: "Einnahmen", id: "income", type: "income", amount: data.totalIncome });

  // Ausgehende Einnahmen-Links sammeln, um Rundung exakt auszugleichen.
  const incomeOut: SankeyModelLink[] = [];
  const addIncomeLink = (target: number, value: number, label: string) => {
    const link: SankeyModelLink = { source: incomeIndex, target, value, label };
    links.push(link);
    incomeOut.push(link);
    return link;
  };

  topMains.forEach((main) => {
    const mi = push({ name: main.name, id: main.id, type: "expense-main", amount: main.amount });
    if (incomeIndex >= 0) addIncomeLink(mi, Math.round(main.amount), `Einnahmen → ${main.name}`);
  });

  let weitereLink: SankeyModelLink | null = null;
  if (weitereAmount > SAVINGS_MIN) {
    const wi = push({ name: "Weitere", id: "__weitere_mains", type: "expense-main", amount: weitereAmount });
    if (incomeIndex >= 0) weitereLink = addIncomeLink(wi, Math.round(weitereAmount), `Einnahmen → Weitere`);
  }

  // "Übrig" nur bei echtem Überschuss (kein erfundener Knoten aus Rundung).
  let uebrigLink: SankeyModelLink | null = null;
  if (drawIncome && surplus > SAVINGS_MIN) {
    const ui = push({ name: "Übrig", id: "__uebrig", type: "savings", amount: Math.round(surplus) });
    uebrigLink = addIncomeLink(ui, Math.round(surplus), `Einnahmen → Übrig`);
  }

  // Rundungsausgleich: Σ ausgehend(Einnahmen) == round(totalIncome) exakt. Der
  // Rest landet im Ausgleichsposten (Übrig → sonst Weitere → sonst größte Kategorie).
  if (incomeIndex >= 0 && incomeOut.length > 0) {
    const delta = Math.round(data.totalIncome) - incomeOut.reduce((s, l) => s + l.value, 0);
    if (delta !== 0) {
      const balancer = uebrigLink ?? weitereLink ?? incomeOut[0];
      balancer.value += delta;
      const bn = nodes[balancer.target];
      if (bn && typeof bn.amount === "number") bn.amount += delta;
    }
  }

  return { nodes, links };
}
