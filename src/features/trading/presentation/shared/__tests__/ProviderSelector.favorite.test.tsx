import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test-utils/render";
import ProviderSelector from "../ProviderSelector";

vi.mock("@/services/user-settings-service", () => ({
  setPreferredMarketProvider: vi.fn().mockResolvedValue(undefined),
}));

import { setPreferredMarketProvider } from "@/services/user-settings-service";

describe("ProviderSelector — Favorit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("[REGRESSION] sollte den Stern am GESPEICHERTEN Favoriten zeigen, nicht fest an Yahoo", async () => {
    // Vor WP 6.3b hielt die Komponente den Favoriten als lokales
    // useState('yahoo') und las den gespeicherten Wert nie — nach jedem
    // Reload stand der Stern am falschen Anbieter.
    const user = userEvent.setup();
    renderWithProviders(
      <ProviderSelector
        currentProvider="yahoo"
        favoriteProvider="stooq"
        onProviderChange={() => {}}
      />,
      { query: true },
    );
    await user.click(screen.getByRole("button"));
    const stooqFavorit = await screen.findByText("Stooq (Favorit)");
    expect(stooqFavorit).toBeInTheDocument();
  });

  it("sollte beim Setzen des Favoriten speichern UND den Query-Cache invalidieren", async () => {
    // Zweite Haelfte des Bugs: use-trading-portfolio liest den Favoriten mit
    // staleTime: Infinity — ohne Invalidierung saehe das ViewModel den neuen
    // Wert bis zum naechsten Reload nie.
    const user = userEvent.setup();
    const { queryClient } = renderWithProviders(
      <ProviderSelector
        currentProvider="yahoo"
        favoriteProvider="yahoo"
        onProviderChange={() => {}}
      />,
      { query: true },
    );
    if (!queryClient) throw new Error("renderWithProviders({ query: true }) sollte einen QueryClient liefern");
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    await user.click(screen.getByRole("button"));
    await user.click(await screen.findByText(/Stooq als Favorit|als Favorit.*Stooq/));
    await waitFor(() => {
      expect(setPreferredMarketProvider).toHaveBeenCalledWith("stooq");
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["preferred-market-provider"] });
    });
  });

  it("sollte den Favoriten auf Englisch genauso anzeigen", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <ProviderSelector
        currentProvider="yahoo"
        favoriteProvider="stooq"
        onProviderChange={() => {}}
      />,
      { locale: "en", query: true },
    );
    await user.click(screen.getByRole("button"));
    const stooqFavorite = await screen.findByText("Stooq (favorite)");
    expect(stooqFavorite).toBeInTheDocument();
  });
});
