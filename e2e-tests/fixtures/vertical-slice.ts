import { expect, type Page } from "@playwright/test";

/**
 * WP-4.6 Vertical-Slice-Fixture.
 *
 * Bringt die App durchs reale Onboarding in den gefüllten Demo-Zustand und
 * aufs Dashboard. Seeding läuft bewusst durch die App selbst
 * (loadDemoData → IndexedDB), nicht am UI vorbei.
 *
 * Realer Nach-Demo-Zustand (verifiziert): Die App startet auf /coach
 * (Startseite, Route "/" → /coach) und stellt den Onboarding-Dialog
 * (Lebenssituation) davor — er ist der einzige Blocker und wird hier
 * eindeutig beendet ("Später entscheiden" speichert `null`), damit der
 * Slice frei navigierbar ist.
 *
 * Determinismus: Der Demo-Datensatz hängt vom aktuellen Datum ab
 * (demo-data-service.buildDemoDataset — Monatsgrenzen relativ zu `now`).
 * Specs mit Pixel-Vergleich frieren die Zeit zusätzlich via freezeTime() ein.
 */

/** Fester Referenzzeitpunkt für deterministische Demo-Daten. */
export const DEMO_NOW = new Date("2026-01-15T12:00:00.000Z");

/** localStorage-Key aus src/lib/anonymous-mode.ts (App-Einstieg ohne Login). */
export const ANONYMOUS_MODE_KEY = "ausgabentracker_anonymous_started_v1";

/** Tutorial-Einladung (nicht-modaler Banner) wegklicken, falls sie da ist. */
export async function dismissTourInvitation(page: Page): Promise<void> {
  const dismissTour = page.getByRole("button", { name: "Nicht jetzt" });
  try {
    await dismissTour.waitFor({ state: "visible", timeout: 5000 });
    await dismissTour.click();
  } catch {
    // Keine Einladung erschienen — nichts zu tun.
  }
}

/** Onboarding-Dialog + Tutorial-Einladung beenden (idempotent im Testkontext). */
export async function dismissOnboarding(page: Page): Promise<void> {
  const skip = page.getByRole("button", { name: "Später entscheiden" });
  await expect(skip).toBeVisible();
  await skip.click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await dismissTourInvitation(page);
}

/**
 * Onboarding → „Demo ansehen" → Onboarding-Dialog beenden → über die
 * Seitennavigation aufs Dashboard (mit gefülltem Hero als Lade-Anker).
 */
export async function startDemo(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByRole("button", { name: "Demo ansehen" }).click();
  await expect(page).toHaveURL(/\/coach$/);
  await dismissOnboarding(page);
  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  // Hero ist der Lade-Anker: erst wenn er sichtbar ist, stehen die Daten.
  await expect(page.getByTestId("stat-hero-value")).toBeVisible();
  // Die Tutorial-Einladung erscheint kapitelbezogen erst auf dem Dashboard.
  await dismissTourInvitation(page);
}

/**
 * Friert Datum und Timer der Seite ein. Muss VOR dem ersten goto()
 * installiert werden. Danach läuft die Seitenzeit nur noch über
 * page.clock.runFor(ms) weiter — UI-Timer (Signature Moment, Toasts)
 * müssen aktiv abgespielt werden.
 */
export async function freezeTime(page: Page): Promise<void> {
  await page.clock.install({ time: DEMO_NOW });
}

/** Legt über den ersten Budget-Vorschlag ein Budget an (1-Klick-Anlage). */
export async function createBudgetFromSuggestion(page: Page): Promise<void> {
  await page.goto("/budgets");
  // exact: „Vorgeschlagene Budgets" (CardTitle) darf nicht mitmatchen.
  await expect(page.getByRole("heading", { name: "Budgets", exact: true })).toBeVisible();
  const suggestion = page.getByRole("button", { name: /\/Mo\./ }).first();
  await expect(suggestion).toBeVisible();
  await suggestion.click();
  // Vorschlag-Übernahme ist eine Mutation → warten, bis die Kachel da ist.
  await expect(page.getByRole("button", { name: /ausgeschöpft/ }).first()).toBeVisible();
}
