import { test, expect } from "@playwright/test";
import { startDemo, dismissAllStartDialogs } from "./fixtures/vertical-slice";
import { openViaNav, readVisibleBookings } from "./fixtures/finance-snapshot";

/**
 * WP 7.3 (TEST-6), Spec 2: Backup exportieren → lokale Daten löschen →
 * reimportieren → Daten identisch.
 *
 * Durch den echten Browser-Pfad: Download-Datei, Gefahrenzone, Reload,
 * Datei-Auswahl im Wiederherstellen-Dialog, zweiter Reload. Bewusst mit
 * ECHTEM Datenverlust dazwischen — die Wiederherstellung ist ein
 * nicht-destruktiver Merge per ID, ein Reimport auf den unveränderten Bestand
 * wäre daher auch dann grün, wenn die Datei gar nichts enthielte.
 *
 * „Identisch" heisst hier: dieselben Buchungen mit denselben Beträgen in
 * derselben Reihenfolge, aus der gerenderten Liste gelesen
 * (`readVisibleBookings`) — nicht „kein Fehler" und nicht „gleiche Anzahl".
 *
 * Exportiert wird der Standardweg der App (verschlüsselt, `.enc.json`); der
 * unverschlüsselte Export ist ausdrücklich die Ausnahme hinter einer Warnung.
 *
 * [REGRESSION] WP 7.3: Bis zu diesem Paket lief die ganze Fläche anonym gegen
 * `requireUserId()` und damit gegen „Nicht angemeldet" — die Karte „Aktueller
 * Datenbestand" zeigte den Lesefehler und der Export lieferte keine Datei.
 * Genau der Normalfall dieser App (local-first, ohne Anmeldung) war damit
 * ohne Sicherung. Keine Unit-Suite konnte das sehen: Alle Backup-Tests mocken
 * `requireUserId` auf eine feste Kennung.
 */

const BACKUP_PASSWORD = "Fintracker-Sicherung-2026!";

test.describe("Backup-Roundtrip (WP 7.3)", () => {
  test.use({ locale: "de-DE" });

  test("sollte ein verschlüsseltes Backup exportieren und nach vollständigem Datenverlust identisch wiederherstellen", async ({
    page,
  }, testInfo) => {
    await startDemo(page);

    const bookingsBefore = await readVisibleBookings(page);
    expect(bookingsBefore.length).toBeGreaterThan(3);

    // ── 1. Export ──
    await openViaNav(page, "Einstellungen", "/settings");

    // Die Bestandskarte ist die erste Stelle, an der „Nicht angemeldet"
    // sichtbar wurde — sie muss zählen, nicht den Lesefehler zeigen.
    const dataCard = page.locator(".ui-card").filter({ hasText: "Aktueller Datenbestand" }).first();
    await expect(dataCard.getByText("Transaktionen")).toBeVisible();
    await expect(dataCard.getByText("Deine Daten konnten nicht geladen werden")).toHaveCount(0);

    await page.locator("#enc-backup-pw").fill(BACKUP_PASSWORD);
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Verschlüsseltes Backup herunterladen" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.enc\.json$/);
    const backupFile = testInfo.outputPath("fintracker-backup.enc.json");
    await download.saveAs(backupFile);

    // ── 2. Echter Datenverlust: lokale Daten löschen (Gefahrenzone) ──
    await page.getByRole("button", { name: "Lokale Daten löschen", exact: true }).click();
    await page.locator("#delete-confirm").fill("löschen");
    await page.getByRole("button", { name: "Endgültig löschen", exact: true }).click();

    // Die Löschung lädt die Seite neu; ohne Anonym-Merker steht wieder der
    // Landing-Screen da. „Kostenlos starten" ist der Einstieg OHNE
    // Beispieldaten — „Demo ansehen" würde neu seeden und den Test entwerten.
    await expect(
      page.getByRole("button", { name: "Kostenlos starten" }),
    ).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: "Kostenlos starten" }).click();
    await dismissAllStartDialogs(page);

    // Der Verlust ist echt: die Seite sagt „noch keine Buchungen", nicht
    // „konnten nicht geladen werden".
    expect(await readVisibleBookings(page)).toEqual([]);
    await expect(page.getByText("Noch keine Buchungen")).toBeVisible();

    // ── 3. Reimport aus der heruntergeladenen Datei ──
    await openViaNav(page, "Einstellungen", "/settings");
    await page.getByRole("button", { name: ".enc.json", exact: true }).click();
    await page.getByRole("button", { name: "Backup hochladen" }).click();
    const restoreDialog = page.getByRole("dialog").filter({ hasText: "Backup wiederherstellen" });
    await expect(restoreDialog).toBeVisible();
    await restoreDialog.locator('input[type="file"]').setInputFiles(backupFile);
    await restoreDialog.locator("#enc-restore-pw").fill(BACKUP_PASSWORD);
    // Die Wiederherstellung lädt die Seite anschliessend SELBST neu (1,5 s
    // nach dem Erfolg). Auf diesen Reload muss gewartet werden, sonst liest
    // der Abgleich unten die Fläche, die gerade weggeräumt wird — und bekommt
    // eine leere Liste, die nichts über das Backup aussagt.
    const reloaded = page.waitForEvent("load");
    await restoreDialog.getByRole("button", { name: "Wiederherstellen", exact: true }).click();

    await expect(page.getByText("Backup erfolgreich wiederhergestellt").first()).toBeVisible({
      timeout: 30_000,
    });
    await reloaded;

    // ── 4. Identisch ──
    const bookingsAfter = await readVisibleBookings(page);
    expect(bookingsAfter).toEqual(bookingsBefore);
  });
});
