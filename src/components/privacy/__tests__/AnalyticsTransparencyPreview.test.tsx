import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import AnalyticsTransparencyPreview from "../AnalyticsTransparencyPreview";
import type { AnalyticsPackageV1 } from "@/services/analytics-aggregation-service";

const pkg: AnalyticsPackageV1 = {
  schema_version: 1,
  generated_at: "2026-01-01T00:00:00.000Z",
  records: [
    {
      schema_version: 1,
      period: "2026-01",
      dimensions: { category_group: "lebensmittel" },
      measures: {
        expense_sum: 400,
        expense_average: 80,
        transaction_count: 5,
        category_share_of_expenses: 0.4,
      },
      cohort_size: 5,
      generated_at: "2026-01-01T00:00:00.000Z",
    },
  ],
  suppressed_records: 2,
  protections: {
    raw_transactions_uploaded: false,
    direct_identifiers_removed: true,
    minimum_local_events: 5,
    exact_text_removed: true,
  },
};

vi.mock("@/services/analytics-aggregation-service", () => ({
  buildAnalyticsPackage: vi.fn(async () => pkg),
}));

function renderWithClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AnalyticsTransparencyPreview />
    </QueryClientProvider>,
  );
}

describe("AnalyticsTransparencyPreview", () => {
  it("sollte zuerst nur den 'nichts verlässt dein Gerät'-Hinweis + Button zeigen", () => {
    renderWithClient();
    expect(screen.getByText(/Upload\s+ist deaktiviert/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Zeig mir, was geteilt würde/ })).toBeInTheDocument();
    // Vor dem Klick keine Aggregat-Zahlen.
    expect(screen.queryByText(/aggregierte Datensätze/)).not.toBeInTheDocument();
  });

  it("sollte nach dem Aufdecken Aggregat-Übersicht, Schutzmaßnahmen und Datensatz zeigen", async () => {
    renderWithClient();
    fireEvent.click(screen.getByRole("button", { name: /Zeig mir, was geteilt würde/ }));

    expect(await screen.findByText(/aggregierte Datensätze/)).toBeInTheDocument();
    expect(screen.getByText(/k-Anonymität: min\. 5 Events/)).toBeInTheDocument();
    expect(screen.getByText("Lebensmittel")).toBeInTheDocument();
    expect(screen.getByText("2026-01")).toBeInTheDocument();
  });
});
