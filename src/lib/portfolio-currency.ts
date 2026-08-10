/**
 * Währungsgrenze der Depot-Rechnung (VE-1, `docs/architecture/currency-eur-only.md`).
 *
 * Fintracker rechnet in Euro und hat **keine** Kursquelle: kein Tageskurs, keine
 * Kurshistorie, kein persistierter Umrechnungskurs je Buchung. Daraus folgt eine
 * einzige Regel, und dieses Modul ist ihre gemeinsame Quelle: **Nur gleiche
 * Währungen werden addiert. Alles andere wird benannt, nie umgerechnet und nie
 * stumm mitsummiert.**
 *
 * Zwei Ebenen, weil zwei verschiedene Fragen:
 *
 * 1. *Innerhalb* eines Depots ist die Depotwährung die Rechenwährung — ein
 *    eToro-Depot führt in USD und zeigt seine Kennzahlen ehrlich in USD
 *    (`getPortfolioSummary`).
 * 2. *Im Nettovermögen* ist die Rechenwährung immer {@link ACCOUNTING_CURRENCY}.
 *    Dort zählt nur, was in Euro notiert — auch die EUR-Position eines
 *    USD-Depots ({@link eurContribution}).
 *
 * Reine Funktionen ohne I/O — deshalb `src/lib/`, obwohl heute nur Services sie
 * rufen (AGENTS.md §3, „Wohin ein Typ gehört").
 */
import type { PortfolioSummary } from './portfolio-types';

/** Die einzige Rechenwährung der App. Kein Umrechnungspfad führt an ihr vorbei. */
export const ACCOUNTING_CURRENCY = 'EUR';

/**
 * Gleiche Währung? Groß-/Kleinschreibung und Leerraum sind Schreibweisen, keine
 * Fachunterschiede — Importquellen liefern „eur" wie „EUR".
 *
 * Eine **fehlende** Angabe gilt als die Bezugswährung: Bestandszeilen aus der
 * Zeit vor dem Währungsfeld wurden unter der Depotwährung angelegt. Sie
 * nachträglich als Fremdwährung auszubuchen wäre die zweite Falschaussage nach
 * der ersten.
 */
export function isSameCurrency(currency: string | undefined | null, reference: string): boolean {
  const normalized = (currency || '').trim().toUpperCase();
  if (normalized === '') return true;
  return normalized === reference.trim().toUpperCase();
}

/** Ein Fremdwährungsbestand, gebündelt nach Währung — Anzeige, nie Summand. */
export interface UnconvertedHolding {
  currency: string;
  /** Marktwert in `currency`. */
  value: number;
  positionsCount: number;
}

/** Was ein Depot zum Euro-Vermögen beiträgt — und was ausdrücklich nicht. */
export interface EurContribution {
  /** Anteil in Euro. Nur dieser Wert darf ins Nettovermögen. */
  eurValue: number;
  /** Anzahl der Positionen hinter `eurValue`. */
  eurPositionsCount: number;
  /** Der Rest, nach Währung gebündelt. */
  unconverted: UnconvertedHolding[];
}

/**
 * Zerlegt eine Depot-Kennzahl in den Euro-Anteil und den Rest.
 *
 * Der Fall, der die Sorgfalt verlangt, ist das Depot in Fremdwährung: Seine
 * Summe ist in sich richtig, aber sie ist kein Euro-Betrag — sie wandert
 * vollständig in `unconverted`. Umgekehrt zählt eine EUR-Position IN einem
 * USD-Depot sehr wohl zum Vermögen: Sie ist bereits Euro, sie war im Depot nur
 * die währungsfremde.
 */
export function eurContribution(summary: PortfolioSummary): EurContribution {
  const byCurrency = new Map<string, UnconvertedHolding>();
  const addUnconverted = (currency: string, value: number, positionsCount: number) => {
    const key = currency.trim().toUpperCase();
    const existing = byCurrency.get(key);
    if (existing) {
      existing.value += value;
      existing.positionsCount += positionsCount;
      return;
    }
    byCurrency.set(key, { currency: key, value, positionsCount });
  };

  const convertedCount = summary.positions_count - summary.unconverted_positions.length;
  let eurValue = 0;
  let eurPositionsCount = 0;

  if (isSameCurrency(summary.currency, ACCOUNTING_CURRENCY)) {
    eurValue = summary.total_value;
    eurPositionsCount = convertedCount;
  } else if (convertedCount > 0 || summary.total_value !== 0) {
    addUnconverted(summary.currency, summary.total_value, convertedCount);
  }

  for (const position of summary.unconverted_positions) {
    if (isSameCurrency(position.currency, ACCOUNTING_CURRENCY)) {
      eurValue += position.value;
      eurPositionsCount += 1;
    } else {
      addUnconverted(position.currency, position.value, 1);
    }
  }

  return { eurValue, eurPositionsCount, unconverted: [...byCurrency.values()] };
}
