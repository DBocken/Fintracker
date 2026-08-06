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
 * - Dev-Server, nicht Preview-Build: Die Performance-Budgets der Spec sind
 *   ausdrücklich Dev-Budgets (LCP < 4 s); die Prod-Messung (< 2.5 s) gehört
 *   in CI mit Build-Preview und ist dort noch nicht verdrahtet.
 * - Visual-Baselines sind plattformgebunden (aktuell nur win32 eingecheckt).
 *   Auf anderen Plattformen schreibt der erste Lauf neue Baselines, statt zu
 *   scheitern — das regelt die Spec selbst, nicht diese Konfiguration.
 */
export default defineConfig({
  testDir: "./e2e-tests",
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
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {},
  },
  webServer: {
    // --strictPort: lieber scheitern als still auf einen anderen Port
    // ausweichen, auf dem baseURL dann ins Leere zeigt.
    command: "pnpm dev --port 5173 --strictPort",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
