import { test, expect } from "@playwright/test";
import { startDemo } from "./fixtures/vertical-slice";
import { ALL_ROUTES } from "./fixtures/routes";
import { CLS_BUDGET, collectWebVitals, lcpBudgetMs } from "./fixtures/web-vitals";

/**
 * WP-10.4 — Performance über ALLE Screens, nicht nur den Vertical Slice.
 *
 * Der Plan verlangt für Phase 10 „Performance vollständig durchsprechen
 * (bisher nur für den Vertical Slice)". Gemessen wurden bislang zwei Routen
 * von zweiundzwanzig: `/dashboard` und `/city`.
 *
 * **Warum ein eigener Spec.** Wie beim a11y-Durchlauf: Das Slice-Gate hat eine
 * Aussage („dieser eine Weg trägt"), diese Prüfung eine andere („kein Screen
 * fällt heraus"). In einem Test würde ein Nebenscreen das Gate rot färben.
 *
 * **Was gemessen wird und was nicht.** LCP und CLS nach einem echten Reload je
 * Route — dieselbe Messung wie im Slice-Gate (`fixtures/web-vitals`). Die
 * Interaktionslatenz bleibt dort: Sie hängt an einem konkreten Weg
 * (Dashboard → Stadt), nicht an einer Route.
 *
 * Beide Werte werden IMMER als Test-Info berichtet, auch bei grünem Lauf. Ein
 * Budget, das nur im Fehlerfall eine Zahl zeigt, verrät nicht, ob ein Screen
 * knapp darunter liegt oder um den Faktor zehn.
 */

const LCP_BUDGET_MS = lcpBudgetMs();

test.describe("Performance über alle Screens (WP-10.4)", () => {
  test.use({ locale: "de-DE" });

  // Zweiundzwanzig Routen mit je einem Reload und einem Sammelfenster von 2 s.
  test.setTimeout(300_000);

  test("sollte auf keinem Screen LCP- oder CLS-Budget reissen", async ({ page }, testInfo) => {
    await startDemo(page);

    const over: string[] = [];
    const skipped: string[] = [];

    for (const route of ALL_ROUTES) {
      await page.goto(route);
      // Erst die Umleitung abwarten: Ein `RouteGuard` leitet im Client um,
      // also NACH `goto`. Wer die Adresse sofort liest, sieht noch die alte
      // und misst denselben Screen ein zweites Mal — genau das ist mit
      // /simulation → /liquidity passiert.
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(300);

      if (!page.url().includes(route)) {
        skipped.push(route);
        continue;
      }

      await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });
      const vitals = await collectWebVitals(page);

      testInfo.annotations.push({
        type: "web-vitals",
        description: `${route}: LCP ${vitals.lcp.toFixed(0)} ms, CLS ${vitals.cls.toFixed(3)}`,
      });

      if (vitals.lcp >= LCP_BUDGET_MS) {
        over.push(`${route}: LCP ${vitals.lcp.toFixed(0)} ms (Budget ${LCP_BUDGET_MS} ms)`);
      }
      if (vitals.cls >= CLS_BUDGET) {
        over.push(`${route}: CLS ${vitals.cls.toFixed(3)} (Budget ${CLS_BUDGET})`);
      }
    }

    if (skipped.length > 0) {
      testInfo.annotations.push({
        type: "perf-uebersprungen",
        description: `Nicht freigeschaltet: ${skipped.join(", ")}`,
      });
    }

    expect(over, over.join("\n")).toEqual([]);
  });
});
