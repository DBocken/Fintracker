/**
 * Erzeugt eine idempotente Supabase-Migration aus der Kategorie-Taxonomie
 * (src/data/merchant-keywords.ts). Single Source of Truth für die globalen
 * Standardkategorien (user_id IS NULL): Haupt- + Unterkategorien, Keywords,
 * Farbe/Icon und das `essenziell`-Flag.
 *
 * Aufruf:
 *   node --experimental-strip-types scripts/generate-category-migration.mjs > \
 *     supabase/migrations/<ts>_restructure_categories_hierarchy.sql
 *
 * Idempotent: Inserts via NOT EXISTS, Updates setzen die Soll-Werte. Mehrfach
 * ausführbar ohne Duplikate.
 */

import { CATEGORY_TAXONOMY, isEssenziell } from "../src/data/merchant-keywords.ts";

/** Bekannte Umbenennungen bestehender globaler Hauptkategorien. */
const RENAMES = [["Restaurant & Café", "Essen & Trinken"]];

const sqlStr = (s) => `'${String(s).replace(/'/g, "''")}'`;
const sqlJson = (obj) => `${sqlStr(JSON.stringify(obj))}::jsonb`;
const essAttr = (val) => sqlJson({ essenziell: val });

const out = [];
out.push("-- Strukturiert die globalen Standardkategorien (user_id IS NULL) zu einer");
out.push("-- Haupt-/Unterkategorie-Hierarchie um, verteilt die Keywords auf die");
out.push("-- Unterkategorien und setzt das `essenziell`-Flag (existenzsichernd).");
out.push("-- Generiert aus src/data/merchant-keywords.ts via");
out.push("-- scripts/generate-category-migration.mjs. Idempotent (NOT EXISTS + Updates).");
out.push("");

out.push("-- 1) Umbenennungen bestehender Hauptkategorien");
for (const [from, to] of RENAMES) {
  out.push(
    `UPDATE categories SET name = ${sqlStr(to)} ` +
      `WHERE user_id IS NULL AND name = ${sqlStr(from)} ` +
      `AND NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = ${sqlStr(to)});`,
  );
}
out.push("");

for (const main of CATEGORY_TAXONOMY) {
  out.push(`-- ${main.icon} ${main.name}`);

  // Hauptkategorie anlegen (falls fehlt)
  out.push(
    `INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)`,
  );
  out.push(
    `SELECT ${sqlStr(main.name)}, ${sqlStr(main.color)}, ${sqlStr(main.icon)}, '[]'::jsonb, true, NULL, ${essAttr(main.essenziell)}, NULL`,
  );
  out.push(
    `WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = ${sqlStr(main.name)});`,
  );

  // Hauptkategorie aktualisieren: Filter leeren (Keywords leben auf Unterkategorien),
  // Farbe/Icon/essenziell setzen.
  out.push(
    `UPDATE categories SET color = ${sqlStr(main.color)}, icon = ${sqlStr(main.icon)}, ` +
      `filters = '[]'::jsonb, ` +
      `attributes = COALESCE(attributes, '{}'::jsonb) || ${essAttr(main.essenziell)} ` +
      `WHERE user_id IS NULL AND name = ${sqlStr(main.name)};`,
  );

  for (const sub of main.subcategories) {
    const ess = isEssenziell(main, sub);
    const parentSub = `(SELECT id FROM categories WHERE user_id IS NULL AND name = ${sqlStr(main.name)} LIMIT 1)`;

    // Unterkategorie anlegen (falls fehlt)
    out.push(
      `INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)`,
    );
    out.push(
      `SELECT ${sqlStr(sub.name)}, ${sqlStr(main.color)}, ${sqlStr(main.icon)}, ${sqlJson(sub.keywords)}, true, ${parentSub}, ${essAttr(ess)}, NULL`,
    );
    out.push(
      `WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = ${sqlStr(sub.name)});`,
    );

    // Unterkategorie synchronisieren: Keywords, Parent, Farbe/Icon, essenziell
    out.push(
      `UPDATE categories SET filters = ${sqlJson(sub.keywords)}, color = ${sqlStr(main.color)}, ` +
        `icon = ${sqlStr(main.icon)}, parent_id = ${parentSub}, ` +
        `attributes = COALESCE(attributes, '{}'::jsonb) || ${essAttr(ess)} ` +
        `WHERE user_id IS NULL AND name = ${sqlStr(sub.name)};`,
    );
  }
  out.push("");
}

process.stdout.write(out.join("\n") + "\n");
