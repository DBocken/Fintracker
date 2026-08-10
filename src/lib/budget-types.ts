/**
 * Persistierte und abgeleitete Formen rund um Budgets („Tanks").
 *
 * Budgets sind Domäne, nicht Darstellung und nicht Speicherung — der
 * `budget-service` speichert `Budget`, besitzt die Form aber nicht
 * (AGENTS.md §3). Die reine Auswertungslogik (`lib/budget-logic.ts`,
 * `lib/budget-rollover.ts`, `lib/budget-adaptive.ts` u. a.) braucht diese
 * Typen direkt, ohne entgegen der Schichtrichtung nach oben zu importieren.
 * Diese Datei ist Teil der Aufteilung von `src/types.ts` (WP 5.2, DOM-3).
 */

/**
 * Budget-Periode. Aktuell ist nur `monthly` aktiv – `weekly`/`yearly` sind im
 * Typ schon vorgesehen, werden aber erst mit dem Premium-Ausbau freigeschaltet.
 */
export type BudgetPeriod = 'monthly' | 'weekly' | 'yearly';

/**
 * Eine einzelne Matching-Regel eines (Premium-)Budgets. Ohne Premium bleibt
 * `rules` leer – das Budget rechnet dann rein kategorie-basiert. Die Felder sind
 * bereits modelliert, damit der spätere Regel-Editor keine Datenmigration braucht.
 */
export interface BudgetRule {
  /** Worauf die Regel prüft. */
  field: 'payee' | 'description' | 'amount' | 'account';
  /** Vergleichsoperator. */
  op: 'contains' | 'equals' | 'gt' | 'lt';
  /** Vergleichswert (String für Text/Konto, Zahl für Betrag – als String gehalten). */
  value: string;
}

/**
 * Übertrags-Modus eines Budgets zwischen zwei Perioden:
 * - `off`        – jeder Monat startet frisch beim Basislimit
 * - `accumulate` – nicht genutztes Budget wandert mit (Limit steigt)
 * - `overspend`  – Überschreitung wird vom Folgemonat abgezogen (Start im Minus)
 * - `both`       – positiver und negativer Übertrag
 */
export type RolloverMode = 'off' | 'accumulate' | 'overspend' | 'both';

/** Was mit positivem Restbudget am Periodenende geschieht. */
export type SurplusAction = 'carry' | 'sweep_savings' | 'sweep_invest';

/** Rollover-Konfiguration eines Budgets (löst das alte boolean `rollover` ab). */
export interface BudgetRollover {
  mode: RolloverMode;
  /** Obergrenze des angesparten positiven Übertrags in EUR (0/undefined = unbegrenzt). */
  cap?: number;
  /** Verbleib des positiven Rests (Default `carry`). `sweep_*` führt ihn ab statt zu kumulieren. */
  surplusAction?: SurplusAction;
  /** Zielkonto für einen Sweep (z. B. Tagesgeld). */
  sweepTargetAccountId?: string;
  /** Ziel-Sparziel/Milestone für einen Sweep. */
  sweepTargetGoalId?: string;
}

/** Abgeleiteter Übertrags-Stand eines Budgets für eine konkrete Periode. */
export interface BudgetPeriodLedger {
  budgetId: string;
  /** Periode `YYYY-MM`. */
  period: string;
  /** Basislimit der Periode (ggf. datengetrieben). */
  baseLimit: number;
  /** Übertrag aus der Vorperiode (kann negativ sein). */
  carryIn: number;
  /** Effektives Limit = Basislimit + carryIn. */
  effectiveLimit: number;
  /** Tatsächliche Ausgaben der Periode. */
  spent: number;
  /** Verbleibend = effektives Limit − Ausgaben. */
  remaining: number;
  /** Per Sweep abgeführter Überschuss (siehe `surplusAction`). */
  swept: number;
  /** An die Folgeperiode weitergereichter Übertrag. */
  carryOut: number;
}

/**
 * Ein benutzerdefiniertes Budget – visualisiert als „Tank". Ein Budget bindet
 * an genau eine Hauptkategorie; optional lassen sich einzelne Unterkategorien
 * auswählen (leer = alle Unterkategorien zählen). Alles strikt lokal gespeichert.
 */
