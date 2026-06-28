import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@/i18n/I18nProvider";
import MobileNav from "@/components/layout/MobileNav";

function renderMobileNav() {
  return render(
    <I18nProvider>
      <MemoryRouter>
        <MobileNav />
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe("Navigation Viewport (Mobile-Browser-Leiste)", () => {
  describe("Dynamische Viewport-Höhe (dvh) statt 100vh", () => {
    it("[REGRESSION] das Nav-Sheet nutzt dvh, damit die ein-/ausblendende Browser-Leiste die unteren Ziele nicht verdeckt", async () => {
      // Bug: Bei 100vh (= große Viewport-Höhe mit eingeklappten Browser-Leisten)
      // rutschte das Sheet-Ende hinter die unten eingeblendete Adress-/
      // Navigationsleiste des mobilen Browsers — die untersten Navigationsziele
      // (z. B. Einstellungen) waren verdeckt. dvh folgt der sichtbaren Höhe.
      renderMobileNav();
      fireEvent.click(screen.getAllByRole("button")[0]); // Nav-Sheet öffnen
      await screen.findAllByRole("link"); // warten, bis der Sheet-Inhalt da ist

      // Das Sheet wird per Portal an den Body gehängt → über document.body prüfen.
      const html = document.body.innerHTML;
      expect(html).toContain("100dvh");
      // Kein starres 100vh mehr (Hinweis: "100dvh" enthält nicht "100vh").
      expect(html).not.toContain("100vh");
    });
  });
});
