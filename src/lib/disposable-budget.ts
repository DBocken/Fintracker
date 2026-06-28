/**
 * "Verfügbar bis Gehalt" als virtueller Budget-Tank.
 *
 * Frage des Nutzers: *Wie viel Geld bleibt mir bis zum nächsten Gehaltseingang?*
 * Antwort = operatives Guthaben jetzt − die bis dahin noch fälligen
 * Pflicht-Abbuchungen (Verträge). Diese reine Funktion liefert die Zahlen und
 * einen synthetischen, an das bestehende Budget-Tank-Bild angelehnten Status.
 *
 * Tank-Metapher konsistent zur App: der Tank füllt sich mit dem, was schon
 * *belegt* ist (Pflichten / Guthaben). Voll & rot = die Fixkosten fressen das
 * Guthaben vor dem Gehalt auf. Die große Kennzahl bleibt der frei verfügbare
 * Rest, damit die Aussage eindeutig ist.
 */
import type { ForecastAccount, ForecastAccountKind, RecurringFlow } from '@/lib/forecast-types';
import type { BudgetHealth } from '@/types';
import { DEFAULT_WARN_THRESHOLD, healthFor } from '@/lib/budget-logic';
import { getUpcomingCharges, sumExpenses } from '@/lib/upcoming-charges';

/** Direkt zahlungsrelevante Kontoarten – identisch zur Forecast-Engine (operatingCash). */
const OPERATING_KINDS: ReadonlySet<ForecastAccountKind> = new Set(['checking', 'cash', 'wallet']);

/** Summe der operativen Guthaben (Giro + Bar + Wallet) aus den Forecast-Konten. */
export function computeOperatingCash(accounts: ForecastAccount[]): number {
  return accounts
    .filter((a) => OPERATING_KINDS.has(a.kind))
    .reduce((sum, a) => sum + (Number.isFinite(a.openingBalance) ? a.openingBalance : 0), 0);
}

export interface DisposableInput {
  accounts: ForecastAccount[];
  recurringFlows: RecurringFlow[];
  /** Heute (ISO yyyy-mm-dd). */
  fromISO: string;
  /** Nächster Gehalts-/Geldeingang (ISO yyyy-mm-dd). */
  paydayISO: string;
  /** Tage bis zum Gehalt (vom Aufrufer durchgereicht, für die UI). */
  daysUntilPayday: number;
  /** Warnschwelle in Prozent (Default 80) – steuert die Ampel. */
  warnThreshold?: number;
}

export interface DisposableUntilPayday {
  /** Operatives Guthaben jetzt (Giro + Bar + Wallet). */
  operatingCash: number;
  /** Summe der bis zum Gehalt fälligen Abbuchungen (positiv). */
  obligations: number;
  /** Frei verfügbar bis zum Gehalt = operatingCash − obligations (kann negativ sein). */
  disposable: number;
  /** Tankfüllung 0..100: Anteil des Guthabens, der bis zum Gehalt schon belegt ist. */
  fillPercent: number;
  /** Ampel via {@link healthFor}: over, sobald die Pflichten das Guthaben übersteigen. */
  health: BudgetHealth;
  paydayISO: string;
  daysUntilPayday: number;
  /** Anzahl der bis zum Gehalt fälligen Abbuchungen. */
  obligationCount: number;
  warnThreshold: number;
}

/**
 * Berechnet den frei verfügbaren Betrag bis zum nächsten Gehalt und den
 * Tank-Status. Pflichten = Abbuchungen aus den Flows im Fenster [heute, Gehalt].
 * Das Gehalt-Datum selbst ist eingeschlossen (konservativ: eine an dem Tag
 * fällige Buchung könnte vor der Gutschrift abgehen).
 */
export function computeDisposableUntilPayday(input: DisposableInput): DisposableUntilPayday {
  const warnThreshold = input.warnThreshold ?? DEFAULT_WARN_THRESHOLD;
  const operatingCash = computeOperatingCash(input.accounts);

  const charges = getUpcomingCharges(input.recurringFlows, {
    fromISO: input.fromISO,
    toISO: input.paydayISO,
  });
  const obligations = sumExpenses(charges);
  const obligationCount = charges.filter((c) => c.direction === 'expense').length;

  const disposable = operatingCash - obligations;

  // Belegt-Anteil (Konsum-Metapher wie bei den übrigen Budget-Tanks). Ohne
  // positives Guthaben ist der Tank voll, sobald überhaupt Pflichten anstehen.
  const fillPercent =
    operatingCash > 0
      ? Math.max(0, Math.min(100, (obligations / operatingCash) * 100))
      : obligations > 0
        ? 100
        : 0;

  // Ampel über die bestehende Budget-Regel: "verbraucht" = Pflichten, "Limit" =
  // Guthaben. → over, wenn die Pflichten das Guthaben übersteigen (Minus vor Gehalt).
  const health = healthFor(obligations, operatingCash, warnThreshold);

  return {
    operatingCash,
    obligations,
    disposable,
    fillPercent,
    health,
    paydayISO: input.paydayISO,
    daysUntilPayday: input.daysUntilPayday,
    obligationCount,
    warnThreshold,
  };
}
