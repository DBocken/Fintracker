import { expect, type Page } from "@playwright/test";

/**
 * WP 7.3 (TEST-6): Gemeinsamer Daten-Abgleich für die beiden Specs, die
 * Verschlüsselung und Backup durch den echten Browser-Pfad führen.
 *
 * „Daten sind wieder da" wird hier bewusst NICHT als „kein Fehler" oder als
 * blosse Anzahl geprüft, sondern über die tatsächlich gerenderten Buchungen:
 * je Zeile Zahlungsempfänger UND Betrag, in der Reihenfolge der Liste. Genau
 * diese Verwechslung — „geladen" mit „richtig geladen" — ist der Anlass des
 * Zustands-Wächters aus AGENTS.md §9.1: Eine Fläche, die nach einem Lesefehler
 * „noch nichts vorhanden" behauptet, sieht einer leeren Fläche zum Verwechseln
 * ähnlich, und eine Anzahl allein unterscheidet sie nicht.
 */

/** Buchungszeile der Tagesliste: „🛒 ALDI Süd -51,34 €" (Emoji, Empfänger, Betrag). */
const AMOUNT_PATTERN = /-?\d{1,3}(\.\d{3})*,\d{2}\s*€/;

/**
 * Wechselt die Fläche über die Seitennavigation — NICHT über `page.goto()`.
 *
 * Der Unterschied ist bei aktiver Verschlüsselung kein Stilfrage, sondern
 * Verhalten: Der Schlüssel liegt ausschließlich im Speicher des Dokuments
 * (`unlock.passwordHint`: „Nach einem Refresh musst du erneut entsperren").
 * Ein `goto()` lädt das Dokument neu und sperrt den Tresor damit auf dem Weg —
 * eine Prüfung „Daten nach dem Entsperren wieder lesbar" würde so immer auf
 * der Entsperr-Seite landen und nie das prüfen, was sie prüfen soll.
 *
 * Fällt auf `goto()` zurück, wenn keine Navigation da ist (Entsperr-Seite,
 * Landing-Screen) — dort ist der Reload ohnehin der einzige Weg.
 */
export async function openViaNav(page: Page, label: string, path: string): Promise<void> {
  const onTarget = new RegExp(`${path}(\\?|$)`);
  if (onTarget.test(page.url())) return;

  const link = page.getByRole("link", { name: label, exact: true }).first();
  try {
    // Auf das Navigationselement WARTEN statt es einmal zu zählen: Direkt nach
    // einem Routenwechsel steht die Hülle der App noch nicht, und ein "nicht
    // gefunden" in diesem Moment würde in den `goto()`-Zweig fallen — also in
    // genau den Reload, den diese Funktion vermeiden soll.
    await link.waitFor({ state: "visible", timeout: 10_000 });
    await link.click();
  } catch {
    await page.goto(path);
  }
  await expect(page).toHaveURL(onTarget);
}

/**
 * Liest die auf `/transactions` sichtbaren Buchungen als vergleichbare
 * Zeichenketten. Leeres Ergebnis heisst: die Seite zeigt keine Buchung —
 * entweder weil keine da ist oder weil sie nicht gelesen werden konnte. Was
 * davon zutrifft, prüft der Aufrufer über die Aussage der Fläche.
 */
export async function readVisibleBookings(page: Page): Promise<string[]> {
  await openViaNav(page, "Buchungen", "/transactions");
  await expect(page.getByRole("heading", { name: "Buchungen", exact: true })).toBeVisible();
  // Erst wenn die Abfrage steht, ist die Zeilenmenge eine Aussage und kein
  // Zwischenstand. Die Seite endet dabei in genau einem von drei Zuständen —
  // Liste, „noch keine Buchungen" oder Lesefehler; auf alle drei wird
  // gewartet, denn nur das unterscheidet ein leeres Ergebnis von einem noch
  // ladenden (AGENTS.md §9.1).
  await expect(
    page
      .getByRole("searchbox", { name: "Buchungen durchsuchen…" })
      .or(page.getByText("Noch keine Buchungen"))
      .or(page.getByText("Deine Buchungen konnten nicht geladen werden"))
      .first(),
  ).toBeVisible();

  // Die Tagesliste rendert je Tag eine <ul> mit einer <li> je Buchung. Der
  // Betrags-Filter hält Listen anderer Herkunft (Navigation, Hinweise) heraus,
  // ohne dass dafür ein Test-Haken in den Produktivcode müsste.
  const texts = await page.locator("main ul li").allInnerTexts();

  return texts
    .map((text) => text.replace(/\s+/g, " ").trim())
    .filter((text) => AMOUNT_PATTERN.test(text));
}
