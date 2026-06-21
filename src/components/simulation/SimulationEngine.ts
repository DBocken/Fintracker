import type { Transaction, Category } from '../../types';
import { parseISO, addMonths, startOfMonth } from 'date-fns';

export interface FixedExpense {
  name: string;
  amount: number;
  frequency: 'monthly' | 'quarterly' | 'yearly';
  category: string;
  confidence: number;
}

export interface FixedIncome {
  name: string;
  amount: number;
  frequency: 'monthly' | 'quarterly' | 'yearly';
  confidence: number;
}

export interface VariableExpenseProjection {
  category: string;
  currentAvg: number;
  projectedAvg: number;
  change: number;
  confidence: number;
}

export interface SimulationResult {
  scenario: string;
  fixedExpenses: FixedExpense[];
  fixedIncome: FixedIncome[];
  variableExpenses: VariableExpenseProjection[];
  totalForecast: {
    optimistic: number;
    realistic: number;
    pessimistic: number;
  };
  insights: string[];
}

export type Cycle = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'unknown';

export interface DetectedContract {
  categoryId: string;
  categoryName: string;
  amountTypical: number;
  cycle: Cycle;
  nextDateISO: string | null;
  attributes: Category['attributes'] | undefined;
}

export interface NewContract {
  name: string;
  amount: number;
  cycle: Cycle;
  startMonthIndex: number;
}

export interface Cancelation {
  categoryId: string;
  cancelMonthIndex: number | null;
}

export interface ProjectionPoint {
  label: string;
  income: number;
  contracts: number;
  net: number;
}

export interface SimulationPointExtended extends ProjectionPoint {
  netOptimistic: number;
  netRealistic: number;
  netPessimistic: number;
  cumNetRealistic: number;
  cumNetMin: number;
  cumNetMax: number;
  corridorWidth: number;
  variables?: number;
}

export interface VariableCategoryStat {
  categoryId: string;
  categoryName: string;
  mean: number;
  std: number;
}

export interface IncomeStats {
  mean: number;
  std: number;
  min: number;
  max: number;
}

export interface SimEvent {
  id: string;
  name: string;
  type: 'income' | 'expense';
  categoryId?: string | null;
  startMonthIndex: number;
  endMonthIndex: number;
  delta: number;
  widenFactor?: number;
}

export type Scenario = 'optimistic' | 'realistic' | 'pessimistic';

export interface SimulationOptions {
  riskK: number;
  scenario: Scenario;
  categoryOverrides?: Record<string, { min: number; max: number }>;
  events?: SimEvent[];
  horizonMonths?: number;
  onlyVariables?: boolean;
}

export interface BudgetSuggestion {
  categoryId: string;
  categoryName: string;
  priority: number;
  from: number;
  to: number;
  savingsPerMonth: number;
  note?: string;
  /** Konkrete, nachvollziehbare Begründung des Vorschlags. */
  reason?: string;
}

/**
 * Vorschläge für Verträge (Audit P2-UX U5). Verträge haben feste Preise – statt
 * sinnloser Betragskürzungen werden konkrete Aktionen vorgeschlagen: bündeln/
 * reduzieren (z.B. mehrere Streaming-Abos), prüfen/wechseln oder kündigen.
 */
export type ContractActionKind = 'bundle' | 'review' | 'cancel';

export interface ContractAction {
  kind: ContractActionKind;
  /** Betroffene Vertragskategorien. */
  categoryIds: string[];
  title: string;
  /** Konkrete Begründung inkl. Zahlen. */
  reason: string;
  /** Geschätzte mögliche Ersparnis pro Monat (0 = unbestimmt, nur prüfen). */
  monthlySavingsEstimate: number;
  /** Domäne der Verträge, z.B. „Streaming". */
  domain: string;
}

export class SimulationEngine {
  private transactions: Transaction[];
  private categories: Category[];

  constructor(transactions: Transaction[], categories: Category[]) {
    this.transactions = transactions;
    this.categories = categories;
  }

  // Hilfsfunktion: Vertrags-Kategorien via Name erkennen (falls nicht explizit markiert)
  private isContractName(name: string): boolean {
    const n = (name || '').toLowerCase();
    const keywords = [
      'versicherung',
      'haftpflicht',
      'hausrat',
      'krankenkasse',
      'kfz',
      'miete',
      'hypothek',
      'strom',
      'gas',
      'internet',
      'mobilfunk',
      'abo',
      'abos',
      'subscription',
      'streaming',
      'netflix',
      'spotify',
      'prime',
    ];
    return keywords.some(k => n.includes(k));
  }

  // Einkommen explizit von Verträgen ausschließen
  private isIncomeName(name: string): boolean {
    const n = (name || '').toLowerCase();
    return ['gehalt', 'lohn', 'salary', 'einkommen', 'income'].some(k => n.includes(k));
  }

  // Typisch variable Kategorien (nie Vertrag)
  private isVariableTypicalName(name: string): boolean {
    const n = (name || '').toLowerCase();
    return ['gastronomie', 'gastro', 'restaurant', 'ausgehen', 'freizeit', 'shopping', 'mode'].some(k => n.includes(k));
  }

