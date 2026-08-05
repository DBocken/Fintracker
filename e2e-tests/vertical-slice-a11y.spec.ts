import { test, expect } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { startDemo, createBudgetFromSuggestion } from "./fixtures/vertical-slice";

/**
 * WP-4.6: Vertical Slice Integration Test — Accessibility.
 *
 * Gate-Kriterium: 0 Critical axe-core Violations auf allen Slice-Screens
 * (Dashboard, Finanzstadt, Budgets inkl. geöffnetem Detail-Dialog).
 * Serious/Moderate Befunde werden als Test-Info ausgegeben, damit sie
 * sichtbar bleiben, ohne das Gate zu blockieren.
 */
test.describe("Vertical Slice Accessibility (WP-4.6)", () => {
  // Deutsche Standard-Oberfläche (DEFAULT_LOCALE = 'de') prüfen.
  test.use({ locale: "de-DE" });

  test("sollte auf Dashboard, Stadt und Budget-Detail 0 Critical Violations haben", async ({
    page,
  }, testInfo) => {
    const scan = async (screenName: string) => {
      const results = await new AxeBuilder({ page }).analyze();
      const critical = results.violations.filter((v) => v.impact === "critical");
      const rest = results.violations.filter((v) => v.impact !== "critical");
      if (rest.length > 0) {
        testInfo.annotations.push({
          type: "a11y-hinweis",
          description: `${screenName}: ${rest.length} nicht-kritische Befunde: ${rest
            .map((v) => `${v.id} (${v.impact})`)
            .join(", ")}`,
        });
      }
      return critical.map(
        (v) =>
          `${screenName}: ${v.id} — ${v.helpUrl}\n${v.nodes
            .slice(0, 3)
            .map((n) => `    ${n.target.join(" ")}: ${n.html.slice(0, 160)}`)
            .join("\n")}`,
      );
    };

    // Dashboard (mit Demo-Daten)
    await startDemo(page);
    const dashboardCritical = await scan("Dashboard");

    // Finanzstadt (Canvas + barrierearme Parallelstruktur)
    await page.goto("/city");
    await expect(page.getByRole("heading", { name: "Finanzstadt" })).toBeVisible();
    await expect(page.getByRole("img", { name: "3D-Ansicht der Finanzstadt" })).toBeVisible({
      timeout: 15000,
    });
    const cityCritical = await scan("Finanzstadt");

    // Budgets inkl. geöffnetem Detail-Dialog (Radix-Dialog im Slice)
    await createBudgetFromSuggestion(page);
    const budgetsCritical = await scan("Budgets");
    await page.getByRole("button", { name: /ausgeschöpft/ }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    const dialogCritical = await scan("Budget-Detail-Dialog");

    expect([...dashboardCritical, ...cityCritical, ...budgetsCritical, ...dialogCritical]).toEqual(
      [],
    );
  });
});
