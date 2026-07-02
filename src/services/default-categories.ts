import { buildDefaultCategories } from "../data/merchant-keywords";

/**
 * Standard-Kategorien für den anonymen Modus (kein Supabase-Zugriff).
 *
 * Wird aus der Taxonomie (data/merchant-keywords.ts) gebaut: Hauptkategorien
 * (parent_id = null) und darunter Unterkategorien mit Keywords. Der Builder ist
 * die gemeinsame Quelle für diese gebündelten Defaults UND das Supabase-Template
 * (scripts/generate-category-template.mjs), damit beide deckungsgleich sind.
 *
 * IDs sind stabil (`local-cat-<slug>`), damit Transaktionen ihre Zuordnung
 * über Sessions behalten.
 */
export const DEFAULT_LOCAL_CATEGORIES = buildDefaultCategories();
