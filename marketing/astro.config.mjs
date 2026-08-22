// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

import { SITE_URL } from './src/site.mjs';

export default defineConfig({
  site: SITE_URL,
  integrations: [sitemap()],
  vite: {
    css: {
      // Ohne diese Zeile sucht Vite die PostCSS-Konfiguration nach oben und
      // findet die der App (`/postcss.config.js` mit Tailwind) — die gehoert
      // nicht hierher und ist in diesem Paket auch nicht installiert. Die
      // Marketing-Site schreibt bewusst reines CSS mit eigenen Tokens.
      postcss: { plugins: [] },
    },
  },
  build: {
    // Ein einzelnes HTML-Dokument ohne externe Stylesheet-Requests: macht die
    // Seite unabhaengig von einer zweiten Netzwerkrunde und erlaubt es,
    // denselben Build unveraendert als Vorschau zu veroeffentlichen.
    inlineStylesheets: 'always',
  },
});
