import type { Rhythmus } from "@/types";

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
  nextDateISO: string | null;
  changed: boolean;
  changeAmount: number;
  changeSinceLabel: string | null;
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
