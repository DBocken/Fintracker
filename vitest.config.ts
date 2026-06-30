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
    // trackerverse/ ist ein eigenständiges Workspace mit eigener Vitest-Config
    // (wie mcp-poc vom Root-Lint ausgenommen ist) — nicht vom Root-Runner mitlaufen lassen.
    exclude: [...configDefaults.exclude, "trackerverse/**"],
  },
})
