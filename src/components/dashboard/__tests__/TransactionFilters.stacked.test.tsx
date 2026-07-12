import { screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { renderWithI18n } from "@/test-utils/render";
import type { Account } from "@/types";
import { TransactionFilters } from "../TransactionFilters";

vi.mock("@/services/account-service", () => ({ getAccounts: vi.fn() }));

import { getAccounts } from "@/services/account-service";

const noop = () => {};
const ACCOUNTS: Account[] = [];

function renderFilters(stacked: boolean, locale: "de" | "en" = "de") {
  return renderWithI18n(
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
      accounts={ACCOUNTS}
      filterContract="all"
      setFilterContract={noop}
      filterEssential="all"
      setFilterEssential={noop}
      filterAusgabenklasse="all"
      setFilterAusgabenklasse={noop}
      showSearch={false}
      stacked={stacked}
    />,
    locale,
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
    renderFilters(true, "en");
    // Überprüfe dass englische Translations geladen sind
    for (const label of ["Account", "Category", "Contracts", "Essential", "Spending category", "Time range"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it("[REGRESSION] sollte keine eigene Konten-Query ausführen", () => {
    renderFilters(true);
    expect(getAccounts).not.toHaveBeenCalled();
  });
});
