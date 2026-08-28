import path from "path"
import fs from "node:fs"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"
import dyadComponentTagger from '@dyad-sh/react-vite-component-tagger';
import {
  ORT_LAUFZEIT_PREFIX,
  istErlaubteOrtDatei,
  ortLaufzeitDateien,
} from './scripts/ort-laufzeit-core.mjs';

/**
 * Liefert die ONNX-WASM-Laufzeit unter `/ort/` vom eigenen Origin aus —
 * transformers.js würde sie sonst von `cdn.jsdelivr.net` nachladen, und die
 * CSP blockt das zu Recht (Nutzerfund 28.08.: „no available backend found",
 * Modell installiert, Laufzeit unerreichbar). Dieselbe Antwort wie beim
 * Tesseract-Fund im Anbieter-Register: Assets selbst ausliefern.
 *
 * Dev: Middleware direkt aus `node_modules` (der aufgelösten Version, die
 * transformers pinnt). Build: Kopie nach `dist/ort/` — bewusst NICHT nach
 * `dist/assets`, die Dateien laden nur bei aktivierter Stufe 3 und gehören
 * nicht ins Startlast-Budget (`check:bundle-size` misst `dist/assets`).
 */
function ortLaufzeitPlugin(): Plugin {
  return {
    name: 'ort-laufzeit-selbst-gehostet',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? '').split('?')[0];
        if (!url.startsWith(ORT_LAUFZEIT_PREFIX)) return next();
        const name = url.slice(ORT_LAUFZEIT_PREFIX.length);
        if (!istErlaubteOrtDatei(name)) return next();
        const datei = ortLaufzeitDateien().find((d) => d.name === name);
        if (!datei) return next();
        res.setHeader(
          'Content-Type',
          name.endsWith('.mjs') ? 'text/javascript' : 'application/wasm',
        );
        fs.createReadStream(datei.pfad).pipe(res);
      });
    },
    closeBundle() {
      const ziel = path.resolve(process.cwd(), 'dist', 'ort');
      fs.mkdirSync(ziel, { recursive: true });
      for (const { name, pfad } of ortLaufzeitDateien()) {
        fs.copyFileSync(pfad, path.join(ziel, name));
      }
    },
  };
}

export default defineConfig({
  plugins: [dyadComponentTagger(), react(), ortLaufzeitPlugin()],
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
