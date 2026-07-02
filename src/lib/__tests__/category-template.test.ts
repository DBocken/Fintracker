import { describe, it, expect } from "vitest";
import type { Category } from "@/types";
import { mergeCategoryTemplate } from "../category-template";

const cat = (over: Partial<Category> & { id: string }): Category => ({
  name: over.id,
  filters: [],
  is_default: true,
  parent_id: null,
  ...over,
});

describe("mergeCategoryTemplate (Weg B, additiv)", () => {
  it("fügt neue Kategorien hinzu (ID lokal unbekannt)", () => {
    const local = [cat({ id: "local-cat-wohnen" })];
    const template = [cat({ id: "local-cat-wohnen" }), cat({ id: "local-cat-neu", name: "Neu" })];
    const r = mergeCategoryTemplate(local, template);
    expect(r.added).toEqual(["local-cat-neu"]);
    expect(r.categories.map((c) => c.id)).toContain("local-cat-neu");
    expect(r.changed).toBe(true);
  });

  it("ergänzt neue Filterwörter bei bestehenden Default-Kategorien (Union)", () => {
    const local = [cat({ id: "local-cat-miete", filters: ["miete"] })];
    const template = [cat({ id: "local-cat-miete", filters: ["miete", "kaltmiete", "hausgeld"] })];
    const r = mergeCategoryTemplate(local, template);
    expect(r.filtersExtended).toEqual(["local-cat-miete"]);
    expect(r.categories[0].filters).toEqual(["miete", "kaltmiete", "hausgeld"]);
  });

  it("[REGRESSION] lässt vom Nutzer überschriebene Kategorien (is_default:false) unangetastet", () => {
    const local = [cat({ id: "local-cat-miete", name: "Meine Miete", filters: ["miete"], is_default: false })];
    const template = [cat({ id: "local-cat-miete", name: "Miete & Hausgeld", filters: ["miete", "kaltmiete"] })];
    const r = mergeCategoryTemplate(local, template);
    expect(r.changed).toBe(false);
    expect(r.categories[0].name).toBe("Meine Miete");
    expect(r.categories[0].filters).toEqual(["miete"]);
  });

  it("löscht oder benennt nie etwas um; unveränderte bleiben referenzgleich", () => {
    const unchanged = cat({ id: "local-cat-x", filters: ["a"] });
    const local = [unchanged];
    const template = [cat({ id: "local-cat-x", filters: ["a"] })]; // identisch → keine Änderung
    const r = mergeCategoryTemplate(local, template);
    expect(r.changed).toBe(false);
    expect(r.categories[0]).toBe(unchanged);
  });

  it("ist idempotent (zweite Anwendung derselben Vorlage ändert nichts)", () => {
    const local = [cat({ id: "local-cat-miete", filters: ["miete"] })];
    const template = [
      cat({ id: "local-cat-miete", filters: ["miete", "kaltmiete"] }),
      cat({ id: "local-cat-neu" }),
    ];
    const first = mergeCategoryTemplate(local, template);
    const second = mergeCategoryTemplate(first.categories, template);
    expect(second.changed).toBe(false);
    expect(second.added).toEqual([]);
    expect(second.filtersExtended).toEqual([]);
  });
});
