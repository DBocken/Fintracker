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

function renderProfile() {
  // Der zusammengeführte Profil-Dialog lädt Einstellungen (Theme/Sanfter Modus)
  // über React Query → QueryClientProvider ist Pflicht.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
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

      fireEvent.click(screen.getByRole("button", { name: /Profil öffnen/i }));

      const link = await screen.findByRole("link", { name: /Einstellungen/i });
      expect(link).toHaveAttribute("href", "/settings");
    });
  });

  describe("Zusammenführung der beiden Profile (nur noch oben rechts)", () => {
    it("[REGRESSION] sollte die vollständigen Profil-Funktionen über den einzigen Einstieg oben rechts zeigen", async () => {
      // Theme, Sanfter Modus und der Beta-/Premiumzugang lebten vorher NUR im
      // zweiten Profil unten links in der Sidebar. Nach dem Zusammenführen müssen
      // sie über den einzigen Profil-Einstieg (oben rechts) erreichbar sein.
      renderProfile();

      fireEvent.click(screen.getByRole("button", { name: /Profil öffnen/i }));

      expect(await screen.findByText(/Theme wählen/i)).toBeInTheDocument();
      expect(screen.getByText(/Sanfter Modus/i)).toBeInTheDocument();
      expect(screen.getByText(/Beta- & Premiumzugang/i)).toBeInTheDocument();
      // Abmelden bleibt erhalten (Label je nach Locale „Abmelden"/„Logout").
      expect(screen.getByRole("button", { name: /Abmelden|Logout/i })).toBeInTheDocument();
    });
  });
});
