/**
 * WP-7.4 — Der Erfolgsmoment „Schuldenfrei", angebunden an die App.
 *
 * Die Regeln stehen rein in `@/lib/debt-freedom`; hier kommt nur das
 * Gedächtnis dazu. Es liegt in `localStorage` und nicht in IndexedDB: Es ist
 * kein Finanzdatum, sondern eine Anzeige-Notiz („diesen Moment hatten wir
 * schon"). Geht sie verloren, wird einmal zu viel gefeiert — verglichen mit
 * dem Aufwand einer Migration ist das der bessere Handel.
 */

import { useEffect, useState } from 'react';
import {
  evaluateDebtFreedom,
  INITIAL_DEBT_FREEDOM_MEMORY,
  type DebtFreedomMemory,
} from '@/lib/debt-freedom';

const STORAGE_KEY = 'fintracker_debt_freedom_v1';

function readMemory(): DebtFreedomMemory {
  if (typeof window === 'undefined') return INITIAL_DEBT_FREEDOM_MEMORY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return INITIAL_DEBT_FREEDOM_MEMORY;
    const parsed = JSON.parse(raw) as Partial<DebtFreedomMemory>;
    // Bewusst Feld für Feld statt Spread: ein manipulierter oder veralteter
    // Eintrag soll keine unbekannten Felder in den Zustand tragen.
    return {
      everHadDebt: parsed.everHadDebt === true,
      celebrated: parsed.celebrated === true,
    };
  } catch {
    // Defektes JSON darf die Schulden-Seite nicht am Rendern hindern.
    return INITIAL_DEBT_FREEDOM_MEMORY;
  }
}

function writeMemory(memory: DebtFreedomMemory): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    // Privater Modus / voller Speicher: dann wird eben erneut gefeiert.
  }
}

/**
 * Meldet, ob der Erfolgsmoment jetzt gezeigt werden soll.
 *
 * `isLoading` verhindert den entscheidenden Fehlalarm: Solange die Schulden
 * noch laden, ist die Summe 0 — ohne diese Sperre feierte die App jeden
 * Seitenaufruf, bevor die Daten überhaupt da sind.
 */
export function useDebtFreedom(totalDebt: number, isLoading: boolean): boolean {
  const [celebrating, setCelebrating] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    const result = evaluateDebtFreedom(totalDebt, readMemory());
    writeMemory(result.memory);
    if (result.shouldCelebrate) setCelebrating(true);
  }, [totalDebt, isLoading]);

  return celebrating;
}
