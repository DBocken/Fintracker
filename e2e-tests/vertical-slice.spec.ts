import { test, expect } from "@playwright/test";
import { startDemo, createBudgetFromSuggestion } from "./fixtures/vertical-slice";

/**
 * WP-4.6: Vertical Slice Integration Test — Hauptfluss.
 *
 * Onboarding → Dashboard → Finanzstadt → Budget → Budget-Detail → Zurück.
 * Validiert, dass die in WP-2.x/3.x/4.x gebauten Systeme (Hero-Hierarchie,
 * Shared-Element-Links, Atmosphäre, Budget-Tanks mit Detail-Dialog) als
 * Ganzes funktionieren.
 */
test.describe("Vertical Slice (WP-4.6)", () => {
  // Die App wählt die Sprache über navigator.language — die Specs prüfen die
  // deutsche Standard-Oberfläche (DEFAULT_LOCALE = 'de').
  test.use({ locale: "de-DE" });

  test("sollte den Slice Onboarding → Dashboard → Stadt → Budget → Detail → Zurück durchlaufen", async ({
    page,
  }) => {
    // ── 1. Einstieg: /willkommen durchlaufen → Demo-Einstieg ──
    // (startDemo: Sprache → anonym → Anrede → Situation → Premium →
    //  Beispieldaten → „Selbst erkunden" →
    // Seitennavigation aufs Dashboard — der reale Erstnutzer-Pfad.)
    // Der Erstbesucher landet auf der Sprachwahl — nicht auf einer
    // Anmeldeseite und nicht in der App.
    await page.goto("/");
    await expect(page).toHaveURL(/\/willkommen\/sprache$/);
    await expect(page.getByRole("heading", { name: "Wähle deine Sprache" })).toBeVisible();
    await startDemo(page);

    // ── 2. Dashboard: Hero-Hierarchie (WP-4.1, Befund A-1) ──
    // Genau ein dominantes Element: der Kontostand-Hero (56px ab sm-Breakpoint).
    // Entscheidung des Auftraggebers (2026-08-06): Hero = aktueller Kontostand,
    // der Zeitraum-Saldo ist Nebenkennzahl (Dashboard.hero.test.tsx).
    const hero = page.getByTestId("stat-hero-value");
    await expect(hero).toBeVisible();
    await expect(page.getByText("Aktueller Kontostand", { exact: true })).toBeVisible();
    const heroFontSize = await hero.evaluate((el) =>
      Number.parseFloat(getComputedStyle(el).fontSize),
    );
    expect(heroFontSize).toBe(56);

    // Motion-/Material-Tokens sind als CSS-Variablen aktiv (WP-2.1/WP-3.5).
    const tokenCheck = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement);
      return {
        motionFast: style.getPropertyValue("--motion-duration-fast").trim(),
        shadowAmbient: style.getPropertyValue("--shadow-ambient").trim(),
      };
    });
    expect(tokenCheck.motionFast).not.toBe("");
    expect(tokenCheck.shadowAmbient).not.toBe("");

    // ── 3. Dashboard → Finanzstadt (WP-4.5, Shared-Element-Link) ──
    await page.getByRole("link", { name: "Zur Finanzstadt" }).click();
    await expect(page).toHaveURL(/\/city$/);
    await expect(page.getByRole("heading", { name: "Finanzstadt" })).toBeVisible();
    // 3D-Fläche mit echten Demo-Daten. `role="group"`, nicht `img`: In der
    // Fläche liegen Distrikt-Labels und im Störfall die Ausweich-Knöpfe —
    // als Bild deklariert wären die für Hilfstechnik unerreichbar (WP-10.2).
    await expect(
      page.getByRole("group", { name: "3D-Ansicht der Finanzstadt" }),
    ).toBeVisible({ timeout: 15000 });

    // Signature Moment (WP-5.5) beim ersten Besuch: Text-Overlay nach dem Aufbau.
    await expect(page.getByText("Das ist Ihre finanzielle Welt.")).toBeVisible({
      timeout: 15000,
    });

    // ── 4. Budget anlegen (Vorschlag übernehmen) → Kachel erscheint ──
    await createBudgetFromSuggestion(page);

    // ── 5. Budget-Detail: Shared-Element-Transition (WP-4.4) öffnet Dialog ──
    await page.getByRole("button", { name: /ausgeschöpft/ }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // Detailansicht zeigt Gesundheits-Badge mit Prozent und Kennzahlen.
    await expect(dialog.getByText(/\d+\s*%/).first()).toBeVisible();
    await expect(dialog.getByText("Ausgegeben")).toBeVisible();

    // ── 6. Zurück: Dialog schließen → Budget-Liste; Loop zurück zum Dashboard ──
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: /ausgeschöpft/ }).first()).toBeVisible();

    await page.goto("/dashboard");
    await expect(page.getByTestId("stat-hero-value")).toBeVisible();
  });
});
