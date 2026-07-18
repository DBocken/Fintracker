import { screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test-utils/render";
import { translations } from "@/i18n/translations";
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

// Diese Komponente (useQuery) braucht zusätzlich den QueryClientProvider.
const renderPreview = (component: React.ReactElement, locale: "de" | "en" = "de") =>
  renderWithProviders(component, { locale, router: false, query: true });

describe("AnalyticsTransparencyPreview", () => {
  it("sollte zuerst nur den 'nichts verlässt dein Gerät'-Hinweis + Button zeigen", () => {
    renderPreview(<AnalyticsTransparencyPreview />, "de");
    expect(screen.getByText(/Upload\s+ist deaktiviert/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: translations.de.analytics.showPreview })).toBeInTheDocument();
    // Vor dem Klick keine Aggregat-Zahlen.
    expect(screen.queryByText(new RegExp(translations.de.analytics.aggregatedRecords))).not.toBeInTheDocument();
  });

  it("sollte nach dem Aufdecken Aggregat-Übersicht, Schutzmaßnahmen und Datensatz zeigen", async () => {
    renderPreview(<AnalyticsTransparencyPreview />, "de");
    fireEvent.click(screen.getByRole("button", { name: translations.de.analytics.showPreview }));

    expect(await screen.findByText(new RegExp(translations.de.analytics.aggregatedRecords))).toBeInTheDocument();
    expect(screen.getByText(/k-Anonymität: min\. 5 Events/)).toBeInTheDocument();
    expect(screen.getByText("Lebensmittel")).toBeInTheDocument();
    expect(screen.getByText("2026-01")).toBeInTheDocument();
  });

  it("should show preview button in English", () => {
    renderPreview(<AnalyticsTransparencyPreview />, "en");
    expect(screen.getByRole("button", { name: translations.en.analytics.showPreview })).toBeInTheDocument();
  });

  it("[REGRESSION] should have all analytics i18n keys in both languages", () => {
    const requiredKeys = [
      "analytics.showPreview",
      "analytics.aggregating",
      "analytics.aggregatedRecords",
      "analytics.suppressed",
      "analytics.noRawData",
      "analytics.directIdentiersRemoved",
      "analytics.exactTextRemoved",
      "analytics.kAnonymity",
      "analytics.noGroupsWithEnoughRecords",
      "analytics.groupColumn",
      "analytics.monthColumn",
      "analytics.avgPerMonthColumn",
      "analytics.transactionsColumn",
      "analytics.nothingLabel",
      "analytics.maximalLabel",
    ];

    requiredKeys.forEach((key) => {
      const path = key.split(".");
      let deValue: unknown = translations.de;
      let enValue: unknown = translations.en;

      path.forEach((p) => {
        const deHas = deValue && typeof deValue === "object" && p in deValue;
        const enHas = enValue && typeof enValue === "object" && p in enValue;
        expect(deHas).toBe(true);
        expect(enHas).toBe(true);
        deValue = (deValue as Record<string, unknown>)[p];
        enValue = (enValue as Record<string, unknown>)[p];
      });

      expect(typeof deValue).toBe("string");
      expect(typeof enValue).toBe("string");
    });
  });
});
