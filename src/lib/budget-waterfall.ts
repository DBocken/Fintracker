// Liquiditäts-Wasserfall: unsere eigene Budget-Methodik.
//
// Reihenfolge der Mittelverwendung (Pay-yourself-first + Null-Saldo):
//   Einkommen → [Steuerrücklage] → Sparen zuerst → Existenzsichernde Fixkosten
//   → variable Töpfe (Null-Saldo) → Überschuss.
// Die Steuer-Stufe kommt VOR dem Sparen (Steuern sind fremdes Geld → höchste
// Dotierungs-Priorität) und wird nur emittiert, wenn taxReserveMonthly > 0 —
// ohne sie bleibt das Ergebnis bit-identisch zum Bestand.
// Reine, datengetriebene Logik (die realen Eingaben liefert der Service).

import { t } from "@/i18n/serviceT";

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
  /** Monatliche Steuerrücklage (Einzelunternehmer); fehlt/≤ 0 ⇒ keine Stufe. */
  taxReserveMonthly?: number;
}

export type WaterfallStepKey = "tax-reserve" | "savings" | "essentials" | "discretionary" | "surplus";

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

  // Steuer vor Sparen — nur emittieren, wenn wirklich dotiert wird, damit das
  // Bestandsverhalten ohne Einzelunternehmer-Modus unverändert bleibt.
  if ((input.taxReserveMonthly ?? 0) > 0) {
    take("tax-reserve", t("budgetWaterfall.taxReserve", "Steuerrücklage"), input.taxReserveMonthly!);
  }
  take("savings", t("budgetWaterfall.savingsFirst", "Sparen zuerst"), resolveSavingsAmount(income, input.savings));
  take("essentials", t("budgetWaterfall.essentials", "Fixkosten"), input.essentials);
  take("discretionary", t("budgetWaterfall.discretionary", "Variable Töpfe"), input.discretionaryRequested);

  const surplus = available;
  steps.push({
    key: "surplus",
    label: t("budgetWaterfall.surplus", "Überschuss"),
    requested: 0,
    allocated: surplus,
    funded: true,
    shortfall: 0,
  });

  // Key-Lookup statt Positionsindex: die optionale Steuer-Stufe verschiebt die
  // Positionen — steps[0]/steps[1] würde Sparquote/feasible still verfälschen.
  const savingsAllocated = steps.find((s) => s.key === "savings")?.allocated ?? 0;
  const essentialsShortfall = steps.find((s) => s.key === "essentials")?.shortfall ?? 0;
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