  /**
   * Ordnet eine Vertragskategorie einer Domäne zu (für Bündelungs-/Redundanz-
   * Vorschläge). `null`, wenn keine bekannte Domäne erkannt wird.
   */
  private contractDomain(name: string): string | null {
    const n = (name || '').toLowerCase();
    const domains: { domain: string; keywords: string[] }[] = [
      { domain: 'Streaming', keywords: ['streaming', 'netflix', 'spotify', 'prime', 'disney', 'dazn', 'sky', 'audible', 'youtube', 'wow', 'paramount', 'apple tv', 'crunchyroll', 'deezer'] },
      { domain: 'Fitness', keywords: ['fitness', 'fitnessstudio', 'gym', 'mcfit', 'urban sports', 'clever fit', 'sportstudio', 'mitgliedschaft'] },
      { domain: 'Versicherung', keywords: ['versicherung', 'haftpflicht', 'hausrat', 'krankenkasse', 'kfz', 'rechtsschutz', 'lebensversicherung'] },
      { domain: 'Telekommunikation', keywords: ['mobilfunk', 'internet', 'telekom', 'vodafone', 'o2', 'handy', 'dsl', 'tarif'] },
      { domain: 'Energie', keywords: ['strom', 'gas', 'energie'] },
    ];
    for (const d of domains) {
      if (d.keywords.some(k => n.includes(k))) return d.domain;
    }
    return null;
  }

  /** Monatssummen (Ausgaben) einer Kategorie über die letzten n Monate. */
  private monthlyTotalsForCategory(catId: string, nMonths = 12): number[] {
    const keys = this.lastNMonthKeys(nMonths);
    const totals = keys.map(() => 0);
    for (const t of this.transactions) {
      if (t.amount >= 0) continue;
      if (t.category_id !== catId) continue;
      const idx = keys.indexOf(t.date.slice(0, 7));
      if (idx >= 0) totals[idx] += Math.abs(t.amount);
    }
    return totals;
  }

  /**
   * Mustererkennung: eine Kategorie verhält sich vertragsartig, wenn ihre
   * monatlichen Ausgaben regelmäßig und stabil sind (gleicher Betrag über
   * mehrere Monate). Fängt Fälle wie „Fitnessstudio 24,99 €/Monat" ab, die
   * weder explizit markiert noch namentlich erkannt werden.
   */
  private hasStableRecurringSpend(catId: string): boolean {
    const totals = this.monthlyTotalsForCategory(catId, 12);
    const active = totals.filter(v => v > 0);
    if (active.length < 3) return false;
    const mean = active.reduce((a, b) => a + b, 0) / active.length;
    if (mean <= 0) return false;
    const variance = active.reduce((s, x) => s + Math.pow(x - mean, 2), 0) / active.length;
    const cv = Math.sqrt(variance) / mean;
    return cv < 0.2;
  }

  /** Einheitliche Klassifikation einer Kategorie. */
  private isContractCategory(cat: Category): boolean {
    const name = cat.name || '';
    if (this.isIncomeName(name)) return false;
    if (this.isVariableTypicalName(name)) return false;
    if (cat.attributes?.ist_vertrag) return true;
    if (this.isContractName(name)) return true;
    if (this.contractDomain(name)) return true;
    return this.hasStableRecurringSpend(cat.id);
  }

  analyzeFixedExpenses(): FixedExpense[] {
    const monthlyExpenses = this.transactions
      .filter(t => t.amount < 0)
      .reduce((acc, t) => {
        const month = t.date.substring(0, 7);
        const category = this.categories.find(c => c.id === t.category_id)?.name || 'Sonstiges';
        const key = `${category}-${Math.abs(t.amount).toFixed(2)}`;
        
        if (!acc[key]) {
          acc[key] = {
            name: `${category} (${Math.abs(t.amount).toFixed(2)}€)`,
            amount: Math.abs(t.amount),
            frequency: 'monthly' as const,
            category,
            confidence: 0,
            months: new Set<string>()
          };
        }
        acc[key].months.add(month);
        return acc;
      }, {} as Record<string, { name: string; amount: number; frequency: 'monthly'; category: string; confidence: number; months: Set<string> }>);

    return Object.values(monthlyExpenses)
      .filter((item) => item.months.size >= 3)
      .map((item) => ({
        name: item.name,
        amount: item.amount,
        frequency: 'monthly' as const,
        category: item.category,
        confidence: Math.min(item.months.size / 6, 1)
      }));
  }

  analyzeFixedIncome(): FixedIncome[] {
    const monthlyIncome = this.transactions
      .filter(t => t.amount > 0)
      .reduce((acc, t) => {
        const month = t.date.substring(0, 7);
        const key = `${t.payee}-${t.amount.toFixed(2)}`;
        
        if (!acc[key]) {
          acc[key] = {
            name: t.payee || 'Einnahme',
            amount: t.amount,
            frequency: 'monthly' as const,
            confidence: 0,
            months: new Set<string>()
          };
        }
        acc[key].months.add(month);
        return acc;
      }, {} as Record<string, { name: string; amount: number; frequency: 'monthly'; confidence: number; months: Set<string> }>);

    return Object.values(monthlyIncome)
      .filter((item) => item.months.size >= 2)
      .map((item) => ({
        name: item.name,
        amount: item.amount,
        frequency: 'monthly' as const,
        confidence: Math.min(item.months.size / 6, 1)
      }));
  }

