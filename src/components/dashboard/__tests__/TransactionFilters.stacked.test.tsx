import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { I18nProvider } from "@/i18n/I18nProvider";
import { TransactionFilters } from "../TransactionFilters";

vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: [] }) }));

const noop = () => {};

function renderFilters(stacked: boolean) {
  return render(
    <I18nProvider initialLocale="de">
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
    />
    </I18nProvider>,
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

  it("sollte englische Texte korrekt rendern", () => {
    render(
      <I18nProvider initialLocale="en">
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
          stacked={true}
        />
      </I18nProvider>,
    );
    // Überprüfe dass englische Translations geladen sind
    for (const label of ["Account", "Category", "Contracts", "Essential", "Spending category", "Time range"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });
});
