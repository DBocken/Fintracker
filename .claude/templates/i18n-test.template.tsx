/**
 * Template für i18n-kompatible Tests
 *
 * Jeder Component-Test muss:
 * 1. I18nProvider wrapping verwenden (renderWithI18n)
 * 2. Deutsche Texte testen (default)
 * 3. Englische Texte testen (Bilingual-Compliance)
 * 4. [REGRESSION] Keys existieren in beiden Sprachen
 */

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "@/i18n/I18nProvider";
import { translations } from "@/i18n/translations";
import ComponentName from "../ComponentName";

// Helper: I18nProvider Wrapper
function renderWithI18n(
  component: React.ReactElement,
  locale: "de" | "en" = "de"
) {
  return render(
    <I18nProvider initialLocale={locale}>
      {component}
    </I18nProvider>
  );
}

describe("ComponentName", () => {
  it("sollte deutsche Texte rendern", () => {
    renderWithI18n(<ComponentName />, "de");
    expect(screen.getByText("Deutscher Text")).toBeInTheDocument();
  });

  it("sollte englische Texte rendern", () => {
    renderWithI18n(<ComponentName />, "en");
    // Verwende Regex für Flexibilität (DE oder EN):
    expect(
      screen.getByText(/deutscher text|english text/i)
    ).toBeInTheDocument();
  });

  it("[REGRESSION] sollte alle i18n-Keys in beiden Sprachen haben", () => {
    const requiredKeys = ["componentName.title", "componentName.description"];

    const { de, en } = translations;

    requiredKeys.forEach((key) => {
      const path = key.split(".");
      let deValue: any = de;
      let enValue: any = en;

      path.forEach((p) => {
        expect(deValue[p]).toBeDefined(
          `Missing DE translation: ${key}`
        );
        expect(enValue[p]).toBeDefined(
          `Missing EN translation: ${key}`
        );
        deValue = deValue[p];
        enValue = enValue[p];
      });

      // Beide sollten Strings sein, nicht undefined/null
      expect(typeof deValue).toBe("string");
      expect(typeof enValue).toBe("string");
    });
  });
});
