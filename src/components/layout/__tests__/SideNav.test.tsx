import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@/i18n/I18nProvider";
import SideNav from "@/components/layout/SideNav";

function renderSideNav() {
  return render(
    <I18nProvider>
      <MemoryRouter>
        <SideNav />
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe("SideNav", () => {
  describe("Profil-Zusammenführung (nur noch oben rechts)", () => {
    it("[REGRESSION] sollte kein zweites Profil mehr in der Sidebar rendern", () => {
      // Vorher gab es zwei identische Profil-Einstiege (unten links + oben rechts).
      // Das Profil lebt jetzt ausschließlich oben rechts im Header — die Sidebar
      // darf keinen eigenen Profil-Einstieg/Status mehr zeigen.
      renderSideNav();

      expect(screen.queryByRole("button", { name: /Profil öffnen/i })).toBeNull();
      // Der Sidebar-Profil-Trigger zeigte den Anmelde-Status „Angemeldet".
      expect(screen.queryByText(/Angemeldet/i)).toBeNull();
    });

    it("sollte weiterhin die Hauptnavigation rendern", () => {
      renderSideNav();
      // Ein bekanntes Navigationsziel bleibt erreichbar.
      expect(screen.getByRole("link", { name: /Dashboard/i })).toBeInTheDocument();
    });
  });
});
