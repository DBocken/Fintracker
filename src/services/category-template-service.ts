import { supabase } from "@/integrations/supabase/client";
import type { Category } from "@/types";
import type { CategoryTemplate } from "@/lib/category-template";
import { applyCategoryTemplate, getAppliedCategoryTemplateVersion } from "./local-settings-service";

/**
 * Transport für das globale Kategorien-Template (Weg B): lädt eine einzige,
 * global lesbare Vorlagen-Zeile aus Supabase und wendet sie additiv lokal an.
 *
 * Bewusst weich: Jeder Fehler (offline, kein Supabase, RLS) endet als No-op —
 * die App bleibt local-first und funktioniert ohne dieses Update vollständig.
 * Rohdaten werden vor der Anwendung minimal validiert (kein blindes Casten).
 */

const TEMPLATE_TABLE = "category_template";

function isValidCategory(value: unknown): value is Category {
  const c = value as Partial<Category> | null;
  return !!c && typeof c.id === "string" && typeof c.name === "string" && Array.isArray(c.filters);
}

function parseTemplate(version: unknown, payload: unknown): CategoryTemplate | null {
  if (typeof version !== "number" || !Number.isFinite(version)) return null;
  const cats = (payload as { categories?: unknown } | null)?.categories;
  if (!Array.isArray(cats) || !cats.every(isValidCategory)) return null;
  return { version, categories: cats as Category[] };
}

/** Lädt die aktuelle Template-Zeile (oder null bei Fehler/keine Zeile). */
export async function fetchCategoryTemplate(): Promise<CategoryTemplate | null> {
  try {
    const { data, error } = await supabase
      .from(TEMPLATE_TABLE)
      .select("version, payload")
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return parseTemplate(data.version, data.payload);
  } catch {
    return null;
  }
}

/**
 * Lädt das Template und wendet es an, falls es neuer ist als die lokal gemerkte
 * Version. Aufrufen bei App-Start/Login mit Verbindung — idempotent, additiv,
 * respektiert Nutzer-Overrides. Gibt null zurück, wenn nichts zu tun war.
 */
export async function syncCategoryTemplate(): Promise<
  { applied: boolean; added: number; filtersExtended: number; version: number } | null
> {
  const template = await fetchCategoryTemplate();
  if (!template) return null;
  if (template.version <= getAppliedCategoryTemplateVersion()) return null;
  return applyCategoryTemplate(template);
}
