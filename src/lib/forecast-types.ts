/**
 * Forecast Engine – Domain Types (Stufe 1: Core Cashflow)
 *
 * Diese Typen beschreiben das *fachliche Zielbild* der Forecast-Engine als
 * reine Datenstruktur: tagesgenaue Liquiditätsprojektion mit Kontoarten,
 * zykluskorrekten wiederkehrenden Zahlungen, internen Transfers, variabler
 * Ausgaben-Baseline, Sicherheitspuffer und Monatstief.
 *
 * Bewusst getrennt werden drei Cash-Sichten:
 *  - operatingCash : direkt zahlungsrelevantes Geld (Giro, Bargeld, Wallet)
 *  - availableCash : operatingCash + kurzfristig verfügbare Reserven (Tagesgeld)
 *  - netWorth      : Vermögen minus Schulden (alle Konten signiert summiert)
 *
 * Spätere Stufen (Monte Carlo, Szenarien, Rücklagen) docken an diesen Typen an,
 * ohne den Kern umzubauen.
 */

/**
 * Kontoarten aus Sicht der Forecast-Engine.
 *
 * Bildet die echten {@link AccountType}-Werte der App ab und ergänzt
 * `investment` / `loan` für reine Net-Worth-Quellen (Depot, Kredit), die in der
 * App über eigene Services laufen, aber den Vermögensverlauf beeinflussen.
 */
export type ForecastAccountKind =
  | 'checking'
  | 'cash'
  | 'wallet'
  | 'savings' // Tagesgeld / Sparkonto
  | 'credit_card'
  | 'investment'
  | 'loan'
  | 'other';

/** Ein Konto im Forecast mit Startsaldo und Liquiditäts-Einstufung. */
export interface ForecastAccount {
  id: string;
  name: string;
  kind: ForecastAccountKind;
  /** Startsaldo in Hauptwährungseinheiten (z. B. Euro), signiert. */
  openingBalance: number;
  /**
   * Zählt dieses Konto zur verfügbaren Reserve (availableCash)?
   * Default wird aus {@link ForecastAccountKind} abgeleitet: operative Konten
   * und Tagesgeld/Spar zählen als verfügbar, Depot/Kredit/Kreditkarte nicht.
   */
  liquidReserve?: boolean;
  /**
   * Jährlicher Zinssatz in Prozent (z. B. 2.5 für 2,5 % p. a.). Wird monatlich
   * auf den positiven Saldo verzinst (deterministisch, kein Zufall). Default: 0.
   */
  annualInterestRate?: number;
}

/** Zahlungsrhythmus einer wiederkehrenden Zahlung. */
export type RecurringCadence =
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'semiannual'
  | 'annual'
  | 'custom';

/**
 * Eine wiederkehrende Zahlung (Vertrag, Gehalt, Abo, Sparrate als Cashflow …).
 *
 * `amount` ist signiert: positiv = Einnahme (inflow), negativ = Ausgabe (outflow).
 * Die Zahlung wird entlang ihres echten Rhythmus durch den Horizont gelegt –
 * eine Jahreszahlung also genau einmal pro Jahr, nicht jeden Monat.
 */
export interface RecurringFlow {
  id: string;
  name: string;
  /** Signierter Betrag in Hauptwährungseinheiten (positiv = Einnahme). */
  amount: number;
  cadence: RecurringCadence;
  /** Bekannte Referenz-Fälligkeit (ISO yyyy-mm-dd), Anker für den Rhythmus. */
  anchorDate: string;
  /** Nur für cadence='custom': Intervalllänge in Tagen. */
  intervalDays?: number;
  accountId: string;
  category?: string;
  /** Frühestens ab diesem Datum buchen (ISO yyyy-mm-dd). */
  startDate?: string;
  /** Spätestens bis zu diesem Datum buchen (ISO yyyy-mm-dd). */
  endDate?: string;
  /** Erkennungsqualität 0..1 (nur Metadatum, beeinflusst PR1-Logik nicht). */
  confidence?: number;
  /**
   * Auto-deaktiviert durch Vertragsstatus (ended/rejected/paused/stale).
   * Flows mit disabled=true fließen NICHT in die Prognose ein, werden aber
   * in der UI angezeigt, damit der Nutzer den Zustand sieht.
   */
  disabled?: boolean;
}

/**
 * Interne Umbuchung zwischen eigenen Konten – verändert *nie* das Net Worth,
 * aber operatingCash / availableCash je nach Konto-Einstufung.
 *
 * Entweder einmalig (`date`) oder wiederkehrend (`cadence` + `anchorDate`,
 * z. B. eine monatliche Sparrate vom Giro aufs Tagesgeld).
 */
export interface ForecastTransfer {
  id: string;
  name?: string;
  /** Positiver Betrag, der von `fromAccountId` nach `toAccountId` fließt. */
  amount: number;
  fromAccountId: string;
  toAccountId: string;
  /** Einmaliger Transfer an diesem Datum (ISO yyyy-mm-dd). */
  date?: string;
  /** Wiederkehrender Transfer (alternativ zu `date`). */
  cadence?: RecurringCadence;
  anchorDate?: string;
  intervalDays?: number;
  startDate?: string;
  endDate?: string;
}

