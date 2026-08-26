/**
 * Tilgungsplan aus Schulden und Monatsbudget — rein, ohne I/O.
 *
 * Lag bis Welle 3 im `debt-service`, wo er zuerst gebraucht wurde. Kein I/O
 * steckt darin; mit dem Chat kam ein zweiter Nutzer WEITER UNTEN dazu, und
 * ein Registereintrag darf `src/services/` nicht importieren. Nachgebaut wäre
 * die Simulation ein zweiter Ort, an dem Zinsreihenfolge, Prioritätsstufen
 * und Budgetverteilung auseinanderlaufen können — bei einer Rechnung, die
 * Menschen über Jahre bindet, ist das der teuerste denkbare Doppelbestand.
 *
 * Das I/O bleibt beim Dienst: Er lädt die Schulden und ruft dies hier.
 */
import type { Debt, DebtPriority } from '@/lib/debt-types';

/**
 * Obergrenze der Simulation in Monaten (50 Jahre).
 *
 * Sie ist eine ABBRUCHBEDINGUNG, kein Ergebnis: Decken die Raten die Zinsen
 * nicht, wächst die Schuld, und die Schleife läuft bis hierher. `totalMonths`
 * ist dann genau dieser Wert und `totalInterestPaid` eine Zahl ohne
 * Aussagekraft — gemessen 399.575.500 € bei 20.000 € Schuld und 5 € Rate.
 *
 * `insufficientBudget` fängt das NICHT ab: Es prüft nur, ob das Budget unter
 * der Summe der Mindestraten liegt. Wer mit exakt den Mindestraten rechnet —
 * und das ist die ehrliche Annahme für „wie lange zahle ich noch" — bekommt
 * die Grenze also ohne jede Warnung. Deshalb ist sie exportiert: Wer die
 * Zahlen liest, muss sie gegen diesen Wert prüfen können.
 */
export const MAX_TILGUNGS_MONATE = 600;

export type PayoffStrategy = "snowball" | "avalanche";

export interface PayoffStep {
  debtId: string;
  name: string;
  balance: number;
  interestRate: number;
  monthsToPayoff: number;
  totalInterestPaid: number;
  priorityOrder: number;
  priority: DebtPriority;
}

export interface PayoffPlan {
  strategy: PayoffStrategy;
  steps: PayoffStep[];
  totalMonths: number;
  totalInterestPaid: number;
  insufficientBudget: boolean;
}

export function calculatePayoffPlan(
  debts: Debt[],
  monthlyBudget: number,
  strategy: PayoffStrategy,
): PayoffPlan {
  const active = debts
    .filter((d) => !d.is_paid_off && d.balance > 0)
    .map((d) => ({
      id: d.id,
      name: d.name,
      initialBalance: Math.max(0, d.balance),
      balance: Math.max(0, d.balance),
      annualRate: Math.max(0, d.interest_rate),
      rate: Math.max(0, d.interest_rate) / 100 / 12,
      min: Math.max(0, d.min_payment),
      priority: (d.priority ?? "normal") as DebtPriority,
      monthsToPayoff: 0,
      interestPaid: 0,
    }));

  const totalMin = active.reduce((s, d) => s + d.min, 0);
  // Existenzsichernd schlägt jede Strategie; Avalanche/Snowball ordnen nur
  // noch innerhalb der Prioritätsstufe (#51).
  const tier = (d: { priority: DebtPriority }) => (d.priority === "existenzsichernd" ? 0 : 1);
  const priority = [...active].sort((a, b) => {
    if (tier(a) !== tier(b)) return tier(a) - tier(b);
    if (strategy === "snowball") return a.initialBalance - b.initialBalance || b.annualRate - a.annualRate;
    return b.annualRate - a.annualRate || a.initialBalance - b.initialBalance;
  });
  const priorityOrder = new Map(priority.map((d, index) => [d.id, index + 1]));

  if (active.length === 0) {
    return { strategy, steps: [], totalMonths: 0, totalInterestPaid: 0, insufficientBudget: false };
  }
  if (monthlyBudget + 0.01 < totalMin) {
    return {
      strategy,
      steps: priority.map((d) => ({
        debtId: d.id,
        name: d.name,
        balance: d.initialBalance,
        interestRate: d.annualRate,
        monthsToPayoff: 0,
        totalInterestPaid: 0,
        priorityOrder: priorityOrder.get(d.id) || 0,
        priority: d.priority,
      })),
      totalMonths: 0,
      totalInterestPaid: 0,
      insufficientBudget: true,
    };
  }

  let month = 0;
  while (active.some((d) => d.balance > 0.01) && month < MAX_TILGUNGS_MONATE) {
    month += 1;

    for (const d of active) {
      if (d.balance <= 0.01) continue;
      const interest = d.balance * d.rate;
      d.balance += interest;
      d.interestPaid += interest;
    }

    let remainingBudget = monthlyBudget;
    for (const d of active) {
      if (d.balance <= 0.01) continue;
      const payment = Math.min(d.balance, d.min);
      d.balance -= payment;
      remainingBudget -= payment;
      if (d.balance <= 0.01 && !d.monthsToPayoff) d.monthsToPayoff = month;
    }

    for (const target of priority) {
      if (remainingBudget <= 0.01) break;
      if (target.balance <= 0.01) continue;
      const extra = Math.min(target.balance, remainingBudget);
      target.balance -= extra;
      remainingBudget -= extra;
      if (target.balance <= 0.01 && !target.monthsToPayoff) target.monthsToPayoff = month;
    }
  }

  const steps = priority.map((d) => ({
    debtId: d.id,
    name: d.name,
    balance: d.initialBalance,
    interestRate: d.annualRate,
    monthsToPayoff: d.monthsToPayoff || month,
    totalInterestPaid: Math.round(d.interestPaid * 100) / 100,
    priorityOrder: priorityOrder.get(d.id) || 0,
    priority: d.priority,
  }));

  return {
    strategy,
    steps,
    totalMonths: month,
    totalInterestPaid: Math.round(steps.reduce((s, x) => s + x.totalInterestPaid, 0) * 100) / 100,
    insufficientBudget: false,
  };
}
