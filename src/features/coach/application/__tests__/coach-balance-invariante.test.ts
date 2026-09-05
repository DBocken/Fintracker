/**
 * Die Invariante der beiden Zahlen auf der Coach-Fläche.
 *
 * Auf dem Gerät stand „frei bis Gehalt 3.162,69 €" über einem „Kontostand
 * 2.806,66 €" — mehr verfügbar als vorhanden. Beide Zahlen stimmten für sich:
 * Der Kontostand zählte ALLE Konten einschliesslich der Kreditkartenschuld
 * (−356,03 €), der freie Betrag nur die Zahlungskonten. Nebeneinander war es
 * eine Falschaussage.
 *
 * Der Fehler ist nicht in einer Rechnung, sondern zwischen zweien — und
 * deshalb prüft dieser Test nicht eine Zahl, sondern ihr **Verhältnis**: Was
 * bis zum Gehalt frei ist, kann nie mehr sein als das, was auf den
 * Zahlungskonten liegt. Die Differenz sind genau die Pflichten bis dahin.
 */

import { describe, it, expect } from 'vitest';
import { computeDisposableUntilPayday, istZahlungskonto } from '@/lib/disposable-budget';
import { accountTypeToKind } from '@/lib/forecast-flows';
import {
  computeEffectiveBalances,
  computeTotalEffectiveBalance,
} from '@/features/shared/domain/balance-calculations';
import type { Account, Transaction } from '@/types';

const KONTEN: Account[] = [
  { id: 'giro', name: 'Giro', type: 'checking', opening_balance: 3000, currency: 'EUR' },
  { id: 'bar', name: 'Bar', type: 'cash', opening_balance: 200, currency: 'EUR' },
  // Die Kreditkarte ist eine VERBINDLICHKEIT, kein Guthaben, von dem sich
  // heute etwas bezahlen lässt — genau der Posten, der den Widerspruch
  // erzeugt hat.
  { id: 'kk', name: 'Kreditkarte', type: 'credit_card', opening_balance: -356.03, currency: 'EUR' },
] as unknown as Account[];

const BUCHUNGEN: Transaction[] = [] as unknown as Transaction[];

describe('Kontostand und freier Betrag auf der Coach-Fläche', () => {
  it('sollte den Kontostand nur über Zahlungskonten bilden', () => {
    const zahlungskonten = KONTEN.filter((a) => istZahlungskonto(accountTypeToKind(a.type)));

    expect(zahlungskonten.map((a) => a.id)).toEqual(['giro', 'bar']);

    const saldo = computeTotalEffectiveBalance(
      zahlungskonten,
      computeEffectiveBalances(zahlungskonten, BUCHUNGEN),
    );
    expect(saldo).toBe(3200);
  });

  it('[REGRESSION] sollte nie mehr als frei ausweisen, als auf den Zahlungskonten liegt', () => {
    const zahlungskonten = KONTEN.filter((a) => istZahlungskonto(accountTypeToKind(a.type)));
    const saldo = computeTotalEffectiveBalance(
      zahlungskonten,
      computeEffectiveBalances(zahlungskonten, BUCHUNGEN),
    );

    const frei = computeDisposableUntilPayday({
      accounts: zahlungskonten.map((a) => ({
        id: a.id,
        name: a.name,
        kind: accountTypeToKind(a.type),
        openingBalance: a.opening_balance ?? 0,
      })),
      recurringFlows: [],
      fromISO: '2026-09-04',
      paydayISO: '2026-09-30',
      daysUntilPayday: 26,
    });

    // Ohne Pflichten sind beide gleich; mit Pflichten ist `frei` kleiner.
    // Grösser darf es NIE sein — das war der Befund.
    expect(frei.disposable).toBeLessThanOrEqual(saldo);
  });

  it('sollte die Kreditkartenschuld aus dem ausgebbaren Betrag heraushalten', () => {
    // Gegenprobe: Nähme man alle Konten, wäre der Saldo um die Schuld
    // KLEINER als der freie Betrag — genau die Falschaussage von vorher.
    const alle = computeTotalEffectiveBalance(KONTEN, computeEffectiveBalances(KONTEN, BUCHUNGEN));
    const zahlungskonten = KONTEN.filter((a) => istZahlungskonto(accountTypeToKind(a.type)));
    const nurZahlung = computeTotalEffectiveBalance(
      zahlungskonten,
      computeEffectiveBalances(zahlungskonten, BUCHUNGEN),
    );

    expect(alle).toBeLessThan(nurZahlung);
    expect(nurZahlung - alle).toBeCloseTo(356.03, 2);
  });
});
