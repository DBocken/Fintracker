import { test, expect } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import { startDemo } from "./fixtures/vertical-slice";

/**
 * WP-10.2 — Accessibility über ALLE Screens, nicht nur den Vertical Slice.
 *
 * Der Implementierungsplan nennt für Phase 10 „Accessibility vollständig
 * durchsprechen (bisher nur für den Vertical Slice)". Bisher waren das drei
 * Screens von rund zwanzig — der Rest war schlicht nie geprüft.
 *
 * **Warum ein eigener Spec und keine Erweiterung des Slice-Tests.** Der
 * Slice-Test ist ein Gate mit einer Aussage („dieser eine Weg trägt"); dieser
 * hier ist eine Flächenprüfung. Beides in einem Test hätte zur Folge, dass ein
 * Befund auf einem Nebenscreen das Slice-Gate rot färbt und umgekehrt.
 *
 * **Was scharf ist und was nicht:** `critical` UND `serious` brechen den Lauf,
 * alles darunter wird als Test-Info gemeldet. Die Schwelle liegt bewusst höher
 * als im Slice-Gate: `serious` ist bei axe nicht „fast egal", sondern die
 * Klasse, in der ein Bedienelement ohne Namen, ein fokussierbares Element
 * hinter `aria-hidden` und unlesbare Kontraste landen. Wer das nur meldet,
 * meldet es für immer.
 */

/**
 * Alle Routen, die ein Demo-Nutzer erreichen kann.
 *
 * Einige stehen hinter einem `RouteGuard` (Bereichs-Freischaltung über die
 * Lebenssituation) und leiten dann um. Das ist kein Fehlschlag, sondern der
 * Normalfall — der Test vermerkt es und geht weiter, statt eine Freischaltung
 * zu erzwingen, die es im echten Gebrauch auch nicht gibt.
 */
const ROUTES = [
  "/coach",
  "/dashboard",
  "/transactions",
  "/accounts",
  "/budgets",
  "/debts",
  "/net-worth",
  "/liquidity",
  "/milestones",
  "/income",
  "/tax",
  "/euer",
  "/trading",
  "/city",
  "/contracts",
  "/occasions",
  "/premium",
  "/simulation",
  "/csv",
  "/export",
  "/settings",
  "/privacy",
] as const;

test.describe("Accessibility über alle Screens (WP-10.2)", () => {
  test.use({ locale: "de-DE" });

  // Rund zwanzig Routen mit je einem axe-Lauf — grosszuegiger als der
  // Standard, aber immer noch ein einzelner Test.
  test.setTimeout(300_000);

  test("sollte auf keinem Screen kritische Verstoesse haben", async ({ page }, testInfo) => {
    await startDemo(page);

    const critical: string[] = [];
    const skipped: string[] = [];

    for (const route of ROUTES) {
      await page.goto(route);

      // Umgeleitet? Dann ist der Bereich fuer diese Lebenssituation nicht
      // freigeschaltet — vermerken und weiter.
      if (!page.url().includes(route)) {
        skipped.push(route);
        continue;
      }

      await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });
      // Der Aufbau laeuft datengetrieben (Phase 6/7); ohne kurzes Zuwarten
      // scannt axe den Skeleton-Zustand statt des Inhalts.
      await page.waitForTimeout(700);

      const results = await new AxeBuilder({ page }).analyze();

      const blocking = (v: { impact?: string | null }) =>
        v.impact === "critical" || v.impact === "serious";

      for (const violation of results.violations.filter(blocking)) {
        critical.push(
          `${route}: ${violation.id} (${violation.impact}) — ${violation.helpUrl}\n` +
            violation.nodes
              .slice(0, 3)
              .map(
                (n) =>
                  `    ${n.target.join(" ")}: ${n.html.slice(0, 160)}\n` +
                  // Die gemessenen Werte (etwa das erreichte Kontrastverhaeltnis)
                  // stehen nur hier — ohne sie ist der Bericht eine Fundstelle
                  // ohne Zahl, und die Ursache muss erneut nachgestellt werden.
                  `      ${(n.any ?? []).map((c) => c.message).join(" | ")}`,
              )
              .join("\n"),
        );
      }

      const rest = results.violations.filter((v) => !blocking(v));
      if (rest.length > 0) {
        testInfo.annotations.push({
          type: "a11y-hinweis",
          description: `${route}: ${rest.map((v) => `${v.id} (${v.impact})`).join(", ")}`,
        });
      }
    }

    if (skipped.length > 0) {
      testInfo.annotations.push({
        type: "a11y-uebersprungen",
        description: `Nicht freigeschaltet: ${skipped.join(", ")}`,
      });
    }

    expect(critical, critical.join("\n\n")).toEqual([]);
  });
});
