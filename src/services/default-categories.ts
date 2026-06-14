import type { Category } from "../types";
import { CATEGORY_TAXONOMY, isEssenziell } from "../data/merchant-keywords";

/**
 * Standard-Kategorien für den anonymen Modus (kein Supabase-Zugriff).
 *
 * Wird aus der Taxonomie (data/merchant-keywords.ts) generiert:
 * Hauptkategorien (parent_id = null) und darunter Unterkategorien
 * (parent_id = ID der Hauptkategorie). Die Keywords liegen auf der
 * Unterkategorie-Ebene; Hauptkategorien tragen keine Filter, damit das
 * spezifischere Match in categorizeTransaction gewinnt.
 *
 * IDs sind stabil (`local-cat-<slug>`), damit Transaktionen ihre Zuordnung
 * über Sessions behalten.
 */
export const DEFAULT_LOCAL_CATEGORIES: Category[] = CATEGORY_TAXONOMY.flatMap((main) => {
  const mainId = `local-cat-${main.slug}`;

  const mainCategory: Category = {
    id: mainId,
    user_id: null,
    name: main.name,
    color: main.color,
    icon: main.icon,
    filters: [],
    is_default: true,
    parent_id: null,
    attributes: { essenziell: main.essenziell },
  };

  const subCategories: Category[] = main.subcategories.map((sub) => ({
    id: `local-cat-${sub.slug}`,
    user_id: null,
    name: sub.name,
    color: main.color,
    icon: main.icon,
    filters: sub.keywords,
    is_default: true,
    parent_id: mainId,
    attributes: { essenziell: isEssenziell(main, sub) },
  }));

  return [mainCategory, ...subCategories];
});
