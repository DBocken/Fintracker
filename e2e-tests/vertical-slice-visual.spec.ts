import { test, expect } from "@playwright/test";
import { freezeTime, dismissOnboarding, createBudgetFromSuggestion } from "./fixtures/vertical-slice";

/**
 * WP-4.6: Vertical Slice Integration Test — Visual Regression.
 *
 * Dashboard, Finanzstadt und Budgets in drei Viewports (375/768/1440) —
 * Gate-Kriterium: < 5 % Pixelabweichung bei deterministischen Daten.
 *
 * Determinismus-Maßnahmen:
 * - Eingefrorene Zeit (page.clock) → Demo-Datensatz ist datumsgesteuert
 *   deterministisch (demo-data-service.vary ohne Math.random).
 * - prefers-reduced-motion → alle Aufbau-Animationen rendern sofort ihren
 *   Endzustand; page.clock.runFor spielt verbleibende UI-Timer ab.
 * - Die WebGL-Canvas der Stadt wird maskiert: GPU-Rasterung (SwiftShader)
 *   ist zwischen Maschinen nicht pixelstabil; das 3D-Rendering selbst ist
 *   nicht Gegenstand des visuellen Vergleichs.
 *
 * Erstlauf schreibt die Baseline-Snapshots (schlägt dabei fehl), jeder
 * Folgelauf vergleicht gegen die Baseline.
 */
test.describe("Vertical Slice Visual Regression (WP-4.6)", () => {
  // reducedMotion: statische Endzustände; locale: deutsche Standard-Oberfläche.
  test.use({ reducedMotion: "reduce", locale: "de-DE" });

  const VIEWPORTS = [
    { width: 375, height: 667, name: "375" },
    { width: 768, height: 1024, name: "768" },
    { width: 1440, height: 900, name: "1440" },
  ] as const;

  test("sollte Slice-Screens in drei Viewports pixelstabil rendern", async ({
    page,
  }, testInfo) => {
    // Fehlende Baselines werden geschrieben statt den Lauf abzubrechen —
    // so entstehen alle neun Snapshots in einem Lauf. Echte Abweichungen
    // (Baseline vorhanden, Bild anders) schlagen weiterhin fehl.
    const mismatches: string[] = [];
    const shot = async (
      name: string,
      options?: Parameters<ReturnType<typeof expect>["toHaveScreenshot"]>[0],
    ) => {
      try {
        await expect(page).toHaveScreenshot(name, { maxDiffPixelRatio: 0.05, ...options });
      } catch (error) {
        if (error instanceof Error && error.message.includes("A snapshot doesn't exist")) {
          testInfo.annotations.push({ type: "baseline", description: `${name} geschrieben` });
          return;
        }
        mismatches.push(`${name}: ${error instanceof Error ? error.message.split("\n")[0] : error}`);
      }
    };

    await freezeTime(page);

    // Onboarding → Demo (Zeit eingefroren → Datensatz deterministisch).
    await page.goto("/");
    await page.getByRole("button", { name: "Demo ansehen" }).click();
    await expect(page).toHaveURL(/\/coach$/);
    await dismissOnboarding(page);
    // Verbleibende UI-Timer (Toasts, Fade-ins) abspielen → statischer Zustand.
    await page.clock.runFor(6000);

    // Budget anlegen, damit alle drei Slice-Screens gefüllt sind.
    await createBudgetFromSuggestion(page);

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.clock.runFor(500);

      await page.goto("/dashboard");
      await expect(page.getByTestId("stat-hero-value")).toBeVisible();
      await page.clock.runFor(500);
      await shot(`dashboard-${viewport.name}.png`, { fullPage: true });

      await page.goto("/city");
      await expect(page.getByRole("heading", { name: "Finanzstadt" })).toBeVisible();
      // Signature-Moment-Timer (1.5 s + 3 s) komplett abspielen, damit das
      // Overlay auf keinem Snapshot halb sichtbar hängt.
      await page.clock.runFor(6000);
      await shot(`city-${viewport.name}.png`, {
        mask: [page.locator('[data-tour-id="city-canvas"]')],
      });

      await page.goto("/budgets");
      await expect(page.getByRole("button", { name: /ausgeschöpft/ }).first()).toBeVisible();
      await page.clock.runFor(500);
      await shot(`budgets-${viewport.name}.png`, { fullPage: true });
    }

    expect(mismatches).toEqual([]);
  });
});
