import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@/i18n/I18nProvider";
import { translations } from "@/i18n/translations";
import MobileNav from "@/components/layout/MobileNav";

function renderMobileNav(locale: "de" | "en" = "de") {
  return render(
    <I18nProvider initialLocale={locale}>
      <MemoryRouter>
        <MobileNav />
      </MemoryRouter>
    </I18nProvider>,
  );
}

describe("MobileNav", () => {
  describe("Navigation-Einträge (Icon + Text in einer Zeile)", () => {
    it("[REGRESSION] sollte die NavLink-className auswerten statt den Funktions-Quelltext ins class-Attribut zu schreiben", async () => {
      // Bug: <SheetClose asChild> (Radix Slot) konnte die *Funktions*-className von
      // NavLink nicht mergen und schrieb den Funktions-Quelltext ("({ isActive }) => …")
      // ins class-Attribut. Dadurch griff KEIN Utility (auch nicht `flex`), der <a>
      // fiel auf display:inline zurück und Icon (Logo) und Text brachen untereinander um.
      renderMobileNav();
      fireEvent.click(screen.getAllByRole("button")[0]); // Sheet öffnen

      const links = await screen.findAllByRole("link");
      expect(links.length).toBeGreaterThan(0);

      for (const link of links) {
        const cls = link.getAttribute("class") ?? "";
        // Ausgewertete Utility-Klassen → Icon und Label in einer Zeile.
        expect(cls).toContain("flex items-center gap-3");
        // Der Funktions-Quelltext darf NICHT im class-Attribut landen.
        expect(cls).not.toContain("=>");
        expect(cls).not.toContain("isActive");
      }
    });

    it("sollte für jeden Eintrag Icon und Label im selben Link rendern", async () => {
      renderMobileNav();
      fireEvent.click(screen.getAllByRole("button")[0]);

      const links = await screen.findAllByRole("link");
      for (const link of links) {
        expect(link.querySelector("svg")).not.toBeNull(); // Icon
        expect(link.textContent?.trim().length ?? 0).toBeGreaterThan(0); // Text
      }
    });
  });

  describe("i18n Compliance", () => {
    it("sollte deutsche Navigation-Texte rendern", () => {
      renderMobileNav("de");
      fireEvent.click(screen.getAllByRole("button")[0]);
      // Navigation-Header sollte auf Deutsch sichtbar sein
      expect(screen.getByText(translations.de.shell.navigation)).toBeInTheDocument();
    });

    it("sollte englische Navigation-Texte rendern", () => {
      renderMobileNav("en");
      fireEvent.click(screen.getAllByRole("button")[0]);
      // Navigation-Header sollte auf Englisch sichtbar sein
      expect(screen.getByText(translations.en.shell.navigation)).toBeInTheDocument();
    });

    it("[REGRESSION] sollte alle shell-Keys in beiden Sprachen haben", () => {
      // Iterate through all keys in translations.de.shell
      const deKeys = Object.keys(translations.de.shell);
      const enKeys = Object.keys(translations.en.shell);

      // Both locales should have the same keys
      expect(enKeys.sort()).toEqual(deKeys.sort());

      // Each key should have a string value in both locales
      deKeys.forEach((key) => {
        const deKey = key as keyof typeof translations.de.shell;
        const enKey = key as keyof typeof translations.en.shell;
        expect(translations.de.shell[deKey]).toBeDefined();
        expect(typeof translations.de.shell[deKey]).toBe("string");
        expect(translations.en.shell[enKey]).toBeDefined();
        expect(typeof translations.en.shell[enKey]).toBe("string");
      });
    });
  });
});
