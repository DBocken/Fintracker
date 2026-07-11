import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithI18n } from "@/test-utils/render";
import { translations } from "@/i18n/translations";
import DeltaBadge from "../DeltaBadge";

describe("DeltaBadge", () => {
  it("sollte kleine Änderungen neutral (ohne Alarmfarbe) zeigen", () => {
    const { container } = renderWithI18n(<DeltaBadge current={103} previous={100} />, "de");
    expect(screen.getByText("+3 %")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("text-muted-foreground");
  });

  it("sollte deutliche Verbesserung positiv einfärben", () => {
    const { container } = renderWithI18n(<DeltaBadge current={130} previous={100} />, "de");
    expect(screen.getByText("+30 %")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("text-positive");
  });

  it("sollte deutlichen Rückgang beim Vermögen kritisch einfärben", () => {
    const { container } = renderWithI18n(<DeltaBadge current={70} previous={100} />, "de");
    expect(screen.getByText("−30 %".replace("−", "-"))).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("text-destructive");
  });

  it("[Edge] sollte Vorwert 0 als 'neu' zeigen (Deutsch)", () => {
    renderWithI18n(<DeltaBadge current={50} previous={0} />, "de");
    expect(screen.getByText("neu")).toBeInTheDocument();
  });

  it("[Edge] sollte Vorwert 0 als 'new' zeigen (Englisch)", () => {
    renderWithI18n(<DeltaBadge current={50} previous={0} />, "en");
    expect(screen.getByText("new")).toBeInTheDocument();
  });

  it("sollte absolute Formatierung unterstützen", () => {
    renderWithI18n(
      <DeltaBadge current={120} previous={100} format="absolute" formatAbsolute={(d) => `${d > 0 ? "+" : ""}${d} €`} />,
      "de",
    );
    expect(screen.getByText("+20 €")).toBeInTheDocument();
  });

  it("[REGRESSION] sollte alle i18n-Keys in beiden Sprachen haben", () => {
    const requiredKeys = ["deltaBadge.new"];

    const { de, en } = translations;

    requiredKeys.forEach((key) => {
      const path = key.split(".");
      let deValue: any = de;
      let enValue: any = en;

      path.forEach((p) => {
        expect(deValue[p]).toBeDefined();
        expect(enValue[p]).toBeDefined();
        deValue = deValue[p];
        enValue = enValue[p];
      });

      expect(typeof deValue).toBe("string");
      expect(typeof enValue).toBe("string");
    });
  });
});
