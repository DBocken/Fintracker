import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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
  return render(
    <I18nProvider>
      <MemoryRouter>
        <UserQuickProfile />
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe("UserQuickProfile", () => {
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
});
