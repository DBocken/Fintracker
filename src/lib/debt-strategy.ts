import type { PayoffStrategy } from "@/services/debt-service";

/**
 * Avalanche/Schneeball ist eine Portfolio-Strategie (#54, Korrektur 2):
 * Sie wird einmal global gewählt und gilt für alle Schulden — kein Label
 * pro Einzelschuld. Die Wahl wird lokal persistiert.
 */

const STORAGE_KEY = "fintracker_debt_strategy";

export function getDebtStrategy(): PayoffStrategy {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === "snowball" || raw === "avalanche" ? raw : "avalanche";
  } catch {
    return "avalanche";
  }
}

export function setDebtStrategy(strategy: PayoffStrategy) {
  try {
    localStorage.setItem(STORAGE_KEY, strategy);
  } catch {
    // localStorage nicht verfügbar (z. B. Privacy-Modus) — Wahl gilt nur für die Sitzung
  }
}