/**
 * Wochentags-Tagesprofil für die Verteilung einer Monatsbaseline.
 * Index = `getDay()` (0 = Sonntag … 6 = Samstag), auf Mittel 1.0 normiert
 * (Summe = 7). Neutral = alle 1 (entspricht der Linearverteilung).
 */
export interface DailySpendingProfile {
  weekdayWeights: number[];
}

/**
 * Occurrence-Amount-Modell (PR 3) für spiky variable Buchungslinien. Trennt
 * „tritt an einem Tag eine Ausgabe auf?" (Wochentags-Wahrscheinlichkeit) von
 * „wie hoch ist sie?" (Streuung). Speist nur den Monte-Carlo-Pfad – der
 * deterministische Pfad bleibt das geglättete Tagesprofil.
 */
export interface OccurrenceModel {
  /** P(Ausgabetag | Wochentag), Index = `getDay()` (0 = So … 6 = Sa), je 0..1. */
  weekdayProb: number[];
  /** Variationskoeffizient der Ereignisbeträge (lognormale Streuung). */
  amountCv: number;
}

/**
 * Variable Ausgaben-Baseline pro Kategorie. Wird getrennt von wiederkehrenden
 * Zahlungen behandelt und in PR1 gleichmäßig über die Tage des Monats verteilt.
 */
export interface VariableExpenseBaseline {
  category: string;
  /** Erwartete Ausgabe pro Monat (positive Zahl). */
  monthlyAmount: number;
  /** Erkennungsqualität 0..1 (Metadatum). */
  confidence?: number;
  /**
   * Variationskoeffizient der monatlichen Ausgaben (Streuung / Mittelwert) aus
   * der Historie. 0 = konstant. Treibt die Monte-Carlo-Streuung (Stufe 4).
   */
  volatility?: number;
  /**
   * Budget-Override: ersetzt – falls gesetzt – die historische Baseline als
   * Planwert (Budget-Semantik, *nicht* min(history, budget)).
   */
  budgetOverride?: number;
  /**
   * Optionaler Monatsplan (yyyy-MM -> Betrag). Monte Carlo nutzt ihn, damit
   * reale Monatsschwankungen nicht als ein dauerhaft hohes/niedriges Niveau
   * über den gesamten Horizont missverstanden werden.
   */
  monthlyAmounts?: Record<string, number>;
  /**
   * Optionales Wochentags-Tagesprofil (PR 2). Verteilt den Monatsbetrag
   * profilgewichtet statt linear – nur wirksam, wenn `ForecastConfig.useDailyProfile`
   * gesetzt ist. Ohne Profil bleibt die bisherige Linearverteilung.
   */
  dailyProfile?: DailySpendingProfile;
  /**
   * Optionales Occurrence-Amount-Modell (PR 3) für realistische Spikes im
   * Monte-Carlo-Pfad. Nur wirksam bei `MonteCarloConfig.occurrenceSampling`.
   */
  occurrenceModel?: OccurrenceModel;
}

/** Einmaliger geplanter Posten (Urlaub, Steuererstattung, Anschaffung …). */
export interface PlannedForecastEvent {
  id: string;
  name: string;
  /** Signierter Betrag (positiv = Zufluss, negativ = Abfluss). */
  amount: number;
  date: string;
  accountId: string;
  category?: string;
}

/**
 * Rücklage (Sinking Fund) für eine bekannte, aber unregelmäßige Großausgabe
 * (Jahresversicherung, Urlaub, Kfz-Steuer …). Statt die Zahlung in einem Monat
 * zu stemmen, wird sie über monatliche Beiträge angespart.
 *
 * Die Engine expandiert die Rücklage in monatliche Transfers (vom operativen
 * Konto auf das Reservekonto) und – falls gewünscht – die Großausgabe als
 * Einmalposten am Fälligkeitstag.
 */
export interface SinkingFund {
  id: string;
  name: string;
  /** Zielbetrag der anzusparenden Ausgabe. */
  targetAmount: number;
  /** Fälligkeit der Großausgabe (ISO yyyy-mm-dd). */
  dueDate: string;
  /** Bereits zurückgelegter Betrag. Default 0. */
  currentSaved?: number;
  /** Reservekonto, auf dem angespart wird. */
  accountId: string;
  /** Operatives Konto, von dem die Beiträge fließen. Default: erstes Giro. */
  fundedFromAccountId?: string;
  /** Buche die Großausgabe am Fälligkeitstag als Abfluss. Default true. */
  bookExpenseAtDue?: boolean;
  category?: string;
}

/** Gesamteingabe der Engine – idealerweise auto-seeded aus echten Services. */
export interface ForecastInput {
  accounts: ForecastAccount[];
  /** Aktive Flows für die Prognose-Engine (ohne disabled-Flows). */
  recurringFlows?: RecurringFlow[];
  /**
   * Alle erkannten Flows inkl. deaktivierter (ended, rejected, paused, stale,
   * nutzerseitig abgehakt). Nur für die UI – die Engine nutzt `recurringFlows`.
   */
  allRecurringFlows?: RecurringFlow[];
  transfers?: ForecastTransfer[];
  variableExpenses?: VariableExpenseBaseline[];
  plannedEvents?: PlannedForecastEvent[];
  sinkingFunds?: SinkingFund[];
}

