import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@/i18n/I18nProvider";
import type { RecurringFlow } from "@/lib/forecast-types";

const h = vi.hoisted(() => ({
  forecast: { input: null as unknown, isLoading: false } as { input: unknown; isLoading: boolean },
}));

vi.mock("@/hooks/useForecast", () => ({ useForecast: () => h.forecast }));
vi.mock("@/components/providers/GentleModeProvider", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
  useGentleMode: () => ({ enabled: false, toggle: () => {} }),
}));

import UpcomingChargesList from "@/components/coach/UpcomingChargesList";

function flow(p: Partial<RecurringFlow> & { id: string; amount: number; anchorDate: string }): RecurringFlow {
  return { name: p.name ?? p.id, cadence: p.cadence ?? "monthly", accountId: "giro", ...p };
}

const NOW = new Date("2026-06-01T12:00:00");

function renderList() {
  return render(
    <I18nProvider>
      <MemoryRouter>
        <UpcomingChargesList now={NOW} horizonDays={30} />
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe("UpcomingChargesList (Feature 1: Anstehende Abbuchungen)", () => {
  it("sollte anstehende Ausgaben auflisten und Geldeingänge ausblenden", () => {
    h.forecast = {
      isLoading: false,
      input: {
        accounts: [],
        recurringFlows: [
          flow({ id: "miete", name: "Miete", amount: -600, anchorDate: "2026-06-10" }),
          flow({ id: "gehalt", name: "Gehalt", amount: 2000, anchorDate: "2026-06-30" }),
        ],
      },
    };
    renderList();

    // i18n: Check for either German or English based on resolved locale
    const titleElement = screen.queryByText("Anstehende Abbuchungen") || screen.queryByText("Upcoming charges");
    expect(titleElement).toBeInTheDocument();
    expect(screen.getByText("Miete")).toBeInTheDocument();
    // Einnahmen sind keine Abbuchungen → dürfen NICHT in der Liste stehen.
    expect(screen.queryByText("Gehalt")).toBeNull();
  });

  it("[REGRESSION] sollte einen in der Vergangenheit verankerten Monats-Flow als künftige Abbuchung zeigen", () => {
    h.forecast = {
      isLoading: false,
      input: {
        accounts: [],
        recurringFlows: [flow({ id: "abo", name: "Streaming", amount: -12, anchorDate: "2026-01-15" })],
      },
    };
    renderList();
    // Anker im Januar, „heute" ist der 01.06. → die nächste Fälligkeit (15.06.) erscheint.
    expect(screen.getByText("Streaming")).toBeInTheDocument();
  });

  it("sollte einen leeren Zustand zeigen, wenn keine Abbuchungen anstehen", () => {
    h.forecast = { isLoading: false, input: { accounts: [], recurringFlows: [] } };
    renderList();
    // i18n: Check for either German or English message
    const emptyMessage = screen.queryByText(/Keine Abbuchungen in den nächsten 30 Tagen/) ||
                        screen.queryByText(/No charges detected in the next 30 days/);
    expect(emptyMessage).toBeInTheDocument();
  });
});