export interface Budget {
  id: string;
  name: string;
  /** Hauptkategorie, deren Ausgaben in den Tank fließen. */
  category_id: string;
  /** Teilmenge der Unterkategorien; leer/undefined = alle zählen. */
  subcategory_ids?: string[];
  /** Monatslimit in EUR (positiv). */
  limit: number;
  /** Warnschwelle in Prozent (Default 80). Ab hier färbt sich der Tank. */
  warn_threshold?: number;
  /** Akzentfarbe des Tanks (CSS-Farbe); fällt sonst auf die Kategoriefarbe zurück. */
  color?: string;
  /** Emoji/Icon-Hinweis für die Karte. */
  icon?: string;
  /** Aus einem Vorschlag erstellt (für Analytics/Hinweise). */
  from_suggestion?: boolean;

  // --- Premium-Felder (bereits modelliert, UI erst mit Premium) ---
  /** Abrechnungsperiode. Ohne Premium immer `monthly`. */
  period?: BudgetPeriod;
  /**
   * @deprecated Altes boolean-Feld. Wird via `resolveRolloverConfig` auf
   * `{ mode: 'accumulate' }` migriert. Neue Logik nutzt `rolloverConfig`.
   */
  rollover?: boolean;
  /** Rollover-Konfiguration (Übertrag, Cap, Sweep). Premium. */
  rolloverConfig?: BudgetRollover;
  /**
   * Datengetriebenes Basislimit: statt des fixen `limit` wird je Monat der
   * Median der jüngsten Ausgaben verwendet („Adaptive Tank"). `limit` dient dann
   * als Fallback ohne Historie. Premium.
   */
  adaptive?: boolean;
  /** Zusätzliche Match-Regeln. Premium; ohne Premium leer. */
  rules?: BudgetRule[];

  created_at?: string;
  updated_at?: string;
}

/** Abweichung des gesetzten Limits vom realen Median (Auto-Retune-Hinweis). */
export interface BudgetDrift {
  /** Realer Median der jüngsten Ausgaben. */
  median: number;
  /** Aktuelles (Basis-)Limit. */
  limit: number;
  /** Differenz `median − limit` (positiv = Ausgaben über Limit). */
  drift: number;
  /** Relative Abweichung |drift|/limit. */
  ratio: number;
  /** Richtung der Abweichung relativ zum Limit. */
  direction: 'over' | 'under' | 'ok';
  /** Empfohlenes neues Limit (gerundet) bei signifikanter Abweichung. */
  suggestedLimit: number;
  /** true, wenn die relative Abweichung die Schwelle überschreitet. */
  significant: boolean;
}

/** Ampel-Status eines Budgets relativ zur Warnschwelle/zum Limit. */
export type BudgetHealth = 'ok' | 'warn' | 'over';

/** Berechneter Live-Stand eines Budgets für eine konkrete Periode. */
export interface BudgetStatus {
  budget: Budget;
  /** Ausgegeben in der Periode (positiver EUR-Betrag). */
  spent: number;
  /** Verbleibend (kann negativ sein bei Überschreitung). */
  remaining: number;
  /** Auslastung 0..1+ (Ausgaben / Limit). */
  ratio: number;
  /** Füllstand in Prozent, 0..100 gekappt (für den Tank). */
  fillPercent: number;
  health: BudgetHealth;

  // --- Rollover (optional; nur gesetzt, wenn über die Rollover-Engine berechnet) ---
  /** Übertrag aus der Vorperiode (kann negativ sein). */
  carryIn?: number;
  /** Effektives Limit der Periode (Basislimit + carryIn). */
  effectiveLimit?: number;
  /** An die Folgeperiode weitergereichter Übertrag. */
  carryOut?: number;
  /** Per Sweep abgeführter Überschuss. */
  swept?: number;
  /** Abweichung des Limits vom realen Median (für „Limit anpassen?"-Hinweis). */
  drift?: BudgetDrift;
}

/** Vorgeschlagenes Budget für eine Hauptkategorie (noch nicht gespeichert). */
export interface BudgetSuggestion {
  category_id: string;
  name: string;
  /** Vorgeschlagenes Limit (gerundet) auf Basis des Durchschnitts. */
  limit: number;
  /** Durchschnittliche Monatsausgabe, auf der der Vorschlag basiert. */
  avgMonthly: number;
  color?: string;
  icon?: string;
}
