import { test, expect } from "@playwright/test";

/**
 * Der Weg zurück an den Anfang des Einstiegs.
 *
 * Eigener Spec, weil dieser Knopf die Voraussetzung dafür ist, den Einstieg
 * überhaupt wiederholt ansehen zu können: Bricht er lautlos, fällt es erst
 * auf, wenn jemand den Fluss prüfen will — und dann fehlt ihm der Weg dorthin.
 *
 * Geprüft wird der ganze Bogen bis zur ADRESSE, nicht bis zu einem Pixel: Der
 * Neustart ist erst dann geschehen, wenn der Fluss wirklich wieder bei der
 * Sprachwahl steht (und nicht bei der Lebenssituation, wo `firstRunStep` einen
 * Bestandsnutzer aufsetzen liesse).
 */
import { startDemo } from "./fixtures/vertical-slice";
import { openViaNav } from "./fixtures/finance-snapshot";

test.use({ locale: "de-DE" });

test("Einstieg neu starten fuehrt zurueck zur Sprachwahl", async ({ page }) => {
  await startDemo(page);
  await openViaNav(page, "Einstellungen", "/settings");
  await page.getByRole("button", { name: "Einstieg neu starten" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/bleiben unverändert/)).toBeVisible();
  await dialog.getByRole("button", { name: "Einstieg neu starten" }).click();
  await expect(page).toHaveURL(/\/willkommen\/sprache$/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Wähle deine Sprache" })).toBeVisible();
});
