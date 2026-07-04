import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TransactionFilters } from "./TransactionFilters";

vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: [] }) }));
vi.mock("@/i18n/useI18n", () => ({ useI18n: () => ({ t: (_k: string, f?: string) => f ?? _k, locale: "de" }) }));

const noop = () => {};

function renderFilters(stacked: boolean) {
  return render(
    <TransactionFilters
      filterCat="all"
      setFilterCat={noop}
      filterAccount="all"
      setFilterAccount={noop}
      searchInput=""
      setSearchInput={noop}
      range="Gesamt"
      setRange={noop}
      customDays={30}
      setCustomDays={noop}
      customGran="daily"
      setCustomGran={noop}
      customPeriod=""
      setCustomPeriod={noop}
      periodOptions={[]}
      categories={[]}
      filterContract="all"
      setFilterContract={noop}
      filterEssential="all"
      setFilterEssential={noop}
      filterAusgabenklasse="all"
      setFilterAusgabenklasse={noop}
      showSearch={false}
      stacked={stacked}
    />,
  );
}

describe("TransactionFilters – aufgeräumtes Raster (stacked)", () => {
  it("[REGRESSION] sollte im Stacked-Modus beschriftete Felder rendern", () => {
    renderFilters(true);
    // Sichtbare Labels ordnen die zuvor mehrdeutigen „Alle"-Selects eindeutig zu.
    for (const label of ["Konto", "Kategorie", "Verträge", "Essenziell", "Ausgabenklasse", "Zeitraum"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it("sollte in der Toolbar (nicht stacked) keine sichtbaren Feld-Labels zeigen", () => {
    renderFilters(false);
    expect(screen.queryByText("Verträge")).toBeNull();
    expect(screen.queryByText("Zeitraum")).toBeNull();
  });
});
