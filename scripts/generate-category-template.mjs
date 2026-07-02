/**
 * Erzeugt das globale Kategorien-Template (Weg B) aus der Single Source of Truth
 * (src/data/merchant-keywords.ts via DEFAULT_LOCAL_CATEGORIES). Ausgabe ist ein
 * idempotentes SQL-Upsert in public.category_template, das der Client beim
 * nächsten Login/Start additiv anwendet (neue Kategorien/Filterwörter ergänzen,
 * Nutzer-Overrides nie anfassen).
 *
 * Workflow zum Ausrollen neuer Kategorien/Filterwörter OHNE App-Release:
 *   1. Keyword/Kategorie in src/data/merchant-keywords.ts ergänzen.
 *   2. node --experimental-strip-types scripts/generate-category-template.mjs --version=<N>
 *      > supabase/migrations/<ts>_category_template_v<N>.sql
 *      (oder das SQL direkt im Supabase-Dashboard ausführen).
 *   3. Migration/SQL anwenden. Version MUSS höher sein als die letzte.
 *
 * --version=<N> ist optional; ohne Angabe werden Unix-Sekunden verwendet
 * (monoton steigend). payload folgt dem Schema von DEFAULT_LOCAL_CATEGORIES.
 */

import { buildDefaultCategories } from "../src/data/merchant-keywords.ts";

const DEFAULT_LOCAL_CATEGORIES = buildDefaultCategories();

const versionArg = process.argv.find((a) => a.startsWith("--version="));
const version = versionArg
  ? Number(versionArg.slice("--version=".length))
  : Math.floor(Date.now() / 1000);

if (!Number.isInteger(version) || version <= 0) {
  console.error(`Ungültige --version: ${versionArg}`);
  process.exit(1);
}

const payload = { categories: DEFAULT_LOCAL_CATEGORIES };
const payloadJson = JSON.stringify(payload).replace(/'/g, "''");

const out = [];
out.push("-- Globales Kategorien-Template (Weg B). Generiert aus");
out.push("-- src/data/merchant-keywords.ts via scripts/generate-category-template.mjs.");
out.push("-- Idempotent (Upsert auf version). Version MUSS höher sein als die letzte,");
out.push("-- damit Clients es anwenden.");
out.push("");
out.push("INSERT INTO public.category_template (version, payload)");
out.push(`VALUES (${version}, '${payloadJson}'::jsonb)`);
out.push("ON CONFLICT (version) DO UPDATE SET payload = EXCLUDED.payload;");
out.push("");

process.stdout.write(out.join("\n"));
