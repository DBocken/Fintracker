/**
 * Übersicht-Adapter der 3D-Finanzstadt (WP-D8, Übersicht-Tab): kombiniert die
 * bereits gebauten Einnahmen- und Ausgaben-Modelle zu EINER Platte —
 * Einnahmen-Viertel links, Ausgaben-Viertel rechts, dazwischen der
 * SPAR-TURM: ein einzelnes Gebäude in Höhe des Saldos (Einnahmen −
 * Ausgaben), Gold bei Überschuss, Rot bei Defizit. Eine Hauptaussage pro
 * Ansicht (AGENTS.md §4): „Wie stehen Einnahmen und Ausgaben zueinander —
 * und was bleibt übrig?" Der Drilldown passiert in den jeweiligen Tabs
 * (die Page springt beim Eintauchen in ein Viertel dorthin um).
 *
 * Reine Funktion ohne React/three.js (README-Architekturtabelle, `domain/`).
 * Der Saldo wird aus den ANGEZEIGTEN Distrikt-Totalen beider Seiten
 * berechnet (Integer-Cent via `toMinor`/`sumMinor`, AGENTS.md §8) — die
 * Platte ist damit in sich konsistent: Turmhöhe == links minus rechts.
 */

import { t } from '@/i18n/serviceT';
import { toMinor, toMajor, sumMinor } from '@/lib/money';
import type { CityDistrict, CityModel } from './city-model';

/** Saldo-Turm: Gold bei Überschuss (Sparrate) … */
const BALANCE_SURPLUS_COLOR = '#f0b429';
/** … Rot bei Defizit (mehr ausgegeben als eingenommen). */
const BALANCE_DEFICIT_COLOR = '#ef4444';

export const OVERVIEW_BALANCE_DISTRICT_ID = 'overview:balance';

export type CityOverviewInfo = {
  /** Distrikt-Ids der Einnahmen-Seite — die Page erkennt daran, in welche Welt ein Tap springt. */
  incomeDistrictIds: string[];
  /** Anzeige-Euro (Summe der Einnahmen-Distrikte). */
  incomeTotal: number;
  /** Anzeige-Euro (Summe der Ausgaben-Distrikte). */
  expensesTotal: number;
  /** Saldo (Einnahmen − Ausgaben), kann negativ sein. */
  balance: number;
};

export type CityOverviewResult = { model: CityModel; info: CityOverviewInfo };

function sideCopy(district: CityDistrict, side: 'left' | 'right'): CityDistrict {
  // Distrikt-Ids bleiben UNVERÄNDERT (identisch zu den Welt-Modellen) — der
  // Welt-Sprung der Page fokussiert nach dem Tab-Wechsel dieselbe Id.
  return { ...district, side };
}

/**
 * Baut das Übersicht-Modell aus den beiden Welt-Modellen. Ist eine Seite
 * leer, erscheint nur die andere (plus Turm, sofern es etwas zu bilanzieren
 * gibt); sind beide leer, ist das Modell leer (Empty-State der Page).
 */
export function buildCityOverviewModel(expenses: CityModel, income: CityModel): CityOverviewResult {
  const incomeTotalMinor = sumMinor(income.districts.map((d) => toMinor(d.total)));
  const expensesTotalMinor = sumMinor(expenses.districts.map((d) => toMinor(d.total)));
  const balanceMinor = incomeTotalMinor - expensesTotalMinor;

  const districts: CityDistrict[] = [
    ...income.districts.map((d) => sideCopy(d, 'left')),
    ...expenses.districts.map((d) => sideCopy(d, 'right')),
  ];

  // Turm nur, wenn überhaupt etwas bilanziert wird (mindestens eine Seite
  // nicht leer) UND der Saldo nicht exakt 0 ist (ein Null-Turm wäre eine
  // unsichtbare, aber pickbare Box).
  if (districts.length > 0 && balanceMinor !== 0) {
    const surplus = balanceMinor > 0;
    const label = surplus ? t('financeCity.balanceSurplus', 'Sparrate') : t('financeCity.balanceDeficit', 'Defizit');
    const amount = toMajor(Math.abs(balanceMinor));
    districts.splice(income.districts.length, 0, {
      id: OVERVIEW_BALANCE_DISTRICT_ID,
      label,
      color: surplus ? BALANCE_SURPLUS_COLOR : BALANCE_DEFICIT_COLOR,
      total: amount,
      side: 'center',
      subcategories: [{ id: 'balance', label, amount }],
    });
  }

  return {
    model: {
      districts,
      // Anteils-Prozente wären hier irreführend (Bezugsgröße „Gesamt" mischte
      // Einnahmen + Ausgaben + Saldo) — Labels zeigen nur Name + Betrag.
      hideShares: true,
    },
    info: {
      incomeDistrictIds: income.districts.map((d) => d.id),
      incomeTotal: toMajor(incomeTotalMinor),
      expensesTotal: toMajor(expensesTotalMinor),
      balance: toMajor(balanceMinor),
    },
  };
}
