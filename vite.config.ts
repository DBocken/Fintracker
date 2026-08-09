import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import dyadComponentTagger from '@dyad-sh/react-vite-component-tagger';

export default defineConfig({
  plugins: [dyadComponentTagger(), react()],
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // WP 5.5b: Rollup zieht `date-fns/locale/en-US` und `/ru` (dynamisch
        // importiert über `src/i18n/date-fns-locales/`) automatisch in
        // eigene Chunks, benannt nach dem Datei-Basisnamen des Pakets
        // ("en-US", "ru") — unabhängig davon, wie die importierende
        // Wrapper-Datei heisst. `chunkName()` (`scripts/bundle-size-core.mjs`)
        // strippt den Build-Hash mit einer Regex, deren Zeichensatz auch
        // Bindestriche einschliesst; bei einem internen Bindestrich VOR dem
        // Hash-Bindestrich ("en-US-<hash>") schneidet sie zu viel weg und der
        // übrig bleibende Name ("en") kollidiert mit dem gleichnamigen
        // i18n-Sprachbaum-Chunk aus `src/i18n/translations/en.ts`
        // (`translation-registry.ts`) — zwei Chunks mit demselben bereinigten
        // Namen überschreiben sich sonst in `check-bundle-size.mjs`s
        // `measured`-Map, und das (weit grössere) Sprachbaum-Budget würde
        // unbemerkt nicht mehr geprüft. `ru` kollidiert identisch mit dem
        // `ru`-Sprachbaum-Chunk. Bindestrichfreie, explizite Chunk-Namen hier
        // umgehen das, ohne die Wächter-Regex selbst anfassen zu müssen.
        manualChunks(id) {
          if (id.endsWith('/date-fns/locale/en-US.js')) return 'dateFnsLocaleEnUS';
          if (id.endsWith('/date-fns/locale/ru.js')) return 'dateFnsLocaleRu';
        },
      },
    },
  },
  server: {
    allowedHosts: true, // Allow all hosts (ngrok, cloudflare, etc.)
    host: true, // Listen on all addresses (0.0.0.0)
    cors: true, // Enable CORS
    // Trust the X-Forwarded headers from ngrok/cloudflare
    proxy: {},
  },
})
