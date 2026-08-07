/**
 * Fachliche Typen rund um wiederkehrende Zahlungen („Verträge").
 *
 * Diese Datei liegt bewusst in `src/lib/`: Verträge sind Domäne, nicht
 * Darstellung und nicht Speicherung. `ContractRow` lag zuvor unter
 * `components/contracts/`, `ContractStatus`/`ContractDecision` im
 * IndexedDB-Service — beides zwang die reine Ableitungslogik
 * (`contract-derivation.ts`, `forecast-data.ts`) dazu, entgegen der
 * Schichtrichtung nach oben zu importieren (AGENTS.md §3).
 */
import type { Rhythmus } from "@/types";

export type Cycle = "Wöchentlich" | "Monatlich" | "Vierteljährlich" | "Halbjährlich" | "Jährlich" | "Unbekannt";

/**
 * Dauerhafte Vertrags-Entscheidung des Nutzers, gebunden an einen normalisierten
 * Händler-Fingerprint (siehe lib/merchant-fingerprint). Verträge selbst werden aus
 * den Transaktionen abgeleitet; diese Entscheidung überschreibt nur den Status,
 * damit beendete/abgelehnte Verträge die aktuellen Fixkosten nicht verfälschen.
 */
export type ContractStatus =
  | 'candidate'
  | 'active'
  | 'ended'
  | 'rejected'
  | 'paused'
  | 'archived';

/** Persistierte Form einer Vertrags-Entscheidung (gespeichert über den Service). */
export interface ContractDecision {
  id: string;
  user_id: string;
  fingerprint: string;
  status: ContractStatus;
  cycle_override?: Rhythmus | null;
  ended_at?: string | null;
  note?: string | null;
  created_at?: string;
  updated_at?: string;
}

/** Abgeleitete Zeile einer wiederkehrenden Zahlung (Ergebnis von `computeContracts`). */
export interface ContractRow {
  key: string;
  type: "Ausgabe" | "Einnahme";
  payee: string;
  categoryName: string;
  categoryId: string | null;
  amountTypical: number;
  /** Robuster Median der letzten bis zu drei Buchungen für die aktuelle Planung. */
  amountRecentTypical?: number;
  amountLast: number;
  cycle: Cycle;
  lastDateISO: string;
  /** Datum der ersten erfassten Buchung dieser Familie. */
  firstDateISO: string;
  nextDateISO: string | null;
  changed: boolean;
  changeAmount: number;
  changeSinceLabel: string | null;
  /** True, wenn (mind. eine) zugehörige Transaktion als Vertrag markiert ist. */
  confirmed: boolean;
  /** IDs der Buchungen dieser wiederkehrenden Zahlung (für Confirm/Markierung). */
  transactionIds: string[];
  /** Normalisierter Händler-Fingerprint dieser Familie (Schlüssel für Entscheidungen). */
  fingerprint: string;
  /** Vom Nutzer/aus der Ableitung bestimmter Status. */
  status: ContractStatus;
  /** Letzte Buchung liegt länger als 2× Zyklus zurück – evtl. beendet. */
  stale: boolean;
  /** Zyklus konnte erkannt werden (sonst nicht in Jahreshochrechnung zwingen). */
  cycleKnown: boolean;
}

/** Bildet einen erkannten Zahlungs-Zyklus auf den Rhythmus von CategoryAttributes ab. */
export function mapCycleToRhythmus(cycle: Cycle): Rhythmus | null {
  switch (cycle) {
    case "Wöchentlich":
      return "weekly";
    case "Monatlich":
      return "monthly";
    case "Vierteljährlich":
      return "quarterly";
    case "Jährlich":
      return "yearly";
    default:
      return null;
  }
}
