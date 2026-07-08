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

function renderList(locale: 'de' | 'en' = 'de') {
  localStorage.setItem('ausgabentracker_locale_v1', locale);
  return render(
    <I18nProvider initialLocale={locale}>
      <MemoryRouter>
        <UpcomingChargesList now={NOW} horizonDays={30} />
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe("UpcomingChargesList (Feature 1: Anstehende Abbuchungen)", () => {
  describe("German locale", () => {
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
      renderList('de');

      expect(screen.getByText("Anstehende Abbuchungen")).toBeInTheDocument();
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
      renderList('de');
      // Anker im Januar, „heute" ist der 01.06. → die nächste Fälligkeit (15.06.) erscheint.
      expect(screen.getByText("Streaming")).toBeInTheDocument();
    });

    it("sollte einen leeren Zustand zeigen, wenn keine Abbuchungen anstehen", () => {
      h.forecast = { isLoading: false, input: { accounts: [], recurringFlows: [] } };
      renderList('de');
      expect(screen.getByText(/Keine Abbuchungen in den nächsten 30 Tagen/)).toBeInTheDocument();
    });
  });

  describe("English locale", () => {
    it("should list upcoming charges and hide deposits", () => {
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
      renderList('en');

      expect(screen.getByText("Upcoming charges")).toBeInTheDocument();
      expect(screen.getByText("Miete")).toBeInTheDocument();
      // Deposits are no charges → must NOT be in the list.
      expect(screen.queryByText("Gehalt")).toBeNull();
    });

    it("[REGRESSION] should show monthly flow anchored in past as upcoming charge", () => {
      h.forecast = {
        isLoading: false,
        input: {
          accounts: [],
          recurringFlows: [flow({ id: "abo", name: "Streaming", amount: -12, anchorDate: "2026-01-15" })],
        },
      };
      renderList('en');
      expect(screen.getByText("Streaming")).toBeInTheDocument();
    });

    it("should show empty state when no charges are upcoming", () => {
      h.forecast = { isLoading: false, input: { accounts: [], recurringFlows: [] } };
      renderList('en');
      expect(screen.getByText(/No charges detected in the next 30 days/)).toBeInTheDocument();
    });
  });
});
