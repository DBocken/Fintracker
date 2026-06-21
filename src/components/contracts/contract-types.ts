import type { Rhythmus } from "@/types";
import type { ContractStatus } from "@/services/contract-decision-service";

export type Cycle = "Wöchentlich" | "Monatlich" | "Vierteljährlich" | "Halbjährlich" | "Jährlich" | "Unbekannt";

export interface ContractRow {
  key: string;
  type: "Ausgabe" | "Einnahme";
  payee: string;
  categoryName: string;
  categoryId: string | null;
  amountTypical: number;
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
