import { expect, type Page } from "@playwright/test";

/**
 * WP-4.6 Vertical-Slice-Fixture.
 *
 * Bringt die App durch den REALEN Einstieg (`/willkommen/*`) in den
 * gefüllten Demo-Zustand und aufs Dashboard. Seeding läuft bewusst durch die
 * App selbst (loadDemoData → IndexedDB), nicht am UI vorbei.
 *
 * Bis zum Seiten-Onboarding standen hier drei Helfer, die MODALE Dialoge
 * wegklickten (`dismissOnboarding`, `dismissAllStartDialogs`) — die gibt es
 * nicht mehr: Der Einstieg ist eine Folge von Seiten, und man kommt nicht
 * an ihm vorbei, sondern durch ihn hindurch. Genau deshalb gibt es jetzt
 * EINEN Helfer statt dreier, die sich in ihren Vorbedingungen unterschieden.
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

/** Wohin der jeweilige Weg am Ende des Einstiegs führt. */
const ZIEL: Record<"csv" | "bank" | "demo", RegExp> = {
  csv: /\/csv$/,
  bank: /\/accounts$/,
  demo: /\/dashboard$/,
};

/**
 * Führt den kompletten Einstieg durch — Sprache, Weg, Anrede, Situation
 * (übersprungen, damit auch die Umstände entfallen), Premium, Datenquelle,
 * Tutorial.
 *
 * Jeder Schritt wartet auf die ADRESSE des nächsten und nicht auf eine
 * Animation: Die Auflösung des Abgewählten läuft über echte Zeit, und ein
 * Test, der auf Pixel wartet, wäre genau so lange flackernd wie die Kurve.
 * Die Adresse wechselt erst, wenn der Schritt wirklich durch ist.
 */
export async function completeOnboarding(
  page: Page,
  { source = "demo", tutorial = false }: { source?: "csv" | "bank" | "demo"; tutorial?: boolean } = {},
): Promise<void> {
  await page.goto("/");

  await expect(page).toHaveURL(/\/willkommen\/sprache$/, { timeout: 30_000 });
  await page.getByRole("button", { name: /Deutsch/ }).click();

  await expect(page).toHaveURL(/\/willkommen\/weg$/);
  await page.getByRole("button", { name: /Anonym/ }).click();

  await expect(page).toHaveURL(/\/willkommen\/begruessung$/);
  await page.getByRole("button", { name: "Ohne Namen fortfahren" }).click();

  // „Später entscheiden" überspringt Lebenssituation UND Umstände — ohne
  // Situation hätten die Umstände nichts, was sie ergänzen könnten.
  await expect(page).toHaveURL(/\/willkommen\/situation$/);
  await page.getByRole("button", { name: "Später entscheiden" }).click();

  await expect(page).toHaveURL(/\/willkommen\/premium$/);
  await page.getByRole("button", { name: "Weiter" }).click();

  await expect(page).toHaveURL(/\/willkommen\/start$/);
  const quelle = { csv: /Datei/, bank: /Bank/, demo: /Beispieldaten|umschauen/ }[source];
  await page.getByRole("button", { name: quelle }).first().click();

  await expect(page.getByText("Möchtest du ein Tutorial starten?")).toBeVisible();
  await page
    .getByRole("button", { name: tutorial ? "Tutorial starten" : "Selbst erkunden" })
    .click();

  await expect(page).toHaveURL(ZIEL[source], { timeout: 30_000 });
}

/**
 * Einstieg mit Beispieldaten → Dashboard mit gefülltem Hero als Lade-Anker.
 */
export async function startDemo(page: Page): Promise<void> {
  await completeOnboarding(page, { source: "demo" });
  // Hero ist der Lade-Anker: erst wenn er sichtbar ist, stehen die Daten.
  await expect(page.getByTestId("stat-hero-value")).toBeVisible();
  await dismissTourInvitation(page);
}

/**
 * Einstieg OHNE Beispieldaten — der Weg für Tests, die einen leeren Bestand
 * brauchen (etwa nach „Lokale Daten löschen"). Endet auf der Datei-Seite.
 */
export async function startEmpty(page: Page): Promise<void> {
  await completeOnboarding(page, { source: "csv" });
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