  analyzeVariableExpenses(): { category: string; currentAvg: number; amounts: number[] }[] {
    const categoryTotals = this.transactions
      .filter(t => t.amount < 0)
      .reduce((acc, t) => {
        const category = this.categories.find(c => c.id === t.category_id)?.name || 'Sonstiges';
        if (!acc[category]) {
          acc[category] = { total: 0, count: 0, amounts: [] as number[] };
        }
        acc[category].total += Math.abs(t.amount);
        acc[category].count += 1;
        acc[category].amounts.push(Math.abs(t.amount));
        return acc;
      }, {} as Record<string, { total: number; count: number; amounts: number[] }>);

    return Object.entries(categoryTotals).map(([category, data]) => ({
      category,
      currentAvg: data.total / data.count,
      amounts: data.amounts
    }));
  }

  generateForecast(scenario: string): SimulationResult {
    const fixedExpenses = this.analyzeFixedExpenses();
    const fixedIncome = this.analyzeFixedIncome();
    const variableExpensesBase = this.analyzeVariableExpenses();

    const adjustedVariables = this.applyScenarioAdjustments(variableExpensesBase, scenario);
    const totalFixedExpenses = fixedExpenses.reduce((sum, e) => sum + e.amount, 0);
    const totalFixedIncome = fixedIncome.reduce((sum, i) => sum + i.amount, 0);
    const totalVariable = adjustedVariables.reduce((sum, v) => sum + v.projectedAvg, 0);
    const totalCurrentVariable = variableExpensesBase.reduce((sum, v) => sum + v.currentAvg, 0);

    return {
      scenario,
      fixedExpenses,
      fixedIncome,
      variableExpenses: adjustedVariables,
      totalForecast: {
        optimistic: totalFixedIncome - (totalFixedExpenses + totalVariable * 0.8),
        realistic: totalFixedIncome - (totalFixedExpenses + totalVariable),
        pessimistic: totalFixedIncome - (totalFixedExpenses + totalVariable * 1.2)
      },
      insights: this.generateInsights(scenario, adjustedVariables, totalCurrentVariable)
    };
  }

  private applyScenarioAdjustments(variables: { category: string; currentAvg: number; amounts: number[] }[], scenario: string): VariableExpenseProjection[] {
    const lowerScenario = scenario.toLowerCase();
    return variables.map(v => {
      let multiplier = 1;
      let confidence = 0.8;

      if (lowerScenario.includes('freundin') || lowerScenario.includes('restaurant')) {
        if (v.category.toLowerCase().includes('restaurant') || 
            v.category.toLowerCase().includes('essen') ||
            v.category.toLowerCase().includes('freizeit')) {
          multiplier = 1.5;
          confidence = 0.7;
        }
      }

      if (lowerScenario.includes('auto') || lowerScenario.includes('neuwagen')) {
        if (v.category.toLowerCase().includes('auto') || 
            v.category.toLowerCase().includes('transport')) {
          multiplier = 1.3;
          confidence = 0.9;
        }
      }

      if (lowerScenario.includes('wohnung') || lowerScenario.includes('miete')) {
        if (v.category.toLowerCase().includes('wohnen') || 
            v.category.toLowerCase().includes('miete')) {
          multiplier = 1.2;
          confidence = 0.95;
        }
      }

      return {
        category: v.category,
        currentAvg: v.currentAvg,
        projectedAvg: v.currentAvg * multiplier,
        change: (multiplier - 1) * 100,
        confidence
      };
    });
  }

  private generateInsights(scenario: string, variables: VariableExpenseProjection[], currentTotal: number): string[] {
    const insights: string[] = [];
    const affected = variables.filter(v => Math.abs(v.change) > 10);
    if (affected.length > 0) {
      insights.push(`Die größten Änderungen betreffen: ${affected.map(v => `${v.category} (${v.change > 0 ? '+' : ''}${v.change.toFixed(0)}%)`).join(', ')}`);
    }
    const newTotal = variables.reduce((sum, v) => sum + v.projectedAvg, 0);
    const totalChange = ((newTotal - currentTotal) / currentTotal) * 100;
    if (Math.abs(totalChange) > 5) {
      insights.push(`Gesamtausgaben würden sich um ${totalChange > 0 ? '+' : ''}${totalChange.toFixed(0)}% verändern`);
    }
    if (scenario.toLowerCase().includes('freundin')) {
      insights.push('Restaurantbesuche könnten häufiger werden - Budget für gemeinsame Aktivitäten planen');
    }
    if (scenario.toLowerCase().includes('auto')) {
      insights.push('Neben Kaufpreis auch Versicherung, Steuer und Wartung berücksichtigen');
    }
    return insights;
  }

  private monthlyEquivalent(amount: number, cycle: Cycle): number {
    switch (cycle) {
      case 'weekly': return amount * 4.3;
      case 'monthly': return amount;
      case 'quarterly': return amount / 3;
      case 'yearly': return amount / 12;
      default: return amount;
    }
  }

  private stepMonthsForCycle(cycle: Cycle): number {
    return cycle === 'quarterly' ? 3 : cycle === 'yearly' ? 12 : cycle === 'weekly' ? 1 : 1;
  }

