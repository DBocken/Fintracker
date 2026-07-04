import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@/i18n/I18nProvider";
import type { ForecastAccount, RecurringFlow } from "@/lib/forecast-types";

const h = vi.hoisted(() => ({
  forecast: { input: null as unknown, isLoading: false } as { input: unknown; isLoading: boolean },
}));

vi.mock("@/hooks/useForecast", () => ({ useForecast: () => h.forecast }));
vi.mock("@/components/providers/GentleModeProvider", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
  useGentleMode: () => ({ enabled: false, toggle: () => {} }),
}));

import DisposableTankCard from "@/components/coach/DisposableTankCard";

function account(p: Partial<ForecastAccount> & { id: string; kind: ForecastAccount["kind"]; openingBalance: number }): ForecastAccount {
  return { name: p.name ?? p.id, ...p };
}
function flow(p: Partial<RecurringFlow> & { id: string; amount: number; anchorDate: string }): RecurringFlow {
  return { name: p.name ?? p.id, cadence: p.cadence ?? "monthly", accountId: "giro", ...p };
}

const NOW = new Date("2026-06-01T12:00:00");

function renderCard() {
  return render(
    <I18nProvider>
      <MemoryRouter>
        <DisposableTankCard now={NOW} />
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe("DisposableTankCard (Feature 2: Verfügbar bis Gehalt)", () => {
  it("sollte verfügbares Geld bis zum Gehalt zeigen und als ganze Karte zur Liquidität verlinken", () => {
    h.forecast = {
      isLoading: false,
      input: {
        accounts: [account({ id: "giro", kind: "checking", openingBalance: 1000 }), account({ id: "spar", kind: "savings", openingBalance: 5000 })],
        recurringFlows: [
          flow({ id: "miete", name: "Miete", amount: -600, anchorDate: "2026-06-10" }),
          flow({ id: "gehalt", name: "Gehalt", amount: 2000, anchorDate: "2026-06-30" }),
        ],
      },
    };
    renderCard();

    // i18n: Check for either German or English message
    const titleMessage = screen.queryByText("Verfügbar bis Gehalt") ||
                        screen.queryByText("Available until payday");
    expect(titleMessage).toBeInTheDocument();
    // 1000 € Giro − 600 € Miete = 400 € (Sparen zählt nicht).
    expect(screen.getByText(/400,00/)).toBeInTheDocument();
    // Karten-Regel: die ganze Fläche navigiert zur Liquiditäts-Detailansicht.
    expect(screen.getByRole("link")).toHaveAttribute("href", "/liquidity");
  });

  it("[REGRESSION] sollte warnen, wenn die Fixkosten das Guthaben vor dem Gehalt übersteigen", () => {
    h.forecast = {
      isLoading: false,
      input: {
        accounts: [account({ id: "giro", kind: "checking", openingBalance: 500 })],
        recurringFlows: [
          flow({ id: "miete", name: "Miete", amount: -600, anchorDate: "2026-06-10" }),
          flow({ id: "gehalt", name: "Gehalt", amount: 2000, anchorDate: "2026-06-30" }),
        ],
      },
    };
    renderCard();
    // i18n: Check for either German or English message
    const warningMessage = screen.queryByText(/Fixkosten übersteigen dein Guthaben/) ||
                          screen.queryByText(/Fixed costs exceed your balance/);
    expect(warningMessage).toBeInTheDocument();
  });

  it("sollte einen Hinweis zeigen, wenn kein regelmäßiger Geldeingang erkannt ist", () => {
    h.forecast = {
      isLoading: false,
      input: {
        accounts: [account({ id: "giro", kind: "checking", openingBalance: 1000 })],
        recurringFlows: [flow({ id: "miete", name: "Miete", amount: -600, anchorDate: "2026-06-10" })],
      },
    };
    renderCard();
    // i18n: Check for either German or English message
    const noIncomeMessage = screen.queryByText(/Noch kein regelmäßiger Geldeingang erkannt/) ||
                           screen.queryByText(/No recurring income detected/);
    expect(noIncomeMessage).toBeInTheDocument();
  });
});
