import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Account, Budget, HierarchicalCategory } from "@/types";

// Die Premium-Sektion (adaptives Limit, Rollover, Regeln) liegt hinter einem
// FeatureGate (#133). Diese Suite prüft die Dialog-Logik unter der Annahme, dass
// die Sektion sichtbar ist – das Gating selbst ist in tier.gating-matrix.test.ts
// und FeatureGate.test.tsx abgedeckt. Daher hier FeatureGate → children.
vi.mock("@/components/FeatureGate", () => ({
  FeatureGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import BudgetFormDialog from "../BudgetFormDialog";

const CATEGORIES: HierarchicalCategory[] = [
  { id: "wohnen", name: "Wohnen", filters: [], icon: "🏠", children: [] },
];

const ACCOUNTS: Account[] = [
  { id: "acc-tg", name: "Tagesgeld", type: "savings", iban: "DE89370400440532013000" } as Account,
];

function setup(budget: Budget | null = null) {
  const onSave = vi.fn();
  render(
    <BudgetFormDialog
      open
      onOpenChange={() => {}}
      budget={budget}
      categories={CATEGORIES}
      accounts={ACCOUNTS}
      onSave={onSave}
    />,
  );
  return { onSave };
}

describe("BudgetFormDialog – Rollover & Adaptive", () => {
  it("sollte ohne Rollover keine rolloverConfig speichern", async () => {
    const { onSave } = setup({ id: "b1", name: "Wohnen", category_id: "wohnen", limit: 1000 } as Budget);
    await userEvent.click(screen.getByRole("button", { name: /speichern/i }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ rolloverConfig: undefined, adaptive: false }));
  });

  it("sollte ein vorhandenes Budget in die Steuerelemente laden", () => {
    setup({
      id: "b1",
      name: "Wohnen",
      category_id: "wohnen",
      limit: 1000,
      adaptive: true,
      rolloverConfig: { mode: "accumulate", cap: 200, surplusAction: "sweep_savings" },
    } as Budget);
    // Adaptiv aktiv → Limit-Label wechselt auf „Basislimit / Fallback".
    expect(screen.getByText(/Basislimit \/ Fallback/i)).toBeTruthy();
    // Cap-Feld nur sichtbar bei Ansparen/Beides und mit dem geladenen Wert.
    expect((screen.getByLabelText(/Max\. Übertrag/i) as HTMLInputElement).value).toBe("200");
  });

  it("[REGRESSION] sollte altes boolean rollover:true als 'accumulate' vorbelegen", () => {
    setup({ id: "b1", name: "Wohnen", category_id: "wohnen", limit: 1000, rollover: true } as Budget);
    // Surplus-Optionen sind nur bei accumulate/both sichtbar → ihr Erscheinen beweist die Migration.
    expect(screen.getByLabelText(/Max\. Übertrag/i)).toBeTruthy();
  });

  it("sollte das Tagesgeld-Zielkonto vorbelegen, wenn Sweep auf Sparen steht", () => {
    setup({
      id: "b1",
      name: "Wohnen",
      category_id: "wohnen",
      limit: 1000,
      rolloverConfig: { mode: "accumulate", surplusAction: "sweep_savings", sweepTargetAccountId: "acc-tg" },
    } as Budget);
    // Das Zielkonto-Feld erscheint und zeigt den hinterlegten Kontonamen.
    expect(screen.getByLabelText(/Tagesgeld-Zielkonto/i)).toBeTruthy();
    expect(screen.getByText("Tagesgeld")).toBeTruthy();
  });

  it("sollte adaptive=true speichern, wenn die Checkbox gesetzt wird", async () => {
    const { onSave } = setup({ id: "b1", name: "Wohnen", category_id: "wohnen", limit: 1000 } as Budget);
    await userEvent.click(screen.getByLabelText(/Limit automatisch aus echten Daten/i));
    await userEvent.click(screen.getByRole("button", { name: /speichern/i }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ adaptive: true }));
  });
});
