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
 *
 * Lag bis WP 6.6 unter `src/services/` — es ist aber reine Fachdatenherkunft
 * ohne I/O, und `src/lib/category-migrations.ts` braucht sie von unten
 * (AGENTS.md §3, „Wohin ein Typ gehört"). Ein Service, der sie speichert,
 * besitzt sie nicht.
 */
export const DEFAULT_LOCAL_CATEGORIES = buildDefaultCategories();
