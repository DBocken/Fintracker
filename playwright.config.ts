import { defineConfig } from "@playwright/test";

/**
 * Playwright-Runner für die WP-4.6-E2E-Suite (`e2e-tests/`).
 *
 * Die Specs existierten vor dieser Datei — die im Gate dokumentierten
 * Nachweise waren ohne Runner-Konfiguration nicht reproduzierbar
 * (Protokoll-Restpunkt aus der CI-Reparatur vom 2026-08-05).
 *
 * Bewusste Entscheidungen:
 * - KEINE benannten `projects`: Die vorhandenen Visual-Baselines heißen
 *   `<name>-<platform>.png` (ohne Projektnamen). Ein benanntes Projekt würde
 *   alle Baseline-Dateinamen ändern und den Vergleichslauf entwerten.
 * - `workers: 1`: Alle Specs teilen sich einen Dev-Server, und die
 *   Performance-Spec misst LCP/CLS — parallel laufende Visual-/a11y-Specs
 *   würden die Messwerte verfälschen.
 * - Standardziel ist der Dev-Server. `E2E_TARGET=preview` schaltet auf den
 *   Produktions-Build um: nur dort gelten die Prod-Budgets des Plans
 *   (LCP < 2.5 s). Beide Ziele in EINEM Lauf zu messen ginge nicht — die
 *   Budgets unterscheiden sich um den Faktor, den Vites On-the-fly-Transform
 *   kostet.
 * - Visual-Baselines sind plattformgebunden. Verbindlich ist **linux**, weil
 *   dort der CI-Job läuft; die früher zusätzlich eingecheckten
 *   win32-Baselines sind entfallen. Sie waren nach dem Hero- und Karten-Umbau
 *   veraltet und hätten auf einem Windows-Rechner falsch rot gemeldet, ohne
 *   dass irgendein Lauf sie je wieder erneuert hätte. Ein lokaler Lauf auf
 *   einer anderen Plattform schreibt dort neue Baselines, statt zu scheitern —
 *   diese sind lokal und gehören NICHT ins Repository.
 */

/** `preview` misst gegen den Produktions-Build, sonst gilt der Dev-Server. */
const target = process.env.E2E_TARGET === "preview" ? "preview" : "dev";
export default defineConfig({
  testDir: "./e2e-tests",
  // Zwei Erhebungslaeufe, kein Test: Der Motion-Review zeichnet Videos auf, die
  // Bildpruefung nimmt jede Flaeche bei 360 px auf. Beide pruefen nichts und
  // kosten in der regulaeren Suite nur Zeit und Speicherplatz. Je eine
  // Umgebungsvariable schaltet sie gezielt frei.
  testIgnore: [
    ...(process.env.E2E_MOTION_REVIEW === "1" ? [] : ["**/motion-review.spec.ts"]),
    ...(process.env.E2E_SHOTS === "1" ? [] : ["**/all-screens-shots.spec.ts"]),
  ],
  workers: 1,
  // Demo-Seeding durchs reale UI + 9 Full-Page-Screenshots in einem Test —
  // die Playwright-Vorgabe (30 s) reicht dafür nicht.
  timeout: 120_000,
  use: {
    baseURL: "http://localhost:5173",
    // Fehlschläge sollen diagnostizierbar sein, ohne den Lauf zu wiederholen.
    trace: "retain-on-failure",
    // Umgebungen mit vorinstalliertem Chromium (z. B. Remote-Runner ohne
    // Download-Erlaubnis) geben das Binary hierüber vor; ohne die Variable
    // gilt die normale Playwright-Browser-Auflösung.
    //
    // ACHTUNG bei Visual-Baselines: Diese Variable darf NICHT gesetzt sein,
    // wenn Snapshots erzeugt werden. Ein vorinstalliertes Chromium ist in
    // aller Regel eine andere Version als die, die `@playwright/test` selbst
    // mitbringt — und andere Font-Metriken bedeuten anderen Textumbruch und
    // damit andere Seitenhöhen. Genau das ist hier passiert: lokal
    // Chromium 141, in CI 151; die 375-px-Snapshots von Dashboard und Budgets
    // wichen daraufhin um mehr als die erlaubten 5 % ab, obwohl sich am Code
    // nichts geändert hatte. Die Baselines gehören zum Playwright-eigenen
    // Browser — dem, den der CI-Job über `playwright install` bezieht.
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {},
  },
  webServer: {
    // --strictPort: lieber scheitern als still auf einen anderen Port
    // ausweichen, auf dem baseURL dann ins Leere zeigt.
    command:
      target === "preview"
        ? "pnpm build && pnpm preview --port 5173 --strictPort"
        : "pnpm dev --port 5173 --strictPort",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    // Der Preview-Pfad baut zuerst — Typecheck plus Vite-Build brauchen
    // deutlich länger als ein Dev-Serverstart.
    timeout: target === "preview" ? 300_000 : 120_000,
  },
});