/** Auf welche Cash-Sicht sich der Sicherheitspuffer bezieht. */
export type BufferBasis = 'operating' | 'available';

/** Konfiguration des Forecast-Laufs. */
export interface ForecastConfig {
  /** Startdatum (ISO yyyy-mm-dd). Default: heute. */
  startDate?: string;
  /** Horizont in Monaten. Default 6, Minimum 6. */
  months?: number;
  /** Mindest-Saldo, unter dem gewarnt wird. Default 0. */
  safetyBuffer?: number;
  /** Cash-Sicht für den Puffer. Default 'operating'. */
  bufferBasis?: BufferBasis;
  /**
   * Verteilt variable Ausgaben profilgewichtet (Wochentags-Tagesprofil) statt
   * linear. Default `false` (Abwärtskompatibilität); die App aktiviert es. Nur
   * Baselines mit `dailyProfile` sind betroffen, die Monatssumme bleibt exakt.
   */
  useDailyProfile?: boolean;
  /**
   * Jährlicher Dispozins in Prozent (z. B. 11 für 11 % p. a.). Wird monatlich
   * auf NEGATIVE operative Salden belastet – eine Überziehung kostet also Geld,
   * statt zinsfrei zu bleiben. Default 0 (abwärtskompatibel).
   */
  overdraftAnnualRate?: number;
}

/** Aufgelöste Konfiguration (alle Defaults gesetzt). */
export interface ResolvedForecastConfig {
  startDate: string;
  months: number;
  safetyBuffer: number;
  bufferBasis: BufferBasis;
  useDailyProfile: boolean;
  overdraftAnnualRate: number;
}

/** Ein tagesgenauer Punkt der Liquiditätsprojektion. */
export interface ForecastDailyPoint {
  date: string;
  /** Saldo je Konto am Tagesende. */
  accountBalances: Record<string, number>;
  operatingCash: number;
  availableCash: number;
  netWorth: number;
  /** Einnahmen aus wiederkehrenden Flows an diesem Tag. */
  inflows: number;
  /** Fixe Ausgaben (wiederkehrende Flows) an diesem Tag, als positive Zahl. */
  fixedExpenses: number;
  /** Variable Ausgaben (Baseline) an diesem Tag, als positive Zahl. */
  variableExpenses: number;
  /** Netto-Effekt geplanter Einmalposten an diesem Tag (signiert). */
  events: number;
  /** Netto-Zinsen an diesem Tag (Gutschrift minus Dispozins; kann negativ sein). */
  interest: number;
  /** Summe aller Abflüsse (fix + variabel) als positive Zahl. */
  outflows: number;
  /** In operative Konten transferiertes Geld an diesem Tag. */
  transfersIn: number;
  /** Aus operativen Konten transferiertes Geld an diesem Tag. */
  transfersOut: number;
  /** Veränderung des operatingCash gegenüber dem Vortag. */
  dailyDelta: number;
  /** Liegt die maßgebliche Cash-Sicht unter dem Sicherheitspuffer? */
  belowSafetyBuffer: boolean;
}

/** Monatszusammenfassung, abgeleitet aus der Tages-Timeline. */
export interface ForecastMonthlySummary {
  /** yyyy-mm */
  month: string;
  /** operatingCash zu Monatsbeginn. */
  openingBalance: number;
  income: number;
  fixedExpenses: number;
  variableExpenses: number;
  transfersIn: number;
  transfersOut: number;
  /** Netto-Summe geplanter Einmalposten im Monat. */
  events: number;
  /** Gutgeschriebene Zinsen im Monat. */
  interest: number;
  /** operatingCash zum Monatsende. */
  closingBalance: number;
  /** Niedrigster operatingCash-Stand im Monat (Monatstief). */
  lowestBalance: number;
  lowestBalanceDate: string;
  belowSafetyBuffer: boolean;
}

/** Aggregierte Liquiditätsrisiko-Kennzahlen über den gesamten Horizont. */
export interface LiquidityRisk {
  lowestBalance: number;
  lowestBalanceDate: string;
  firstBelowSafetyBufferDate: string | null;
  daysBelowSafetyBuffer: number;
  minimumOperatingCash: number;
  minimumAvailableCash: number;
  safetyBuffer: number;
}

/** Erklärbarer Hinweis (PR1: einfache Puffer-Insights). */
export interface ForecastInsight {
  kind: 'below_buffer' | 'ok';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  date?: string;
}

/** Gesamtergebnis eines deterministischen Forecast-Laufs. */
export interface ForecastResult {
  config: ResolvedForecastConfig;
  daily: ForecastDailyPoint[];
  monthly: ForecastMonthlySummary[];
  risk: LiquidityRisk;
  insights: ForecastInsight[];
}
