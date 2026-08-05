import { test, expect } from "@playwright/test";
import { startDemo } from "./fixtures/vertical-slice";

/**
 * WP-4.6: Vertical Slice Integration Test — Performance.
 *
 * Misst LCP und CLS auf Dashboard und Finanzstadt nach einem echten
 * Seiten-Reload (Anonymous-Flag + Demo-Daten bleiben im Browser-Kontext
 * erhalten, die Route lädt also mit Daten).
 *
 * Hinweis zu den Budgets: Das Gate des Plans (LCP < 2.5 s Desktop) gilt für
 * den Produktions-Build. Diese Spec läuft gegen den Dev-Server (Vite
 * transformiert on-the-fly), deshalb gelten hier aufgeweichte Budgets
 * (LCP < 4 s, CLS < 0.1). Die Messwerte werden als Test-Info ausgegeben,
 * damit die Gate-Dokumentation echte Zahlen zitieren kann.
 */

type WebVitals = { lcp: number; cls: number };

async function collectWebVitals(page: import("@playwright/test").Page): Promise<WebVitals> {
  return page.evaluate(
    () =>
      new Promise<WebVitals>((resolve) => {
        let lcp = 0;
        let cls = 0;
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) lcp = entry.startTime;
        }).observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const shift = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number };
            if (!shift.hadRecentInput) cls += shift.value ?? 0;
          }
        }).observe({ type: "layout-shift", buffered: true });
        // Sammelfenster: LCP/CLS sind kurz nach Load final (keine Nutzer-Eingabe hier).
        setTimeout(() => resolve({ lcp, cls }), 2000);
      }),
  );
}

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
      expect(vitals.lcp, `LCP ${route} sollte unter 4 s (Dev-Budget) liegen`).toBeLessThan(4000);
      expect(vitals.cls, `CLS ${route} sollte unter 0.1 liegen`).toBeLessThan(0.1);
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
    expect(latencyMs).toBeLessThan(1000);
  });
});
