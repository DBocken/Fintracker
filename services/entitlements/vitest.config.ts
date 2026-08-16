import { defineConfig } from "vitest/config";

/**
 * Eigene Suite, eigener Runner.
 *
 * Die Wurzel-Suite (`vitest.config.ts` im Repo-Stamm) schliesst `services/**`
 * ausdrücklich aus — sie läuft in `jsdom` und ohne Postgres, und hätte diese
 * Tests eingesammelt und rot gemacht. Hier gilt `node`.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["__tests__/**/*.test.ts"],
  },
});
