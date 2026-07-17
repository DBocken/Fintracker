---
name: verify
description: Laufzeit-Verifikation von Fintracker-Änderungen (Web-App und Supabase Edge Functions) — Rezepte, die in dieser Umgebung nachweislich funktionieren.
---

# Fintracker verifizieren (Laufzeit, nicht Tests)

## Web-App (Vite)

- `pnpm install --frozen-lockfile` falls `node_modules` fehlt, dann `pnpm dev`
  (Vite, Port 8080 laut `vite.config.ts`) und die betroffene Route im Browser
  (Playwright/Chromium unter `/opt/pw-browsers/chromium`) ansteuern.

## Supabase Edge Functions (Deno) — lokal booten ohne Supabase CLI

Der Runtime-Stack (Deno, deno.land, esm.sh) ist in der Remote-Umgebung nicht
direkt verfügbar; dieses Rezept bootet die **echte, unveränderte** Function
trotzdem als HTTP-Server:

1. **Deno besorgen:** `npm install deno-bin` in einem Scratch-Verzeichnis →
   Binary unter `node_modules/.bin/deno` (deno.land-Download ist vom Proxy
   geblockt, registry.npmjs.org nicht).
2. **Remote-Imports umleiten** (Proxy blockt deno.land/esm.sh) per `deno.json`
   im Scratch-Verzeichnis:
   ```json
   {
     "imports": {
       "https://deno.land/std@0.190.0/http/server.ts": "./std_server_shim.ts",
       "https://esm.sh/@supabase/supabase-js@2.45.0": "npm:@supabase/supabase-js@2.45.0"
     },
     "nodeModulesDir": "auto"
   }
   ```
   `std_server_shim.ts` = 2-Zeilen-Wrapper: `serve(handler, opts)` →
   `Deno.serve({ port: opts.port ?? 8000 }, handler)`. Danach einmal
   `deno install` (mit `NO_PROXY="$NO_PROXY,registry.npmjs.org"`).
3. **Harness:** `globalThis.fetch` VOR dem `import("file:///…/index.ts")`
   patchen und externe Hosts mocken — GoCardless
   (`bankaccountdata.gocardless.com`: token/new, requisitions, balances,
   transactions) und Supabase (`SUPABASE_URL=http://supabase.mock`:
   `/auth/v1/user` mappt Bearer-Token → User; `/rest/v1/<tabelle>` simuliert
   RLS, indem nur Zeilen mit passendem `user_id=eq.…`-Parameter zurückkommen).
   Der Import startet den Server auf :8000.
4. **Fahren:** echte `curl -X POST http://localhost:8000`-Requests mit
   verschiedenen Bearer-Tokens (User A / User B / ohne). Für IDOR-Prüfungen:
   User B mit den IDs von User A → muss 401/403 liefern, nie 200.
5. Env für den Start: `GOCARDLESS_SECRET_ID/KEY` (Dummy), `SUPABASE_URL`,
   `SUPABASE_ANON_KEY` (Dummy), `DENO_CERT=/root/.ccr/ca-bundle.crt`,
   `deno run -A harness.ts`.

Gotchas: `supabase functions serve` (braucht Docker) existiert hier nicht;
`GOCARDLESS_BASE_URL` ist hartkodiert, daher fetch-Patch statt Env-Umleitung.
