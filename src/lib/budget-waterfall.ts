// Liquiditäts-Wasserfall: unsere eigene Budget-Methodik.
//
// Reihenfolge der Mittelverwendung (Pay-yourself-first + Null-Saldo):
//   Einkommen → Sparen zuerst → Existenzsichernde Fixkosten → variable Töpfe
//   (Null-Saldo) → Überschuss.
// Reine, datengetriebene Logik (die realen Eingaben liefert der Service).

export type SavingsMode = "percent" | "amount";

export interface WaterfallInput {
  /** Erwartetes Monatseinkommen. */
  income: number;
  /** Pay-yourself-first: feste Sparquote (%) oder fester Betrag. */
  savings: { mode: SavingsMode; value: number };
  /** Summe existenzsichernder Fixkosten (z. B. Median der „essenziell"-Kategorien). */
  essentials: number;
  /** Summe der gewünschten variablen Budgets (Null-Saldo-Verteilung). */
  discretionaryRequested: number;
}

export type WaterfallStepKey = "savings" | "essentials" | "discretionary" | "surplus";

export interface WaterfallStep {
  key: WaterfallStepKey;
  label: string;
  /** Gewünschter/benötigter Betrag (bei „surplus" stets 0). */
  requested: number;
  /** Tatsächlich aus dem Einkommen zugeteilt. */
  allocated: number;
  /** Vollständig gedeckt? */
  funded: boolean;
  /** Ungedeckter Rest (requested − allocated, ≥ 0). */
  shortfall: number;
}

export interface WaterfallResult {
  income: number;
  steps: WaterfallStep[];
  /** Frei verfügbarer Überschuss nach allen Stufen (≥ 0). */
  surplus: number;
  /** Summe aller ungedeckten Beträge. */
  totalShortfall: number;
  /** true, wenn Sparen + Fixkosten ins Einkommen passen. */
  feasible: boolean;
  /** Tatsächlich erreichte Sparquote (zugeteiltes Sparen / Einkommen). */
  savingsRate: number;
}

const EPS = 1e-9;

/** Sparbetrag aus der Konfiguration (Prozent vom Einkommen oder fester Betrag). */
export function resolveSavingsAmount(income: number, savings: WaterfallInput["savings"]): number {
  const raw = savings.mode === "percent" ? (Math.max(0, income) * savings.value) / 100 : savings.value;
  return Math.max(0, raw);
}

/**
 * Verteilt das Einkommen kaskadierend über die Wasserfall-Stufen. Jede Stufe
 * bekommt höchstens, was noch verfügbar ist; was nicht reicht, wird als
 * `shortfall` ausgewiesen. `feasible` ist false, wenn die Fixkosten nach dem
 * Sparen nicht mehr voll gedeckt sind (Sparquote zu aggressiv).
 */
export function computeWaterfall(input: WaterfallInput): WaterfallResult {
  const income = Math.max(0, input.income);
  let available = income;

  const steps: WaterfallStep[] = [];
  const take = (key: WaterfallStepKey, label: string, requestedRaw: number) => {
    const requested = Math.max(0, requestedRaw);
    const allocated = Math.min(requested, available);
    available -= allocated;
    steps.push({
      key,
      label,
      requested,
      allocated,
      funded: allocated >= requested - EPS,
      shortfall: Math.max(0, requested - allocated),
    });
  };

  take("savings", "Sparen zuerst", resolveSavingsAmount(income, input.savings));
  take("essentials", "Fixkosten", input.essentials);
  take("discretionary", "Variable Töpfe", input.discretionaryRequested);

  const surplus = available;
  steps.push({ key: "surplus", label: "Überschuss", requested: 0, allocated: surplus, funded: true, shortfall: 0 });

  const savingsAllocated = steps[0].allocated;
  const essentialsShortfall = steps[1].shortfall;
  const totalShortfall = steps.reduce((sum, s) => sum + s.shortfall, 0);

  return {
    income,
    steps,
    surplus,
    totalShortfall,
    feasible: essentialsShortfall <= EPS,
    savingsRate: income > 0 ? savingsAllocated / income : 0,
  };
}
