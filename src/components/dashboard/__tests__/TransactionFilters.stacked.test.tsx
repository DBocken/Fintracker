import { screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { renderWithI18n } from "@/test-utils/render";
import type { Account } from "@/types";
import type { FilterViewModel } from "@/features/shared/domain/filter-view-model";
import { TransactionFilters } from "../TransactionFilters";

vi.mock("@/services/account-service", () => ({ getAccounts: vi.fn() }));

import { getAccounts } from "@/services/account-service";

const noop = () => {};
const ACCOUNTS: Account[] = [];

// WP 5.4 (KOMP-2): `TransactionFilters` nimmt seit diesem Paket EIN
// `filters: FilterViewModel`-Objekt statt 25 flacher Props entgegen. Die
// Fixtur hier bündelt, was vorher einzeln als Props auf der Testkomponente
// stand — die Assertions selbst (Labels je Modus/Sprache, keine eigene
// Konten-Query) sind UNVERÄNDERT dieselbe Zusicherung wie vor dem Umbau.
function buildFilters(): FilterViewModel {
  return {
    values: {
      category: "all",
      account: "all",
      contract: "all",
      essential: "all",
      ausgabenklasse: "all",
      search: "",
      range: "Gesamt",
      customDays: 30,
      customGranularity: "daily",
      customPeriod: "",
    },
    set: {
      category: noop,
      account: noop,
      contract: noop,
      essential: noop,
      ausgabenklasse: noop,
      search: noop,
      range: noop,
      customDays: noop,
      customGranularity: noop,
      customPeriod: noop,
    },
    periodOptions: [],
    categories: [],
    accounts: ACCOUNTS,
  };
}

function renderFilters(stacked: boolean, locale: "de" | "en" = "de") {
  return renderWithI18n(
    <TransactionFilters filters={buildFilters()} showSearch={false} stacked={stacked} />,
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
