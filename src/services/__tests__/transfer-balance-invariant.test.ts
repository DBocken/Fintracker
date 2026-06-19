/**
 * Transfer-Balance-Invarianten
 *
 * Ein interner Übertrag zwischen zwei eigenen Konten darf
 *   1. NICHT als Einnahme oder Ausgabe gewertet werden.
 *   2. den Gesamtvermögenssaldo (Summe aller Konten) nicht verändern.
 *
 * Die Tests dokumentieren das korrekte Verhalten und stellen sicher, dass
 * keine Regressionen auftreten.
 */

import { describe, it, expect } from 'vitest';
import type { Transaction } from '../../types';
import { excludeTransfers } from '../transaction-service';
import { planInternalTransfers, normalizeIban, type AccountIbanRef } from '../transfer-service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTx(overrides: Partial<Transaction>): Transaction {
  return {
    date: '2026-06-01',
    amount: 0,
    payee: 'Test',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: true,
    ...overrides,
  };
}

function sumIncome(transactions: Transaction[]): number {
  return excludeTransfers(transactions)
    .filter((t) => t.amount > 0)
    .reduce((s, t) => s + t.amount, 0);
}

function computeBalance(
  openingBalance: number,
  transactions: Transaction[],
  accountId: string,
): number {
  return (
    openingBalance +
    transactions
      .filter((t) => t.account_id === accountId)
      .reduce((s, t) => s + t.amount, 0)
  );
}

// ---------------------------------------------------------------------------
// Invariante 1: Einnahmen/Ausgaben
// ---------------------------------------------------------------------------

