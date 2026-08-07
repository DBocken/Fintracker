import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@/i18n/I18nProvider";

// Profil-Dialog erscheint nur für angemeldete Nutzer → useAuth mit Test-User mocken.
vi.mock("@/components/providers/AuthProvider", () => ({
  useAuth: () => ({
    user: {
      id: "user-1",
      email: "tester@example.com",
      user_metadata: { full_name: "Test Tester" },
    },
    status: "authenticated",
    session: null,
  }),
}));

import UserQuickProfile from "@/components/UserQuickProfile";

function renderProfile(locale: "de" | "en" = "de") {
  // Der zusammengeführte Profil-Dialog lädt Einstellungen (Theme/Sanfter Modus)
  // über React Query → QueryClientProvider ist Pflicht.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider initialLocale={locale}>
        <MemoryRouter>
          <UserQuickProfile />
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe("UserQuickProfile (zusammengeführtes Profil)", () => {
  describe("Profil → Einstellungen (Mobile)", () => {
    it("[REGRESSION] sollte aus dem Profil-Dialog zu den Einstellungen verlinken", async () => {
      // Bug: Der „Profil"-Button im Dialog hatte keinen Handler/Link und tat nichts —
      // auf Mobil gab es so keinen Weg vom Profil in die Einstellungen.
      renderProfile();

      fireEvent.click(screen.getByRole("button", { name: /Profil öffnen|Open profile/i }));

      const link = await screen.findByRole("link", { name: /Einstellungen|Settings/i });
      expect(link).toHaveAttribute("href", "/settings");
    });
  });

  describe("Sanfter Modus — Stufenwahl", () => {
    // Gleiche Fehlerklasse wie die axe-critical `button-name`-Befunde aus dem
    // WP-4.6-Gate: Radix-Bedienelement ohne zugänglichen Namen, Nachbartext
    // nicht programmatisch verknüpft. Seit der Annäherungsleiter
    // (`docs/debt-avoidance-recovery.md`) ist es eine Auswahl statt eines
    // Schalters — der zugängliche Name muss derselbe bleiben.
    it("[REGRESSION] sollte die Stufenwahl zugänglich benennen (Deutsch)", async () => {
      renderProfile("de");

      fireEvent.click(screen.getByRole("button", { name: "Profil öffnen" }));

      expect(await screen.findByRole("combobox", { name: "Sanfter Modus" })).toBeInTheDocument();
    });

    it("[REGRESSION] sollte die Stufenwahl zugänglich benennen (Englisch)", async () => {
      renderProfile("en");

      fireEvent.click(screen.getByRole("button", { name: "Open profile" }));

      expect(await screen.findByRole("combobox", { name: "Gentle mode" })).toBeInTheDocument();
    });

    it("sollte einen Rückweg aus dem Sanften Modus anbieten (Deutsch)", async () => {
      // Der eigentliche Zweck der Leiter: Ein Modus ohne Rückweg ist ein
      // Versteck. Die Wahl muss deshalb sichtbar mehr als „an/aus" hergeben.
      renderProfile("de");

      fireEvent.click(screen.getByRole("button", { name: "Profil öffnen" }));

      expect(await screen.findByRole("combobox", { name: "Sanfter Modus" })).toHaveTextContent(
        "Alles sichtbar",
      );
    });

    it("sollte einen Rückweg aus dem Sanften Modus anbieten (Englisch)", async () => {
      renderProfile("en");

      fireEvent.click(screen.getByRole("button", { name: "Open profile" }));

      expect(await screen.findByRole("combobox", { name: "Gentle mode" })).toHaveTextContent(
        "Everything visible",
      );
    });
  });

  describe("Zusammenführung der beiden Profile (nur noch oben rechts)", () => {
    it("[REGRESSION] sollte die vollständigen Profil-Funktionen über den einzigen Einstieg oben rechts zeigen", async () => {
      // Theme, Sanfter Modus und der Beta-/Premiumzugang lebten vorher NUR im
      // zweiten Profil unten links in der Sidebar. Nach dem Zusammenführen müssen
      // sie über den einzigen Profil-Einstieg (oben rechts) erreichbar sein.
      renderProfile();

      fireEvent.click(screen.getByRole("button", { name: /Profil öffnen|Open profile/i }));

      expect(await screen.findByText(/Theme wählen|Select theme/i)).toBeInTheDocument();
      expect(screen.getByText(/Sanfter Modus|Gentle mode/i)).toBeInTheDocument();
      expect(screen.getByText(/Beta- & Premiumzugang|Beta & Premium access/i)).toBeInTheDocument();
      // Abmelden bleibt erhalten (Label je nach Locale „Abmelden"/„Logout").
      expect(screen.getByRole("button", { name: /Abmelden|Logout/i })).toBeInTheDocument();
    });
  });
});
