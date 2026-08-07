import { test, expect } from "@playwright/test";
import { startDemo } from "./fixtures/vertical-slice";
import { CLS_BUDGET, collectWebVitals, lcpBudgetMs, type WebVitals } from "./fixtures/web-vitals";

/**
 * WP-4.6: Vertical Slice Integration Test — Performance.
 *
 * Misst LCP und CLS auf Dashboard und Finanzstadt nach einem echten
 * Seiten-Reload (Anonymous-Flag + Demo-Daten bleiben im Browser-Kontext
 * erhalten, die Route lädt also mit Daten).
 *
 * Die Budgets hängen am Ziel (`E2E_TARGET`):
 *
 * - **dev** (Standard): Vite transformiert on-the-fly, deshalb aufgeweichte
 *   Budgets (LCP < 4 s). Das ist eine Entwickler-Rückmeldung, kein Gate.
 * - **preview**: Produktions-Build, also gilt das Gate des Plans
 *   (LCP < 2.5 s Desktop, Plan §5/§7). Genau dieser Lauf war bisher nirgends
 *   verdrahtet und stand als offener Punkt.
 *
 * CLS ist buildunabhängig und bleibt in beiden Fällen bei < 0.1.
 *
 * Die Messwerte werden als Test-Info ausgegeben, damit die
 * Gate-Dokumentation echte Zahlen zitieren kann.
 */

const IS_PREVIEW = process.env.E2E_TARGET === "preview";

/** LCP-Budget in ms. Prod ist das Gate, Dev nur eine Rückmeldung. */
const LCP_BUDGET_MS = lcpBudgetMs();

/**
 * Budget der Warm-Navigation Dashboard → Stadt.
 *
 * Beschreibt eine echte Entwicklungsmaschine. In Containern ohne GPU rendert
 * WebGL in Software (SwiftShader) und der Wert liegt systematisch darüber —
 * das Budget wurde deshalb bewusst NICHT gelockert, sondern der Lauf dort als
 * nicht aussagekräftig eingestuft. `E2E_SOFTWARE_WEBGL=1` macht daraus eine
 * Test-Info statt eines Fehlschlags, ohne die Zahl zu beschönigen.
 */
const CITY_NAVIGATION_BUDGET_MS = 1000;
const SOFTWARE_WEBGL = process.env.E2E_SOFTWARE_WEBGL === "1";

test.describe("Vertical Slice Performance (WP-4.6)", () => {
  // Deutsche Standard-Oberfläche (DEFAULT_LOCALE = 'de') prüfen.
  test.use({ locale: "de-DE" });

  test("sollte LCP- und CLS-Budgets auf Dashboard und Finanzstadt einhalten", async ({
    page,
  }, testInfo) => {
    // Warm-up: Demo-Daten + alle Chunks des Slice einmal laden (SP-A-Start).
    await startDemo(page);
    await page.goto("/city");
    await expect(page.getByRole("heading", { name: "Finanzstadt" })).toBeVisible({
      timeout: 15000,
    });

    const results: Record<string, WebVitals> = {};

    for (const route of ["/dashboard", "/city"] as const) {
      // Echter Reload der Route → LCP/CLS beziehen sich auf dieses Dokument.
      await page.goto(route);
      await expect(page.locator("main")).toBeVisible();
      const vitals = await collectWebVitals(page);
      results[route] = vitals;
      testInfo.annotations.push({
        type: "web-vitals",
        description: `${route}: LCP ${vitals.lcp.toFixed(0)} ms, CLS ${vitals.cls.toFixed(3)}`,
      });
      expect(
        vitals.lcp,
        `LCP ${route} sollte unter ${LCP_BUDGET_MS} ms liegen (${IS_PREVIEW ? "Prod-Gate" : "Dev-Budget"})`,
      ).toBeLessThan(LCP_BUDGET_MS);
      expect(vitals.cls, `CLS ${route} sollte unter ${CLS_BUDGET} liegen`).toBeLessThan(CLS_BUDGET);
    }

    // Interaktionslatenz (Gate: < 100 ms Mobile / Produktions-Build) —
    // hier als Dev-Smoke-Test: zweite SPA-Navigation Dashboard → Stadt mit
    // bereits geladenem Chunk muss unter 1 s sichtbar anschlagen.
    await page.goto("/dashboard");
    await expect(page.getByTestId("stat-hero-value")).toBeVisible();
    const startedAt = Date.now();
    await page.getByRole("link", { name: "Zur Finanzstadt" }).click();
    await expect(page.getByRole("heading", { name: "Finanzstadt" })).toBeVisible();
    const latencyMs = Date.now() - startedAt;
    testInfo.annotations.push({
      type: "interaktionslatenz",
      description: `Dashboard → Stadt (warm): ${latencyMs} ms`,
    });
    if (SOFTWARE_WEBGL) {
      // Kein stiller Durchwinker: die gemessene Zahl steht im Bericht, nur der
      // Fehlschlag entfaellt. Ohne diesen Hinweis laese sich ein gruener Lauf
      // als Beleg fuer ein eingehaltenes Budget missverstehen.
      testInfo.annotations.push({
        type: "perf-hinweis",
        description: `Warm-Navigation Dashboard → Stadt: ${latencyMs.toFixed(0)} ms gegen ${CITY_NAVIGATION_BUDGET_MS} ms — Software-WebGL, nicht aussagekraeftig.`,
      });
      return;
    }
    expect(latencyMs).toBeLessThan(CITY_NAVIGATION_BUDGET_MS);
  });
});