describe('excludeTransfers / Einnahmen-Invariante', () => {
  it('schließt als Übertrag markierte Transaktionen aus der Einnahmenrechnung aus', () => {
    const transactions: Transaction[] = [
      makeTx({ id: 'a', amount: 100, is_transfer: true }),
      makeTx({ id: 'b', amount: 200, is_transfer: false }),
    ];
    expect(sumIncome(transactions)).toBe(200); // 100 (transfer) wird nicht gezählt
  });

  it('schließt den Gegenbuchungs-Spiegel aus den Ausgaben aus', () => {
    const transactions: Transaction[] = [
      makeTx({ id: 'mirror', amount: -100, is_transfer: true }),
      makeTx({ id: 'expense', amount: -50, is_transfer: false }),
    ];
    const expenses = excludeTransfers(transactions)
      .filter((t) => t.amount < 0)
      .reduce((s, t) => s + Math.abs(t.amount), 0);
    expect(expenses).toBe(50); // -100 (Spiegelbuchung) wird nicht gezählt
  });

  it('nicht erkannter Übertrag taucht fälschlicherweise als Einnahme auf', () => {
    // Dieser Test dokumentiert das FEHLERHAFTE Verhalten, das auftritt, wenn
    // is_transfer noch nicht gesetzt wurde – als Regressionsschutz.
    const transactions: Transaction[] = [
      makeTx({ id: 'unrecognized', amount: 100, is_transfer: false }),
    ];
    // Ohne Erkennung: 100 erscheint als Einnahme (falsch!)
    expect(sumIncome(transactions)).toBe(100);
  });

  it('erkannter Übertrag erscheint nicht als Einnahme', () => {
    const transactions: Transaction[] = [
      makeTx({ id: 'giro-in', amount: 100, is_transfer: true }),
      makeTx({ id: 'tagesgeld-mirror', amount: -100, is_transfer: true }),
    ];
    expect(sumIncome(transactions)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Invariante 2: Gesamtvermögen
// ---------------------------------------------------------------------------

describe('Gesamtvermögens-Invariante', () => {
  const GIRO_OPENING = 500;
  const TAGESGELD_OPENING = 1000;

  it('Gesamtsaldo bleibt nach Erkennung eines internen Übertrags unverändert', () => {
    // Vor dem Übertrag: Summe = 1500
    // Nach dem Übertrag mit Spiegelbuchung (beide als is_transfer markiert):
    //   Girokonto: 500 + 100 = 600
    //   Tagesgeld: 1000 + (–100) = 900
    //   Gesamt: 1500  ← unverändert ✓
    const transactions: Transaction[] = [
      makeTx({ id: 'giro-in', account_id: 'giro', amount: 100, is_transfer: true }),
      makeTx({ id: 'tagesgeld-mirror', account_id: 'tagesgeld', amount: -100, is_transfer: true }),
    ];

    const total =
      computeBalance(GIRO_OPENING, transactions, 'giro') +
      computeBalance(TAGESGELD_OPENING, transactions, 'tagesgeld');

    expect(total).toBe(GIRO_OPENING + TAGESGELD_OPENING); // 1500
  });

  it('nicht erkannter Übertrag bläht Gesamtsaldo künstlich auf', () => {
    // Tagesgeld verliert 100, aber ohne Spiegelbuchung → Tagesgeld-Saldo unverändert.
    // GoCardless-Buchung +100 auf Giro zählt trotzdem zur Gesamtsumme.
    // → Gesamtsaldo = 1600 statt 1500 (falsch!)
    const transactions: Transaction[] = [
      makeTx({ id: 'giro-in', account_id: 'giro', amount: 100, is_transfer: false }),
      // Kein Tagesgeld-Eintrag
    ];

    const total =
      computeBalance(GIRO_OPENING, transactions, 'giro') +
      computeBalance(TAGESGELD_OPENING, transactions, 'tagesgeld');

    // Dokumentiert den Fehlerfall: Saldo ist 100 zu hoch
    expect(total).toBe(GIRO_OPENING + TAGESGELD_OPENING + 100);
  });
});

// ---------------------------------------------------------------------------
// Invariante 3: planInternalTransfers – rückwirkende Erkennung
// ---------------------------------------------------------------------------

describe('planInternalTransfers – rückwirkende Erkennung für den gesamten Bestand', () => {
  const GIRO_IBAN = 'DE11111111111111111111';
  const TAGESGELD_IBAN = 'DE22222222222222222222';

  const accounts: AccountIbanRef[] = [
    { id: 'giro', iban: GIRO_IBAN, isLive: true },
    { id: 'tagesgeld', iban: TAGESGELD_IBAN, isLive: false },
  ];

  it('erkennt eine bereits im Bestand liegende GoCardless-Buchung anhand der Gegenkonto-IBAN', () => {
    // Girokonto-Buchung wurde zu einem früheren Zeitpunkt importiert,
    // Tagesgeld-IBAN wurde erst nachträglich am Konto hinterlegt.
    // reconcileAllInternalTransfers übergibt den gesamten Bestand als Quelle.
    const giroBuchung = makeTx({
      id: 'giro-alt',
      account_id: 'giro',
      amount: 200,
      date: '2026-05-15',
      counterparty_iban: TAGESGELD_IBAN,
    });

    const plans = planInternalTransfers([giroBuchung], [giroBuchung], accounts);
    expect(plans).toHaveLength(1);
    expect(plans[0].source.id).toBe('giro-alt');
    expect(plans[0].counterAccountId).toBe('tagesgeld');
    // Keine vorhandene Gegenbuchung → Spiegelbuchung muss angelegt werden
    expect(plans[0].existingCounterpart).toBeUndefined();
  });

  it('verknüpft eine vorhandene Tagesgeld-CSV-Buchung statt eine Spiegelbuchung anzulegen', () => {
    const giroBuchung = makeTx({
      id: 'giro-alt',
      account_id: 'giro',
      amount: 200,
      date: '2026-05-15',
      counterparty_iban: TAGESGELD_IBAN,
    });
    const csvBuchung = makeTx({
      id: 'tagesgeld-csv',
      account_id: 'tagesgeld',
      amount: -200,
      date: '2026-05-14',
    });
    const all = [giroBuchung, csvBuchung];

    const plans = planInternalTransfers(all, all, accounts);
    expect(plans).toHaveLength(1);
    expect(plans[0].existingCounterpart?.id).toBe('tagesgeld-csv');
  });

  it('liefert keinen Plan, wenn kein IBAN am Konto hinterlegt ist', () => {
    // Ohne IBAN am Tagesgeldkonto kann keine IBAN-basierte Erkennung stattfinden.
    const accountsOhneIban: AccountIbanRef[] = [
      { id: 'giro', iban: GIRO_IBAN, isLive: true },
      { id: 'tagesgeld', iban: null, isLive: false }, // IBAN fehlt!
    ];

    const giroBuchung = makeTx({
      id: 'giro-alt',
      account_id: 'giro',
      amount: 200,
      date: '2026-05-15',
      counterparty_iban: TAGESGELD_IBAN,
    });

    const plans = planInternalTransfers([giroBuchung], [giroBuchung], accountsOhneIban);
    // Kein IBAN-Match möglich → kein Plan → Buchung bleibt als Einnahme sichtbar
    expect(plans).toHaveLength(0);
  });

  it('liefert keinen Plan, wenn die GoCardless-Buchung keine counterparty_iban enthält', () => {
    // Manche Banken liefern keine IBAN über die GoCardless-API.
    // In diesem Fall ist keine automatische IBAN-Erkennung möglich.
    const giroBuchung = makeTx({
      id: 'giro-alt',
      account_id: 'giro',
      amount: 200,
      date: '2026-05-15',
      counterparty_iban: null, // Bank liefert keine IBAN
    });

    const plans = planInternalTransfers([giroBuchung], [giroBuchung], accounts);
    expect(plans).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Invariante 4: normalizeIban
// ---------------------------------------------------------------------------

describe('normalizeIban – IBAN-Vergleich', () => {
  it('Leerzeichen und Groß-/Kleinschreibung werden normalisiert', () => {
    expect(normalizeIban('de89 3704 0044 0532 0130 00')).toBe(normalizeIban('DE89370400440532013000'));
  });

  it('gibt null zurück, wenn keine IBAN vorhanden', () => {
    expect(normalizeIban(null)).toBeNull();
    expect(normalizeIban(undefined)).toBeNull();
    expect(normalizeIban('')).toBeNull();
  });
});
