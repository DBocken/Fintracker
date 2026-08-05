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
    // e2e-tests/ enthält Playwright-Specs (WP-4.6). Vitests Standard-`include`
    // greift `**/*.spec.ts` und sammelt sie mit ein; beim Import bricht dann
    // jede der vier Dateien mit "Playwright Test did not expect test.describe()
    // to be called here" ab. Gefahren werden sie über playwright-dyad.config.ts.
    // Bewusst als Ergänzung der Defaults statt als Ersatz — sonst fielen
    // node_modules/dist wieder in die Suche.
    exclude: [...configDefaults.exclude, "e2e-tests/**"],
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
      thresholds: { lines: 52, statements: 52, branches: 47, functions: 44 },
    },
  },
})
