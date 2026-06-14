import { describe, expect, it } from "vitest";

import { DEFAULT_LOCAL_CATEGORIES } from "./default-categories";

const mains = DEFAULT_LOCAL_CATEGORIES.filter((c) => !c.parent_id);
const subs = DEFAULT_LOCAL_CATEGORIES.filter((c) => c.parent_id);

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
    }
  });

  it("jede Unterkategorie verweist auf eine existierende Hauptkategorie", () => {
    const mainIds = new Set(mains.map((c) => c.id));
    expect(subs.length).toBeGreaterThan(0);
    for (const sub of subs) {
      expect(mainIds.has(sub.parent_id as string)).toBe(true);
    }
  });

  it("Hauptkategorien tragen keine Filter (Keywords liegen auf Unterkategorien)", () => {
    for (const main of mains) {
      expect(main.filters).toEqual([]);
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

  it("bietet feinere Unterkategorien je Hauptkategorie", () => {
    const names = DEFAULT_LOCAL_CATEGORIES.map((c) => c.name);
    expect(names).toContain("Supermarkt");
    expect(names).toContain("Strom & Energie");
    expect(names).toContain("Restaurant");
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

  it("markiert essenzielle Ausgaben (z. B. Miete) und Konsum (z. B. Streaming)", () => {
    const byName = new Map(DEFAULT_LOCAL_CATEGORIES.map((c) => [c.name, c]));
    expect(byName.get("Miete & Hausgeld")?.attributes?.essenziell).toBe(true);
    expect(byName.get("Supermarkt")?.attributes?.essenziell).toBe(true);
    expect(byName.get("Streaming")?.attributes?.essenziell).toBe(false);
    expect(byName.get("Fitnessstudio")?.attributes?.essenziell).toBe(false);
  });
});
