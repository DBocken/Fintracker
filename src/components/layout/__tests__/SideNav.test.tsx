import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nProvider } from "@/i18n/I18nProvider";
import { translations } from "@/i18n/translations";
import SideNav from "@/components/layout/SideNav";

function renderSideNav(locale: "de" | "en" = "de") {
  // QueryClient: die Nav liest den Business-Modus über useBusinessMode (useQuery).
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider initialLocale={locale}>
        <MemoryRouter>
          <SideNav />
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  );
}

describe("SideNav", () => {
  describe("Profil-Zusammenführung (nur noch oben rechts)", () => {
    it("[REGRESSION] sollte kein zweites Profil mehr in der Sidebar rendern", () => {
      // Vorher gab es zwei identische Profil-Einstiege (unten links + oben rechts).
      // Das Profil lebt jetzt ausschließlich oben rechts im Header — die Sidebar
      // darf keinen eigenen Profil-Einstieg/Status mehr zeigen.
      renderSideNav();

      expect(screen.queryByRole("button", { name: /Profil öffnen|Open profile/i })).toBeNull();
      // Der Sidebar-Profil-Trigger zeigte den Anmelde-Status „Angemeldet".
      expect(screen.queryByText(/Angemeldet|Logged in/i)).toBeNull();
    });

    it("sollte weiterhin die Hauptnavigation rendern", () => {
      renderSideNav();
      // Ein bekanntes Navigationsziel bleibt erreichbar.
      expect(screen.getByRole("link", { name: /Dashboard|Übersicht/i })).toBeInTheDocument();
    });
  });

  describe("i18n Compliance", () => {
    it("sollte deutsche Texte rendern", () => {
      renderSideNav("de");
      // Copilot und App-Name sollten auf Deutsch sichtbar sein
      expect(screen.getByText(translations.de.shell.copilot)).toBeInTheDocument();
      expect(screen.getByText(translations.de.shell.appName)).toBeInTheDocument();
    });

    it("sollte englische Texte rendern", () => {
      renderSideNav("en");
      // Copilot und App-Name sollten auf Englisch sichtbar sein
      expect(screen.getByText(translations.en.shell.copilot)).toBeInTheDocument();
      expect(screen.getByText(translations.en.shell.appName)).toBeInTheDocument();
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
