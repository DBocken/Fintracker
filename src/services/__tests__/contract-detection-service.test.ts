import { describe, expect, it, vi } from "vitest";
import type { Transaction } from "../../types";

// `findSimilarContractTransactions` ist rein, aber das Modul zieht beim Import
// `transaction-service` (IndexedDB) mit. Der Mock haelt den Import trocken.
vi.mock("../transaction-service", () => ({
  getAllTransactions: vi.fn(() => Promise.resolve([])),
  getCategories: vi.fn(() => Promise.resolve([])),
  updateTransaction: vi.fn(() => Promise.resolve()),
}));

import { findSimilarContractTransactions } from "../contract-detection-service";
import { asTransactionId } from '@/lib/ids';

function tx(overrides: Omit<Partial<Transaction>, 'id'> & { id?: string }): Transaction {
  return {
    date: "2026-01-15",
    amount: -10,
    payee: "Test",
    description: "",
    original_text: "",
    auto_mapped: false,
    confirmed: false,
    is_transfer: false,
    account_id: "acc-1",
    ...overrides,
    // `id`: ausdrueckliches `id: undefined` MUSS undefined bleiben (WP 5.2b).
    // Vor dem Brand stand die Vorgabe VOR dem Spread, ein `undefined` aus
    // den Overrides hat sie also ueberschrieben. Nur das FEHLEN des
    // Schluessels faellt auf die Vorgabe zurueck.
    id: 'id' in overrides
      ? (overrides.id === undefined ? undefined : asTransactionId(overrides.id))
      : asTransactionId(crypto.randomUUID()),
  };
}

describe("findSimilarContractTransactions", () => {
  it("matcht gleichen Payee und gleichen Betrag", () => {
    const txns = [
      tx({ id: "a", payee: "Netflix", amount: -9.99 }),
      tx({ id: "b", payee: "Netflix", amount: -9.99 }),
      tx({ id: "c", payee: "Spotify", amount: -9.99 }),
    ];
    const result = findSimilarContractTransactions(txns, { payee: "Netflix", amount: -9.99 });
    expect(result.map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("matcht innerhalb der Betrags-Toleranz (Preiserhöhung)", () => {
    const txns = [
      tx({ id: "a", payee: "Internet", amount: -49.99 }),
      tx({ id: "b", payee: "Internet", amount: -54.99 }), // ~10% mehr
    ];
    const result = findSimilarContractTransactions(txns, { payee: "Internet", amount: -49.99 });
    expect(result.map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("ignoriert stark abweichende Beträge (einmalige Sonderzahlung)", () => {
    const txns = [
      tx({ id: "a", payee: "Strom", amount: -50 }),
      tx({ id: "b", payee: "Strom", amount: -500 }), // Nachzahlung
    ];
    const result = findSimilarContractTransactions(txns, { payee: "Strom", amount: -50 });
    expect(result.map((t) => t.id)).toEqual(["a"]);
  });

  it("trennt Einnahmen und Ausgaben (gleiche Richtung verlangt)", () => {
    const txns = [
      tx({ id: "a", payee: "Firma", amount: 100 }),
      tx({ id: "b", payee: "Firma", amount: -100 }),
    ];
    const result = findSimilarContractTransactions(txns, { payee: "Firma", amount: 100 });
    expect(result.map((t) => t.id)).toEqual(["a"]);
  });

  it("ignoriert Transfers", () => {
    const txns = [
      tx({ id: "a", payee: "Bank", amount: -100, is_transfer: true }),
      tx({ id: "b", payee: "Bank", amount: -100 }),
    ];
    const result = findSimilarContractTransactions(txns, { payee: "Bank", amount: -100 });
    expect(result.map((t) => t.id)).toEqual(["b"]);
  });
});