  getDetectedContracts(): DetectedContract[] {
    const contractCats = this.categories.filter(c => this.isContractCategory(c));
    const byCategory: DetectedContract[] = [];

    for (const cat of contractCats) {
      const txs = this.transactions.filter(t => t.category_id === cat.id && t.amount < 0);
      if (!txs.length) {
        byCategory.push({
          categoryId: cat.id,
          categoryName: cat.name,
          amountTypical: cat.attributes?.budget_monat || 0,
          cycle: (cat.attributes?.rhythmus as Cycle) || 'monthly',
          nextDateISO: cat.attributes?.next_due_date || null,
          attributes: cat.attributes
        });
        continue;
      }

      const amounts = txs.map(t => Math.abs(t.amount)).sort((a, b) => a - b);
      const mid = Math.floor(amounts.length / 2);
      const median = amounts.length % 2 === 0 ? (amounts[mid - 1] + amounts[mid]) / 2 : amounts[mid];

      const cycle: Cycle = (cat.attributes?.rhythmus as Cycle) || 'monthly';

      let nextDateISO = cat.attributes?.next_due_date || null;
      if (!nextDateISO) {
        const last = txs.sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime())[txs.length - 1];
        if (last) {
          const step = this.stepMonthsForCycle(cycle);
          const next = addMonths(parseISO(last.date), step);
          nextDateISO = next.toISOString().split('T')[0];
        }
      }

      byCategory.push({
        categoryId: cat.id,
        categoryName: cat.name,
        amountTypical: median,
        cycle,
        nextDateISO,
        attributes: cat.attributes
      });
    }

