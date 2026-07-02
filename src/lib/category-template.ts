import type { Category } from "@/types";

/**
 * Versioniertes globales Kategorien-Template (Weg B): erlaubt, lokale Kategorien
 * und Filterwörter später zu ergänzen, OHNE App-Release und OHNE Nutzer-Overrides
 * zu zerstören. Die Auslieferung geschieht additiv über Supabase (siehe
 * category-template-service); der Merge hier ist rein und testbar.
 */
export interface CategoryTemplate {
  /** Monoton steigende Version. Ein Client wendet nur höhere Versionen an. */
  version: number;
  /** Vollständige Vorlage im gleichen Schema wie DEFAULT_LOCAL_CATEGORIES. */
  categories: Category[];
}

export interface CategoryMergeResult {
  categories: Category[];
  /** IDs neu hinzugefügter Kategorien. */
  added: string[];
  /** IDs bestehender Kategorien, denen Filterwörter ergänzt wurden. */
  filtersExtended: string[];
  /** Ob sich überhaupt etwas geändert hat (für „nur bei Bedarf schreiben"). */
  changed: boolean;
}

/** Union zweier Keyword-Listen unter Erhalt der Reihenfolge, ohne Duplikate. */
function unionFilters(existing: string[], incoming: string[]): { filters: string[]; added: boolean } {
  const seen = new Set(existing);
  const result = [...existing];
  let added = false;
  for (const f of incoming) {
    if (!seen.has(f)) {
      seen.add(f);
      result.push(f);
      added = true;
    }
  }
  return { filters: result, added };
}

/**
 * Additiver Merge einer Vorlage in die lokalen Kategorien. Regeln:
 *  - Neue Kategorie (ID lokal unbekannt) → wird hinzugefügt.
 *  - Bestehende, NICHT vom Nutzer überschriebene Kategorie (is_default !== false):
 *    neue Filterwörter werden ergänzt (Union); vorhandene bleiben erhalten.
 *  - Vom Nutzer überschriebene Kategorie (is_default === false): bleibt komplett
 *    unangetastet — die Vorlage darf Nutzerentscheidungen nie überschreiben.
 *  - Es wird nie etwas gelöscht oder umbenannt.
 *
 * Rein und deterministisch (keine I/O). Reihenfolge: erst bestehende (in
 * Ursprungsreihenfolge), dann neue Vorlagen-Kategorien.
 */
export function mergeCategoryTemplate(local: Category[], template: Category[]): CategoryMergeResult {
  const byId = new Map(local.map((c) => [c.id, c]));
  const added: string[] = [];
  const filtersExtended: string[] = [];

  const merged = local.map((cat) => {
    const tpl = template.find((t) => t.id === cat.id);
    if (!tpl) return cat;
    // Nutzer-Override niemals anfassen.
    if (cat.is_default === false) return cat;

    const { filters, added: gotNew } = unionFilters(cat.filters ?? [], tpl.filters ?? []);
    if (!gotNew) return cat;
    filtersExtended.push(cat.id);
    return { ...cat, filters };
  });

  for (const tpl of template) {
    if (byId.has(tpl.id)) continue;
    merged.push({ ...tpl });
    added.push(tpl.id);
  }

  return {
    categories: merged,
    added,
    filtersExtended,
    changed: added.length > 0 || filtersExtended.length > 0,
  };
}
