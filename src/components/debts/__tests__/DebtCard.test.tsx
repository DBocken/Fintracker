import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DebtCard } from "../DebtCard";
import type { Debt } from "@/types";

function makeDebt(overrides: Partial<Debt> = {}): Debt {
  return {
    id: "debt-1",
    user_id: "u1",
    name: "Visa-Karte",
    type: "credit_card",
    balance: 1200,
    original_amount: 2000,
    interest_rate: 19.9,
    min_payment: 50,
    is_bnpl: false,
    is_paid_off: false,
    ...overrides,
  };
}

describe("DebtCard", () => {
  describe("Regression Protection", () => {
    it("[REGRESSION] sollte ein vollflächiges Klick-Ziel haben, das die Details öffnet", async () => {
      // Die ganze Karte ist klickbar: ein Button über die gesamte Fläche
      // (aria-label „Details zu …") öffnet die Detailansicht.
      const onOpenDetails = vi.fn();
      render(
        <DebtCard debt={makeDebt()} onTogglePaid={() => {}} onOpenDetails={onOpenDetails} />,
      );
      await userEvent.click(screen.getByRole("button", { name: "Details zu Visa-Karte" }));
      expect(onOpenDetails).toHaveBeenCalledTimes(1);
    });

    it("[REGRESSION] sollte die Sekundaeraktion 'Bezahlt markieren' ohne Details-Oeffnen ausloesen", async () => {
      const onOpenDetails = vi.fn();
      const onTogglePaid = vi.fn();
      render(
        <DebtCard debt={makeDebt()} onTogglePaid={onTogglePaid} onOpenDetails={onOpenDetails} />,
      );
      await userEvent.click(screen.getByRole("button", { name: /bezahlt markieren/i }));
      expect(onTogglePaid).toHaveBeenCalledTimes(1);
      // Sekundäraktion darf NICHT zusätzlich die Detailansicht öffnen.
      expect(onOpenDetails).not.toHaveBeenCalled();
    });
  });
});
