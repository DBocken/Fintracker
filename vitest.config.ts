import path from "path"
import { configDefaults, defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "./src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    css: false,
    // `e2e-tests/` enthält Playwright-Specs (WP-4.6). Vitests Standard-Glob
    // greift auch `*.spec.ts` und lud sie mit — Playwright bricht dann beim
    // ersten `test.describe()` ab („did not expect test.describe() to be
    // called here"). Die Specs gehören einem eigenen Runner, nicht dieser Suite.
    //
    // `services/` ist dieselbe Fehlerform, ein Verzeichnis weiter (WP 6.2):
    // Der EntitlementService ist ein Node-Dienst mit eigenem Install und
    // eigener `vitest.config.ts` (`environment: 'node'`). Diese Suite läuft in
    // `jsdom` — nachgemessen fielen dort 11 seiner 42 Tests durch, weil die
    // Schlüsselerzeugung der JWT-Prüfung in jsdom nicht dieselbe ist. Kein
    // echter Fehler, nur der falsche Runner.
    exclude: [...configDefaults.exclude, "e2e-tests/**", "services/**"],
    // v8-Coverage-Instrumentierung verdoppelt grob die Laufzeit; rechenintensive
    // Tests (Monte-Carlo-Forecast, PBKDF2/AES) reißen sonst die 5s-Standardgrenze
    // auf langsameren CI-Runnern. 20s gibt Puffer, ohne echte Hänger zu verstecken.
    testTimeout: 20000,
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "html", "lcov"],
      // Testcode, Tooling und reine Typ-/Einstiegsdateien nicht mitzählen.
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/__tests__/**",
        "src/test-utils/**",
        "src/**/*.d.ts",
        "src/main.tsx",
        "src/vite-env.d.ts",
      ],
      // Am Ist-Stand kalibriert (Lines 56.8 / Stmts 56.0 / Branch 50.6 / Fn 48.1),
      // ~4 Punkte Puffer nach unten: hält den Abbau auf, ohne die Suite heute rot
      // zu machen. Bei nachhaltig höherer Abdeckung anheben.
      //
      // DATEI-SCHWELLEN FÜR DIE GELDLOGIK (WP 7.2, TEST-5). Die globalen Werte
      // oben konservieren nur den Durchschnitt — eine Datei, die Geldbeträge
      // rundet, verteilt oder aggregiert, kann darunter beliebig schlecht
      // abgedeckt sein, ohne dass etwas rot wird. Die Einträge darunter sind
      // **Ratschen**: der Wert ist der heute gemessene Stand (nicht ein
      // Wunschwert), er darf nur STEIGEN. Wer einen Zweig hinzufügt, deckt ihn
      // ab oder macht die Suite rot — genau das ist der Zweck.
      //
      // Zuschnitt: Der Plan nennt `analysis-data.ts` als eine Datei; seit WP 6.6
      // (ARCH-6) sind Sankey, Sunburst, Einnahmen-Aufschlüsselung und
      // Wochenmuster nach `lib/chart-data/` ausgezogen. Sie stehen hier mit,
      // weil sie unverändert Beträge summieren und dabei über Vorzeichen und
      // Abgrenzung entscheiden (Einkommens-Korrektur ist keine Ausgabe, ein
      // Übertrag ist keine Einnahme) — eine falsche Zahl dort steht genauso auf
      // dem Bildschirm wie eine falsche Summe im Kern.
      //
      // Global geprüft wird weiterhin ÜBER ALLE Dateien: Vitest zieht
      // glob-getroffene Dateien nicht aus dem globalen Satz heraus.
      thresholds: {
        lines: 52,
        statements: 52,
        branches: 47,
        functions: 44,
        // Rundung, Cent-Konvertierung, deutsche Betragseingabe.
        "src/lib/money.ts": { branches: 100 },
        // Transferbereinigte Summen, Kategorie-Beiträge, Hierarchie-Auflösung.
        "src/lib/analysis-data.ts": { branches: 98.38 },
        // Verbrauch, Ampelschwellen, Budget-Vorschläge.
        "src/lib/budget-logic.ts": { branches: 98.03 },
        // Tagesgenaue Liquiditätsprojektion inkl. Zins und Rücklagen.
        // 97.05 statt 100: die letzten Zweige sind unerreichbare Rückfalllinien
        // (z. B. `balances[id] ?? 0` für ein Konto, das die Engine zuvor selbst
        // in `balances` angelegt hat). Ein Test dafür könnte nur die Engine
        // umgehen und würde nichts Fachliches zusichern.
        "src/lib/forecast.ts": { branches: 97.05 },
        // Invarianten der Split-Buchungen (Summe, Vorzeichen, Waisen).
        "src/services/transaction-allocation-service.ts": { branches: 100 },
        // Diagramm-Aggregation (siehe Zuschnitt oben).
        "src/lib/chart-data/sankey.ts": { branches: 98.71 },
        "src/lib/chart-data/sunburst.ts": { branches: 100 },
        // 92.1: die drei offenen Zweige sind Division-durch-Null-Absicherungen
        // für Gruppen, die nur mit Wert > 0 überhaupt entstehen.
        "src/lib/chart-data/income-breakdown.ts": { branches: 92.1 },
        "src/lib/chart-data/weekday-pattern.ts": { branches: 100 },
      },
    },
  },
})