    return byCategory;
  }

  private monthKey(d: Date): string {
    return d.toISOString().slice(0, 7);
  }

  private lastNMonthKeys(n: number): string[] {
    const start = startOfMonth(new Date());
    return Array.from({ length: n }, (_, i) => {
      const d = addMonths(start, -((n - 1) - i));
      return this.monthKey(d);
    });
  }

  getVariableCategoryStats(nMonths: number = 12): VariableCategoryStat[] {
    const keys = this.lastNMonthKeys(nMonths);
    const nonContract = new Set(
      this.categories
        .filter(c => !this.isContractCategory(c))
        .map(c => c.id)
    );

    const byCatMonthly: Record<string, number[]> = {};
    for (const catId of nonContract) {
      byCatMonthly[catId] = keys.map(() => 0);
    }

    for (const t of this.transactions) {
      if (t.amount >= 0) continue;
      const catId = t.category_id || '';
      if (!nonContract.has(catId)) continue;
      const key = t.date.slice(0, 7);
      const idx = keys.indexOf(key);
      if (idx >= 0) {
        byCatMonthly[catId][idx] += Math.abs(t.amount);
      }
    }

    const stats: VariableCategoryStat[] = [];
    for (const catId of Object.keys(byCatMonthly)) {
      const arr = byCatMonthly[catId];
      const mean = arr.reduce((a, b) => a + b, 0) / (arr.length || 1);
      const variance = arr.reduce((s, x) => s + Math.pow(x - mean, 2), 0) / (arr.length || 1);
      const std = Math.sqrt(variance);
      const cat = this.categories.find(c => c.id === catId);
      stats.push({
        categoryId: catId,
        categoryName: cat?.name || 'Unbekannt',
        mean,
        std
      });
    }
    return stats
      .sort((a, b) => {
        const pa = this.derivePriority(this.categories.find(c => c.id === a.categoryId));
        const pb = this.derivePriority(this.categories.find(c => c.id === b.categoryId));
        if (pa !== pb) return pa - pb;
        return b.mean - a.mean;
      });
  }

  getIncomeStats(nMonths: number = 12, k: number = 1): IncomeStats {
    const keys = this.lastNMonthKeys(nMonths);
    const monthly = keys.map(() => 0);
    for (const t of this.transactions) {
      if (t.amount <= 0) continue;
      const key = t.date.slice(0, 7);
      const idx = keys.indexOf(key);
      if (idx >= 0) monthly[idx] += t.amount;
    }
    const mean = monthly.reduce((a, b) => a + b, 0) / (monthly.length || 1);
    const variance = monthly.reduce((s, x) => s + Math.pow(x - mean, 2), 0) / (monthly.length || 1);
    const std = Math.sqrt(variance);
    const alpha = 0.5;
    const beta = 1.0;
    const min = Math.max(mean - alpha * k * std, 0.8 * mean);
    const max = mean + beta * k * std;
    return { mean, std, min, max };
  }

  private computeContractsSeries(
    cancelations: Cancelation[],
    newContracts: NewContract[],
    months: Date[]
  ): { contracts: number[]; insights: string[] } {
    const labels = months.map(m => m.toLocaleDateString('de-DE', { month: 'short' }));
    const contracts = labels.map(() => 0);
    const insights: string[] = [];

    const detected = this.getDetectedContracts();
    for (const d of detected) {
      const cancelation = cancelations.find(c => c.categoryId === d.categoryId);
      const cancelRaw = cancelation?.cancelMonthIndex;
      const cancel: number | null = (cancelRaw !== null && cancelRaw !== undefined) ? cancelRaw : null;

      let earliestAllowedIndex = 0;
      const attr = d.attributes;
      
      if (attr?.next_due_date && attr?.kuendigungsfrist_tage && attr.kuendigungsfrist_tage > 0) {
        const base = parseISO(attr.next_due_date);
        const effective = new Date(base.getTime() + attr.kuendigungsfrist_tage * 24 * 60 * 60 * 1000);
        const idx = months.findIndex(m => m.getFullYear() === effective.getFullYear() && m.getMonth() === effective.getMonth());
        if (idx >= 0) earliestAllowedIndex = Math.max(earliestAllowedIndex, idx);
      }
      if (attr?.vertragsende) {
        const end = startOfMonth(parseISO(attr.vertragsende));
        const idx = months.findIndex(m => m.getFullYear() === end.getFullYear() && m.getMonth() === end.getMonth());
        if (idx >= 0) earliestAllowedIndex = Math.max(earliestAllowedIndex, idx);
      }

      const cancelIndex: number | null = cancel !== null ? Math.max(cancel, earliestAllowedIndex) : null;
      
      if (cancel !== null && cancelIndex !== null) {
        if (cancelIndex !== cancel) {
          insights.push(`"${d.categoryName}" kann frühestens ab ${labels[cancelIndex]} gekündigt werden (Beachtung Fristen).`);
        } else {
          insights.push(`"${d.categoryName}" wird ab ${labels[cancelIndex]} gekündigt.`);
        }
      }

      if (d.cycle === 'quarterly' || d.cycle === 'yearly') {
        const step = d.cycle === 'quarterly' ? 3 : 12;
        let due = d.nextDateISO ? startOfMonth(parseISO(d.nextDateISO)) : months[0];
        while (due < months[0]) due = addMonths(due, step);
        
        for (let i = 0; i < months.length; i++) {
          if (cancelIndex !== null && i >= cancelIndex) {
            break;
          }
          const m = months[i];
          if (m.getFullYear() === due.getFullYear() && m.getMonth() === due.getMonth()) {
            contracts[i] -= d.amountTypical;
            due = addMonths(due, step);
          }
        }
      } else {
        const monthly = this.monthlyEquivalent(d.amountTypical, d.cycle);
        for (let i = 0; i < months.length; i++) {
          if (cancelIndex !== null && i >= cancelIndex) {
            break;
          }
          contracts[i] -= monthly;
        }
      }
    }

    for (const nc of newContracts) {
      if (nc.cycle === 'quarterly' || nc.cycle === 'yearly') {
        const step = nc.cycle === 'quarterly' ? 3 : 12;
        for (let i = nc.startMonthIndex; i < months.length; i += step) {
          contracts[i] -= nc.amount;
        }
        insights.push(`Neuer Vertrag "${nc.name}" mit ${nc.cycle === 'quarterly' ? 'vierteljährlicher' : 'jährlicher'} Fälligkeit hinzugefügt.`);
      } else {
        const monthly = this.monthlyEquivalent(nc.amount, nc.cycle);
        for (let i = nc.startMonthIndex; i < months.length; i++) {
          contracts[i] -= monthly;
        }
        insights.push(`Neuer Vertrag "${nc.name}" ab Monat ${nc.startMonthIndex + 1} hinzugefügt.`);
      }
    }

    return { contracts, insights };
  }

  build12MonthProjectionEnhanced(
    cancelations: Cancelation[],
    newContracts: NewContract[],
    opts: SimulationOptions
  ): { points: SimulationPointExtended[]; insights: string[]; incomeStats: IncomeStats; varStats: VariableCategoryStat[] } {
    const horizon = opts.horizonMonths ?? 12;
    const start = startOfMonth(new Date());
    const months = Array.from({ length: horizon }, (_, i) => addMonths(start, i));
    const labels = months.map(m => m.toLocaleDateString('de-DE', { month: 'short' }));

    const points: SimulationPointExtended[] = labels.map(l => ({
      label: l, income: 0, contracts: 0, net: 0,
      netOptimistic: 0, netRealistic: 0, netPessimistic: 0,
      cumNetRealistic: 0, cumNetMin: 0, cumNetMax: 0, corridorWidth: 0, variables: 0
    }));

    const insights: string[] = [];

    const { contracts, insights: contractInsights } = this.computeContractsSeries(cancelations, newContracts, months);
    contractInsights.forEach(i => insights.push(i));

    const varStats = this.getVariableCategoryStats(12);
    const overrides = opts.categoryOverrides || {};
    const k = Math.max(0.1, opts.riskK || 1);

    const incomeStats = this.getIncomeStats(12, k);
    const fixedIncome = this.analyzeFixedIncome();
    const fixedIncomeMonthly = fixedIncome.reduce((sum, inc) => sum + this.monthlyEquivalent(inc.amount, inc.frequency as Cycle), 0);

    const incomeByScenario = opts.onlyVariables
      ? { optimistic: 0, realistic: 0, pessimistic: 0 } as const
      : {
          optimistic: Math.max(incomeStats.max, fixedIncomeMonthly),
          realistic: fixedIncomeMonthly,
          pessimistic: Math.max(0.8 * fixedIncomeMonthly, incomeStats.min)
        } as const;

    const varByScenario = (scenario: Scenario) => {
      let total = 0;
      for (const s of varStats) {
        const o = overrides[s.categoryId];
        const minDefault = Math.max(0, s.mean - k * s.std);
        const maxDefault = s.mean + k * s.std;
        const minVal = Math.max(0, o?.min ?? minDefault);
        const maxVal = Math.max(minVal, o?.max ?? maxDefault);
        const chosen = scenario === 'optimistic'
          ? minVal
          : scenario === 'pessimistic'
          ? maxVal
          : (minVal + maxVal) / 2;
        total += chosen;
      }
      return total;
    };

    const events = opts.events || [];
    const widenMultipliers = labels.map(() => 1);
    const eventAdjustments = labels.map(() => ({ income: 0, variables: 0 }));

    for (const ev of events) {
      for (let i = 0; i < points.length; i++) {
        if (i < ev.startMonthIndex || i > ev.endMonthIndex) continue;
        if (ev.type === 'income' && (!ev.categoryId || ev.categoryId === 'global')) {
          eventAdjustments[i].income += ev.delta;
        } else {
          eventAdjustments[i].variables += Math.abs(ev.delta);
        }
        if (ev.widenFactor && ev.widenFactor > 0) {
          widenMultipliers[i] = Math.min(widenMultipliers[i] * (1 + ev.widenFactor), 2);
        }
      }
    }

    let cumReal = 0;
    let cumOpt = 0;
    let cumPes = 0;
    for (let i = 0; i < points.length; i++) {
      const incomeOpt = incomeByScenario.optimistic + (opts.onlyVariables ? 0 : eventAdjustments[i].income);
      const incomeReal = incomeByScenario.realistic + (opts.onlyVariables ? 0 : eventAdjustments[i].income);
      const incomePes = incomeByScenario.pessimistic + (opts.onlyVariables ? 0 : eventAdjustments[i].income);

      const varsOpt = varByScenario('optimistic') + eventAdjustments[i].variables;
      const varsReal = varByScenario('realistic') + eventAdjustments[i].variables;
      const varsPes = varByScenario('pessimistic') + eventAdjustments[i].variables;

      const c = opts.onlyVariables ? 0 : contracts[i];

      points[i].income = incomeReal;
      points[i].contracts = c;
      points[i].variables = varsReal;

      points[i].netOptimistic = incomeOpt + c - varsOpt;
      points[i].netRealistic = incomeReal + c - varsReal;
      points[i].netPessimistic = incomePes + c - varsPes;
      points[i].net = points[i].netRealistic;

      cumOpt += points[i].netOptimistic;
      cumReal += points[i].netRealistic;
      cumPes += points[i].netPessimistic;
      
      points[i].cumNetRealistic = cumReal;
      points[i].cumNetMin = cumPes;
      points[i].cumNetMax = cumOpt;
      points[i].corridorWidth = (points[i].cumNetMax - points[i].cumNetMin) * widenMultipliers[i];
    }

    return { points, insights, incomeStats, varStats };
  }

  build12MonthProjection(
    cancelations: Cancelation[],
    newContracts: NewContract[]
  ): { points: ProjectionPoint[]; insights: string[] } {
    const start = startOfMonth(new Date());
    const months = Array.from({ length: 12 }, (_, i) => addMonths(start, i));
    const labels = months.map(m => m.toLocaleDateString('de-DE', { month: 'short' }));

    const points: ProjectionPoint[] = labels.map(l => ({ label: l, income: 0, contracts: 0, net: 0 }));
    const insights: string[] = [];

    const fixedIncome = this.analyzeFixedIncome();
    for (let i = 0; i < points.length; i++) {
      for (const inc of fixedIncome) {
        const mEq = this.monthlyEquivalent(inc.amount, inc.frequency as Cycle);
        points[i].income += mEq;
      }
    }

    const { contracts } = this.computeContractsSeries(cancelations, newContracts, months);

    for (let i = 0; i < points.length; i++) {
      points[i].contracts += contracts[i];
      points[i].net = points[i].income + points[i].contracts;
    }

    return { points, insights };
  }

  // === Budget Optimizer: Prioritäten, Mindestbudgets und Pläne ===

  private derivePriority(cat?: Category): number {
    const name = (cat?.name || '').toLowerCase();
    const tags = cat?.attributes?.tags || [];
    const attrPri = cat?.attributes?.prioritaet;
    const explicit = cat?.attributes?.priority_level ?? null;

    if (explicit && explicit >= 1 && explicit <= 5) return explicit;

    if (name.includes('glücksspiel')) return 5;

    if (attrPri === 'essential') return 1;
    if (attrPri === 'normal') return 3;
    if (attrPri === 'nice') return 5;

    const joined = tags.join(' ').toLowerCase();
    if (joined.includes('restaurant') || joined.includes('freizeit') || joined.includes('shopping') || joined.includes('mode')) {
      return 4;
    }

    return 3;
  }

  private floorForCategoryMean(mean: number, cat?: Category): number {
    const pri = this.derivePriority(cat);
    const isEssential = pri <= 2 || cat?.attributes?.essenziell;
    const flexible = cat?.attributes?.flexible || false;
    if (isEssential) return Math.max(0, mean * 0.8);
    if (flexible) return Math.max(0, mean * 0.6);
    return Math.max(0, mean * 0.7);
  }

  private buildOverridesFromBudgets(budgets: Record<string, number>): Record<string, { min: number; max: number }> {
    const ov: Record<string, { min: number; max: number }> = {};
    for (const [catId, val] of Object.entries(budgets)) {
      ov[catId] = { min: Math.max(0, val), max: Math.max(0, val) };
    }
    return ov;
  }

  generateSurvivalPlan(protectedIds: Set<string>, riskK: number): { suggestions: BudgetSuggestion[]; overrides: Record<string, { min: number; max: number }>; warnings: string[] } {
    const varStats = this.getVariableCategoryStats(12);
    const base: Record<string, number> = {};
    const floors: Record<string, number> = {};
    const priMap: Record<string, number> = {};

    for (const s of varStats) {
      base[s.categoryId] = s.mean;
      const cat = this.categories.find(c => c.id === s.categoryId);
      floors[s.categoryId] = cat?.attributes?.min_budget_monat ?? this.floorForCategoryMean(s.mean, cat);
      priMap[s.categoryId] = this.derivePriority(cat);
    }

    let percLow = 0.3;
    let percMid = 0.15;
    let percHigh = 0.05;

    const applyPerc = (p: number, mean: number, floor: number) => Math.max(floor, mean * (1 - p));

    const warnings: string[] = [];
    let budgets = { ...base };
    let suggestions: BudgetSuggestion[] = [];

    const recomputeAndCheck = (): { ok: boolean; points: SimulationPointExtended[] } => {
      const ov = this.buildOverridesFromBudgets(budgets);
      const { points } = this.build12MonthProjectionEnhanced([], [], { riskK, scenario: 'realistic', categoryOverrides: ov, onlyVariables: true });
      const neverBelowZero = points.every(p => p.netPessimistic >= 0 && p.cumNetMin >= 0);
      return { ok: neverBelowZero, points };
    };

    const iterate = () => {
      suggestions = [];
      for (const s of varStats) {
        const pri = priMap[s.categoryId];
        const floor = floors[s.categoryId];
        const mean = base[s.categoryId];
        const isProtected = protectedIds.has(s.categoryId);

        const perc = pri >= 4 ? percLow : pri >= 2 ? percMid : percHigh;
        const target = isProtected ? mean : applyPerc(perc, mean, floor);
        const savings = Math.max(0, mean - target);

        budgets[s.categoryId] = target;

        const priLabel = pri >= 4 ? 'niedrige Priorität' : pri >= 2 ? 'mittlere Priorität' : 'hohe Priorität';
        const reason = isProtected
          ? 'Von dir geschützt – keine Kürzung.'
          : savings > 0
            ? `Variable Ausgabe mit ${priLabel}: Ø ${Math.round(mean)}€/Monat, bis ${Math.round(perc * 100)}% über dem Mindestbudget (${Math.round(floor)}€) kürzbar.`
            : `Bereits am Mindestbudget (${Math.round(floor)}€) – keine weitere Kürzung empfohlen.`;

        suggestions.push({
          categoryId: s.categoryId,
          categoryName: s.categoryName,
          priority: pri,
          from: Math.round(mean),
          to: Math.round(target),
          savingsPerMonth: Math.round(savings),
          note: isProtected ? 'Geschützt' : undefined,
          reason,
        });
      }
    };

    iterate();
    let { ok } = recomputeAndCheck();

    let rounds = 0;
    while (!ok && rounds < 4) {
      rounds++;
      percLow = Math.min(0.5, percLow + 0.05);
      percMid = Math.min(0.25, percMid + 0.05);
      percHigh = Math.min(0.10, percHigh + 0.02);
      iterate();
      ok = recomputeAndCheck().ok;
    }

    const ov = this.buildOverridesFromBudgets(budgets);
    if (!ok) {
      warnings.push('Warnung: Selbst mit maximalen Kürzungen bleibt der pessimistische Saldo negativ. Prüfe Notrücklagen oder zusätzliche Einnahmen.');
    }

    return { suggestions, overrides: ov, warnings };
  }

  generateGoalPlan(targetAmount: number, targetMonthIndex: number, protectedIds: Set<string>, riskK: number): { suggestions: BudgetSuggestion[]; overrides: Record<string, { min: number; max: number }>; warnings: string[] } {
    const varStats = this.getVariableCategoryStats(12);
    const base: Record<string, number> = {};
    const floors: Record<string, number> = {};
    const priMap: Record<string, number> = {};

    for (const s of varStats) {
      base[s.categoryId] = s.mean;
      const cat = this.categories.find(c => c.id === s.categoryId);
      floors[s.categoryId] = cat?.attributes?.min_budget_monat ?? this.floorForCategoryMean(s.mean, cat);
      priMap[s.categoryId] = this.derivePriority(cat);
    }

    const baseOv = this.buildOverridesFromBudgets(base);
    const { points } = this.build12MonthProjectionEnhanced([], [], { riskK, scenario: 'realistic', categoryOverrides: baseOv, horizonMonths: Math.max(12, targetMonthIndex + 1), onlyVariables: true });
    const needByDeadline = targetAmount - Math.max(0, points[targetMonthIndex]?.cumNetMin || 0);

    const warnings: string[] = [];
    if (needByDeadline <= 0) {
      const suggestions: BudgetSuggestion[] = [];
      return { suggestions, overrides: baseOv, warnings };
    }

    const totalWeight = varStats.reduce((sum, s) => {
      const pri = priMap[s.categoryId];
      const w = pri >= 4 ? 3 : pri >= 2 ? 2 : 1;
      return sum + w;
    }, 0);

    const monthsLeft = Math.max(1, targetMonthIndex + 1);
    const monthlyNeeded = Math.ceil(needByDeadline / monthsLeft);

    let budgets = { ...base };
    const suggestions: BudgetSuggestion[] = [];

    for (const s of varStats) {
      const pri = priMap[s.categoryId];
      const floor = floors[s.categoryId];
      const mean = base[s.categoryId];
      const isProtected = protectedIds.has(s.categoryId);
      const w = pri >= 4 ? 3 : pri >= 2 ? 2 : 1;

      const share = (monthlyNeeded * w) / totalWeight;
      const target = isProtected ? mean : Math.max(floor, mean - share);

      budgets[s.categoryId] = target;

      const savings = Math.max(0, mean - target);
      const priLabel = pri >= 4 ? 'niedrige Priorität' : pri >= 2 ? 'mittlere Priorität' : 'hohe Priorität';
      const reason = isProtected
        ? 'Von dir geschützt – keine Kürzung.'
        : savings > 0
          ? `Beitrag zum Sparziel (${priLabel}): anteilig ${Math.round(savings)}€/Monat von Ø ${Math.round(mean)}€, Mindestbudget ${Math.round(floor)}€.`
          : `Bereits am Mindestbudget (${Math.round(floor)}€) – kein weiterer Beitrag möglich.`;

      suggestions.push({
        categoryId: s.categoryId,
        categoryName: s.categoryName,
        priority: pri,
        from: Math.round(mean),
        to: Math.round(target),
        savingsPerMonth: Math.round(savings),
        note: isProtected ? 'Geschützt' : undefined,
        reason,
      });
    }

    const ov = this.buildOverridesFromBudgets(budgets);
    const { points: checkPoints } = this.build12MonthProjectionEnhanced([], [], { riskK, scenario: 'realistic', categoryOverrides: ov, horizonMonths: Math.max(12, targetMonthIndex + 1), onlyVariables: true });

    const savedByDeadline = Math.max(0, checkPoints[targetMonthIndex]?.cumNetMin || 0);
    if (savedByDeadline < targetAmount) {
      warnings.push('Warnung: Mit den vorgeschlagenen Anpassungen wird das Ziel im pessimistischen Szenario nicht erreicht. Erwäge spätere Frist, höhere Rate oder zusätzliche Einnahmen.');
    }

    return { suggestions, overrides: ov, warnings };
  }

  /** Kündigungs-Hinweis aus Vertrags-Attributen (Frist/Ende), falls vorhanden. */
  private cancellationNote(attributes: Category['attributes'] | undefined): string {
    if (!attributes) return '';
    const parts: string[] = [];
    if (attributes.kuendigungsfrist_tage) {
      parts.push(`Kündigungsfrist ${attributes.kuendigungsfrist_tage} Tage`);
    }
    if (attributes.vertragsende) {
      parts.push(`Vertragsende ${attributes.vertragsende}`);
    }
    return parts.length ? ` Ersparnis erst nach Ablauf: ${parts.join(', ')}.` : '';
  }

  /**
   * Konkrete, begründete Vertragsvorschläge (Audit P2-UX U5). Statt fiktiver
   * Preissenkungen werden echte Hebel vorgeschlagen: Redundante Abos derselben
   * Domäne bündeln/reduzieren (z.B. mehrere Streaming-Dienste), teure Verträge
   * zum Wechsel/Prüfen markieren. Jede Empfehlung trägt eine Begründung mit Zahlen.
   */
  generateContractActions(): ContractAction[] {
    const contracts = this.getDetectedContracts();
    const eur = (v: number) =>
      v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

    // Pro Vertrag den monatlichen Äquivalenzbetrag bestimmen.
    const withMonthly = contracts.map(c => ({
      ...c,
      monthly: this.monthlyEquivalent(c.amountTypical || 0, c.cycle),
    }));

    // Nach Domäne gruppieren (nur erkannte Domänen).
    const byDomain = new Map<string, typeof withMonthly>();
    for (const c of withMonthly) {
      const domain = this.contractDomain(c.categoryName);
      if (!domain) continue;
      const arr = byDomain.get(domain) ?? [];
      arr.push(c);
      byDomain.set(domain, arr);
    }

    const actions: ContractAction[] = [];
    // Domänen, in denen Redundanz typisch und Bündelung/Reduktion sinnvoll ist.
    const bundleDomains = new Set(['Streaming', 'Fitness']);

    for (const [domain, items] of byDomain) {
      const active = items.filter(i => i.monthly > 0);
      if (bundleDomains.has(domain) && active.length >= 2) {
        const sorted = [...active].sort((a, b) => b.monthly - a.monthly);
        const total = sorted.reduce((s, i) => s + i.monthly, 0);
        const cheapest = sorted[sorted.length - 1].monthly;
        // Reduktion auf einen Dienst spart alle bis auf den günstigsten.
        const savings = Math.round(total - cheapest);
        const names = sorted.map(i => `${i.categoryName} (${eur(i.monthly)}/Monat)`).join(', ');
        const cancelNote = sorted.map(i => this.cancellationNote(i.attributes)).find(Boolean) ?? '';
        actions.push({
          kind: 'bundle',
          categoryIds: sorted.map(i => i.categoryId),
          domain,
          title: `${active.length} ${domain}-Abos gefunden`,
          reason:
            `${names} – zusammen ${eur(total)}/Monat. Auf einen Dienst reduzieren spart bis zu ${eur(savings)}/Monat.` +
            cancelNote,
          monthlySavingsEstimate: savings,
        });
      } else if (!bundleDomains.has(domain)) {
        // Wechsel-/Prüf-Domänen (Versicherung, Telekom, Energie): teuersten Vertrag
        // zum Anbietervergleich markieren – ohne erfundene Sparsumme.
        const top = [...active].sort((a, b) => b.monthly - a.monthly)[0];
        if (top && top.monthly > 0) {
          actions.push({
            kind: 'review',
            categoryIds: [top.categoryId],
            domain,
            title: `${top.categoryName} prüfen`,
            reason:
              `${top.categoryName} kostet ${eur(top.monthly)}/Monat (${eur(top.monthly * 12)}/Jahr). ` +
              `Ein Anbietervergleich/Tarifwechsel kann die feste Belastung senken.` +
              this.cancellationNote(top.attributes),
            monthlySavingsEstimate: 0,
          });
        }
      }
    }

    // Stärkste Hebel zuerst.
    return actions.sort((a, b) => b.monthlySavingsEstimate - a.monthlySavingsEstimate);
  }
}