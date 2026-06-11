import { describe, expect, it } from "vitest";

import { DEFAULT_LOCAL_CATEGORIES } from "./default-categories";

describe("DEFAULT_LOCAL_CATEGORIES", () => {
  it("hat eindeutige, stabile IDs", () => {
    const ids = DEFAULT_LOCAL_CATEGORIES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^local-cat-[a-z]+$/);
    }
  });

  it("hat eindeutige Namen", () => {
    const names = DEFAULT_LOCAL_CATEGORIES.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("ist als Default markiert und gehört keinem Nutzer", () => {
    for (const cat of DEFAULT_LOCAL_CATEGORIES) {
      expect(cat.is_default).toBe(true);
      expect(cat.user_id).toBeNull();
      expect(cat.parent_id).toBeNull();
    }
  });

  it("alle Filter sind kleingeschrieben (Matching ist case-insensitive auf lowercase)", () => {
    for (const cat of DEFAULT_LOCAL_CATEGORIES) {
      for (const filter of cat.filters) {
        expect(filter).toBe(filter.toLowerCase());
        expect(filter.length).toBeGreaterThan(1);
      }
    }
  });

  it("enthält die Kern-Kategorien für deutsche Haushalte", () => {
    const names = DEFAULT_LOCAL_CATEGORIES.map((c) => c.name);
    expect(names).toContain("Einkommen");
    expect(names).toContain("Wohnen");
    expect(names).toContain("Lebensmittel");
    expect(names).toContain("Sonstiges");
  });

  it("Filter sind über alle Kategorien eindeutig (kein Mehrfach-Matching)", () => {
    const all = DEFAULT_LOCAL_CATEGORIES.flatMap((c) => c.filters);
    expect(new Set(all).size).toBe(all.length);
  });

  it("jede Kategorie hat Farbe und Icon", () => {
    for (const cat of DEFAULT_LOCAL_CATEGORIES) {
      expect(cat.color).toMatch(/^#[0-9a-f]{6}$/);
      expect((cat.icon || "").length).toBeGreaterThan(0);
    }
  });
});
