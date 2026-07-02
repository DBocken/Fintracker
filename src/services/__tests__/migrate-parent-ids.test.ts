import { describe, it, expect } from "vitest";
import type { Category } from "@/types";
import { migrateParentIds } from "../local-settings-service";

/**
 * F-CAT: getLocalCategories schrieb die komplette verschlüsselte Kategorienliste
 * bei JEDEM Lesen neu, weil `migrated !== stored` nach .map() immer true war.
 * migrateParentIds meldet `changed` jetzt nur bei echter Ergänzung.
 */
describe("migrateParentIds (F-CAT)", () => {
  it("[REGRESSION] changed=false, wenn alle Kategorien bereits parent_id haben", () => {
    const cats: Category[] = [
      { id: "c1", name: "Wohnen", filters: [], parent_id: null },
      { id: "c2", name: "Miete", filters: [], parent_id: "c1" },
    ];
    const { changed, categories } = migrateParentIds(cats);
    expect(changed).toBe(false);
    // Unveränderte Einträge behalten ihre Referenz (kein unnötiges Kopieren).
    expect(categories[0]).toBe(cats[0]);
    expect(categories[1]).toBe(cats[1]);
  });

  it("changed=true und füllt parent_id, wenn sie fehlt", () => {
    // parent_id fehlt komplett (Bestandsdaten vor der Hierarchie-Migration).
    const legacy = { id: "x", name: "Alt", filters: [] } as Category;
    const { changed, categories } = migrateParentIds([legacy]);
    expect(changed).toBe(true);
    expect(categories[0].parent_id).toBeNull(); // aus Default oder Fallback null
  });

  it("changed=false bei leerer Liste", () => {
    expect(migrateParentIds([]).changed).toBe(false);
  });
});
