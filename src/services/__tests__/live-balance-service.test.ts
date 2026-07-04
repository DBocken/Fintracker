import { describe, it, expect } from "vitest";
import { pickPreferredBankBalance } from "../live-balance-service";

// Der Parametertyp (GoCardlessBalance) ist bewusst nicht exportiert –
// wir leiten ihn aus der Funktionssignatur ab, statt ihn zu duplizieren.
type Balances = NonNullable<Parameters<typeof pickPreferredBankBalance>[0]>;
type Balance = Balances[number];

function bal(balanceType: string, amount = "10.00"): Balance {
  return {
    balanceAmount: { amount, currency: "EUR" },
    balanceType,
  } as Balance;
}

describe("pickPreferredBankBalance (geldkritische Saldo-Priorität)", () => {
  describe("Normal Behavior", () => {
    it("sollte closingBooked bevorzugen, wenn alle Typen vorhanden sind", () => {
      const balances = [
        bal("interimBooked", "1.00"),
        bal("interimAvailable", "2.00"),
        bal("closingBooked", "3.00"),
        bal("expected", "4.00"),
      ];
      expect(pickPreferredBankBalance(balances)?.balanceAmount.amount).toBe("3.00");
    });

    it("sollte interimAvailable wählen, wenn kein closingBooked existiert", () => {
      const balances = [
        bal("interimBooked", "1.00"),
        bal("expected", "4.00"),
        bal("interimAvailable", "2.00"),
      ];
      expect(pickPreferredBankBalance(balances)?.balanceAmount.amount).toBe("2.00");
    });

    it("sollte interimBooked wählen, wenn weder closingBooked noch interimAvailable existieren", () => {
      const balances = [bal("expected", "4.00"), bal("interimBooked", "1.00")];
      expect(pickPreferredBankBalance(balances)?.balanceAmount.amount).toBe("1.00");
    });

    it("sollte expected vor unbekannten Typen bevorzugen", () => {
      const balances = [bal("someBankSpecificType", "9.00"), bal("expected", "4.00")];
      expect(pickPreferredBankBalance(balances)?.balanceAmount.amount).toBe("4.00");
    });

    it("sollte bei genau einem Eintrag diesen zurückgeben", () => {
      const only = bal("closingBooked", "42.42");
      expect(pickPreferredBankBalance([only])).toBe(only);
    });
  });

  describe("Edge Cases", () => {
    it("sollte bei leerer Liste null liefern", () => {
      expect(pickPreferredBankBalance([])).toBeNull();
    });

    it("sollte bei undefined null liefern", () => {
      expect(pickPreferredBankBalance(undefined)).toBeNull();
    });

    it("sollte bei ausschließlich unbekannten Typen auf den ersten Eintrag zurückfallen", () => {
      const balances = [bal("weirdType", "7.77"), bal("otherWeirdType", "8.88")];
      expect(pickPreferredBankBalance(balances)?.balanceAmount.amount).toBe("7.77");
    });

    it("sollte Whitespace im balanceType normalisieren und trotzdem matchen", () => {
      const balances = [bal("interimBooked", "1.00"), bal("  closingBooked  ", "3.00")];
      expect(pickPreferredBankBalance(balances)?.balanceAmount.amount).toBe("3.00");
    });
  });
});
