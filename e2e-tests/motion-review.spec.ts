import { test } from "@playwright/test";
import { startDemo, createBudgetFromSuggestion } from "./fixtures/vertical-slice";

/**
 * WP-4.6-Gate — Motion-Review, Aufzeichnung.
 *
 * Der Motion-Teil des Gates war aus statischen PNGs grundsätzlich nicht
 * beurteilbar: Timing, Abbruchbarkeit und Objektkontinuität sind Eigenschaften
 * von Bewegung, und ein Standbild hat keine. Diese Spec fährt die drei
 * Übergänge des Slice mit **echter Zeit** ab und zeichnet sie auf; ausgewertet
 * werden anschließend die Frames um die Übergänge herum.
 *
 * Bewusst KEIN Teil der regulären Suite (Dateiname außerhalb des
 * `vertical-slice-`-Präfixes, per `--grep` gezielt zu starten): Der Lauf
 * erzeugt Videos von einigen Megabyte und prüft nichts — er ist ein
 * Erhebungsinstrument, kein Test. Ein Erhebungslauf, der bei jedem Commit
 * mitläuft, kostet nur Zeit.
 *
 * Aufruf:
 *   pnpm exec playwright test motion-review.spec.ts
 * Die Videos liegen danach unter `test-results/`.
 *
 * Ausdrücklich NICHT eingefrorene Zeit: `page.clock` würde genau das
 * wegnehmen, worum es hier geht.
 */
// `video` erzwingt einen eigenen Worker und laesst sich deshalb nicht in einer
// describe-Gruppe setzen — Playwright weist das ausdruecklich zurueck.
test.use({
  locale: "de-DE",
  video: { mode: "on", size: { width: 1280, height: 800 } },
  viewport: { width: 1280, height: 800 },
});

test.describe("Motion-Review (WP-4.6-Gate)", () => {
  test("sollte die drei Slice-Übergänge in Echtzeit aufzeichnen", async ({ page }) => {
    await startDemo(page);

    // Übergang 1: Coach → Dashboard.
    await page.getByRole("link", { name: /Dashboard/ }).first().click();
    await page.waitForURL(/\/dashboard$/);
    // Ruhephase, damit der Aufbau vollständig im Video liegt und die
    // Auswertung Anfangs- von Endzustand unterscheiden kann.
    await page.waitForTimeout(2500);

    // Übergang 2: Dashboard → Finanzstadt.
    await page.getByRole("link", { name: "Zur Finanzstadt" }).click();
    await page.waitForURL(/\/city$/);
    await page.waitForTimeout(4000);

    // Übergang 3: Budget-Detail auf und wieder zu.
    await createBudgetFromSuggestion(page);
    await page.getByRole("button", { name: /ausgeschöpft/ }).first().click();
    await page.waitForTimeout(1500);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(1500);
  });
});
