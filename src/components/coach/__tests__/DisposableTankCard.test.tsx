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

function renderCard(locale: 'de' | 'en' = 'de') {
  localStorage.setItem('ausgabentracker_locale_v1', locale);
  return render(
    <I18nProvider initialLocale={locale}>
      <MemoryRouter>
        <DisposableTankCard now={NOW} />
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe("DisposableTankCard (Feature 2: Verfügbar bis Gehalt)", () => {
  describe("German locale", () => {
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
      renderCard('de');

      expect(screen.getByText("Verfügbar bis Gehalt")).toBeInTheDocument();
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
      renderCard('de');
      expect(screen.getByText("Achtung: Die festen Kosten übersteigen dein Guthaben vor dem Gehalt.")).toBeInTheDocument();
    });

    it("sollte einen Hinweis zeigen, wenn kein regelmäßiger Geldeingang erkannt ist", () => {
      h.forecast = {
        isLoading: false,
        input: {
          accounts: [account({ id: "giro", kind: "checking", openingBalance: 1000 })],
          recurringFlows: [flow({ id: "miete", name: "Miete", amount: -600, anchorDate: "2026-06-10" })],
        },
      };
      renderCard('de');
      expect(screen.getByText("Noch kein regelmäßiger Geldeingang erkannt.")).toBeInTheDocument();
    });
  });

  describe("English locale", () => {
    it("should show available money until payday and link whole card to liquidity", () => {
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
      renderCard('en');

      expect(screen.getByText("Available until payday")).toBeInTheDocument();
      // 1000 € Giro − 600 € Miete = 400 € (Sparen zählt nicht).
      expect(screen.getByText(/400,00/)).toBeInTheDocument();
      // Karten-Regel: die ganze Fläche navigiert zur Liquiditäts-Detailansicht.
      expect(screen.getByRole("link")).toHaveAttribute("href", "/liquidity");
    });

    it("[REGRESSION] should warn if fixed costs exceed balance before payday", () => {
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
      renderCard('en');
      expect(screen.getByText("Attention: Fixed costs exceed your balance before payday.")).toBeInTheDocument();
    });

    it("should show notice when no recurring income detected", () => {
      h.forecast = {
        isLoading: false,
        input: {
          accounts: [account({ id: "giro", kind: "checking", openingBalance: 1000 })],
          recurringFlows: [flow({ id: "miete", name: "Miete", amount: -600, anchorDate: "2026-06-10" })],
        },
      };
      renderCard('en');
      expect(screen.getByText("No recurring income detected yet.")).toBeInTheDocument();
    });
  });
});
