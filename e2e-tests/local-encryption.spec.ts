import { test, expect } from "@playwright/test";
import { startDemo } from "./fixtures/vertical-slice";
import { openViaNav, readVisibleBookings } from "./fixtures/finance-snapshot";

/**
 * WP 7.3 (TEST-6), Spec 1: Verschlüsselung aktivieren → sperren → entsperren.
 *
 * Durch den echten Browser-Pfad: Einstellungen, Sperr-Schaltfläche, Reload,
 * Entsperr-Seite. Gesperrt wird ausdrücklich MANUELL („Sperren"), nicht über
 * den Inaktivitäts-Timer aus WP 3.2 — ein Test, der auf eine Frist wartet,
 * misst die Frist und nicht das Schloss.
 *
 * Geprüft wird beides, was ein Schloss ausmacht: dass es mit der richtigen
 * Passphrase wieder aufgeht UND dass es mit der falschen zubleibt. Der zweite
 * Teil ist der wichtigere — ein Schloss, das jeden hereinlässt, besteht den
 * ersten Teil ebenfalls.
 *
 * Navigiert wird innerhalb der App (siehe `openViaNav`): Der Schlüssel lebt
 * nur im Speicher des Dokuments, ein `page.goto()` sperrt den Tresor auf dem
 * Weg. Genau dieser Unterschied ist im Test einmal ausdrücklich geprüft —
 * der Reload unten MUSS gesperrt bleiben.
 */

const PASSPHRASE = "Fintracker-Tresor-2026!";
const WRONG_PASSPHRASE = "Fintracker-Tresor-2027!";

test.describe("Lokale Verschlüsselung (WP 7.3)", () => {
  // Die App wählt die Sprache über navigator.language — geprüft wird die
  // deutsche Standard-Oberfläche (DEFAULT_LOCALE = 'de'), wie in den
  // bestehenden Specs.
  test.use({ locale: "de-DE" });

  test("sollte aktivieren, manuell sperren und nur mit der richtigen Passphrase wieder lesbar werden", async ({
    page,
  }) => {
    await startDemo(page);

    const bookingsBefore = await readVisibleBookings(page);
    expect(bookingsBefore.length).toBeGreaterThan(3);

    // ── 1. Verschlüsselung aktivieren ──
    await openViaNav(page, "Einstellungen", "/settings");
    await expect(page.getByText("noch nicht eingerichtet")).toBeVisible();
    await page.locator("#enc-password").fill(PASSPHRASE);
    await page.locator("#enc-confirm").fill(PASSPHRASE);
    await page.getByRole("button", { name: "Passphrase einrichten" }).click();
    // Schlüsselableitung + Umschlüsselung des Bestands — bewusst grosszügig.
    await expect(page.getByText("aktiv und entsperrt")).toBeVisible({ timeout: 30_000 });

    // Der Bestand wurde soeben verschlüsselt und muss unverändert lesbar sein.
    expect(await readVisibleBookings(page)).toEqual(bookingsBefore);

    // ── 2. Manuell sperren ──
    await openViaNav(page, "Einstellungen", "/settings");
    await page.getByRole("button", { name: "Sperren", exact: true }).click();
    await expect(page).toHaveURL(/\/unlock/);
    await expect(page.getByRole("heading", { name: "App entsperren" })).toBeVisible();

    // Ein Reload öffnet nichts: der Schlüssel liegt nicht auf dem Gerät.
    await page.reload();
    await expect(page).toHaveURL(/\/unlock/);

    // Und keine Fläche kommt am Schloss vorbei an die Daten.
    await page.goto("/transactions");
    await expect(page).toHaveURL(/\/unlock/);

    // ── 3. Falsche Passphrase: bleibt zu ──
    await page.locator("#unlock-password").fill(WRONG_PASSPHRASE);
    await page.getByRole("button", { name: "Entsperren", exact: true }).click();
    // Die Fläche sagt WARUM sie zubleibt — „Falsches Passwort", nicht bloss
    // ein Nicht-Weiterkommen.
    await expect(page.getByRole("alert").filter({ hasText: "Falsches Passwort" })).toBeVisible();
    await expect(page).toHaveURL(/\/unlock/);
    await expect(page.locator("#unlock-password")).toBeVisible();

    // ── 4. Richtige Passphrase: Daten wieder lesbar ──
    await page.locator("#unlock-password").fill(PASSPHRASE);
    await page.getByRole("button", { name: "Entsperren", exact: true }).click();
    await expect(page).toHaveURL(/\/transactions$/);

    expect(await readVisibleBookings(page)).toEqual(bookingsBefore);
  });
});
