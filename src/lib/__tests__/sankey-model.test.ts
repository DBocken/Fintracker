import { describe, it, expect } from "vitest";
import { buildSankeyModel } from "@/lib/sankey-model";
import type { SankeyData } from "@/lib/analysis-data";

const main = (id: string, amount: number, byAccount: Record<string, number> = {}) => ({ id, name: id, amount, byAccount });
const sub = (id: string, mainId: string, amount: number) => ({ id, name: id, mainId, mainName: mainId, amount, byAccount: {} });
const acc = (id: string, income: number, expenses: number) => ({ id, name: id, income, expenses, net: income - expenses });
const mk = (over: Partial<SankeyData>): SankeyData => ({ totalIncome: 0, accounts: [], mainCategories: [], subCategories: [], ...over });

type Model = ReturnType<typeof buildSankeyModel>;
const idxOf = (m: Model, id: string) => m.nodes.findIndex((n) => n.id === id);
const node = (m: Model, id: string) => m.nodes.find((n) => n.id === id);
const sumOut = (m: Model, id: string) => {
  const i = idxOf(m, id);
  return m.links.filter((l) => l.source === i).reduce((s, l) => s + l.value, 0);
};
const sumIn = (m: Model, id: string) => {
  const i = idxOf(m, id);
  return m.links.filter((l) => l.target === i).reduce((s, l) => s + l.value, 0);
};

describe("sankey-model", () => {
  describe("[REGRESSION] Drilldown-Rest schließt direkt-auf-Hauptkategorie gebuchte Beträge ein", () => {
    // main.amount 800, aber KEINE Unterkategorien (alles direkt auf der Hauptkategorie).
    const data = mk({
      totalIncome: 3000,
      accounts: [acc("a1", 3000, 800)],
      mainCategories: [main("wohnen", 800, { a1: 800 })],
      subCategories: [],
    });

    it("Desktop: Summe(angezeigte Subs) + Rest == main.amount (kein Geld verschwindet)", () => {
      const m = buildSankeyModel(data, { isMobile: false, expandedMainId: "wohnen" });
      expect(node(m, "__rest_wohnen")?.amount).toBe(800);
      expect(sumOut(m, "wohnen")).toBe(800); // ausgehend == Höhe
      expect(sumIn(m, "wohnen")).toBe(800); // eingehend (Konto) == Höhe
    });

    it("Mobil: fokussierte Kategorie als Wurzel, Rest == 800, keine Konten-Knoten", () => {
      const m = buildSankeyModel(data, { isMobile: true, expandedMainId: "wohnen" });
      expect(node(m, "__rest_wohnen")?.amount).toBe(800);
      expect(sumOut(m, "wohnen")).toBe(800);
      expect(m.nodes.some((n) => n.type === "account")).toBe(false);
    });

    it("teilweise Subs: Rest = main.amount − Σ angezeigte Subs (inkl. Direkt-auf-Main)", () => {
      const d = mk({
        totalIncome: 2000,
        accounts: [acc("a1", 2000, 1000)],
        mainCategories: [main("wohnen", 1000, { a1: 1000 })],
        subCategories: [sub("miete", "wohnen", 600)], // 400 direkt auf der Hauptkategorie
      });
      const m = buildSankeyModel(d, { isMobile: true, expandedMainId: "wohnen" });
      expect(node(m, "__rest_wohnen")?.amount).toBe(400);
      expect(sumOut(m, "wohnen")).toBe(1000);
    });
  });

  describe("Mobile Flachansicht – Flusserhaltung & ehrliche Aggregation", () => {
    it("Überschuss: Σ ausgehend(Einnahmen) == totalIncome, Übrig == Überschuss", () => {
      const d = mk({ totalIncome: 3000, mainCategories: [main("a", 1200), main("b", 800)] });
      const m = buildSankeyModel(d, { isMobile: true });
      expect(node(m, "income")).toBeTruthy();
      expect(sumOut(m, "income")).toBe(3000);
      expect(node(m, "__uebrig")?.amount).toBe(1000);
      expect(node(m, "__weitere_mains")).toBeUndefined();
    });

    it("Top-N + Weitere bündelt vollständig (nichts unterschlagen)", () => {
      const mains = Array.from({ length: 7 }, (_, i) => main(`m${i}`, 100));
      const d = mk({ totalIncome: 700, mainCategories: mains });
      const m = buildSankeyModel(d, { isMobile: true, maxMains: 5 });
      // 5 Top-Kategorien einzeln + ein "Weitere"-Bucket über die restlichen 2.
      expect(node(m, "__weitere_mains")?.amount).toBe(200);
      expect(sumOut(m, "income")).toBe(700);
      expect(node(m, "__uebrig")).toBeUndefined(); // ausgeglichen, kein Überschuss
    });

    it("Defizit: kein Einnahmen-Wurzelknoten, kein Übrig (keine erfundene Bilanz)", () => {
      const d = mk({ totalIncome: 1000, mainCategories: [main("a", 900), main("b", 600)] });
      const m = buildSankeyModel(d, { isMobile: true });
      expect(node(m, "income")).toBeUndefined();
      expect(node(m, "__uebrig")).toBeUndefined();
      expect(node(m, "a")).toBeTruthy(); // Kategorien als Wurzeln
    });

    it("totalIncome 0: kein Einnahmen-Knoten, kein Übrig", () => {
      const d = mk({ totalIncome: 0, mainCategories: [main("a", 500)] });
      const m = buildSankeyModel(d, { isMobile: true });
      expect(node(m, "income")).toBeUndefined();
      expect(node(m, "__uebrig")).toBeUndefined();
    });

    it("kein Übrig-Knoten bei vernachlässigbarem Überschuss (nur Rundung)", () => {
      const d = mk({ totalIncome: 1000, mainCategories: [main("a", 333.33), main("b", 333.33), main("c", 333.34)] });
      const m = buildSankeyModel(d, { isMobile: true });
      expect(node(m, "__uebrig")).toBeUndefined();
      // Rundung wird ausgeglichen → Σ ausgehend exakt 1000.
      expect(sumOut(m, "income")).toBe(1000);
    });
  });

  describe("Desktop-Übersicht – Struktur bleibt (Einnahmen → Konten → Kategorien)", () => {
    it("baut Einnahmen-, Konten- und Kategorie-Knoten mit den richtigen Flüssen", () => {
      const d = mk({
        totalIncome: 3000,
        accounts: [acc("a1", 3000, 2000)],
        mainCategories: [main("a", 1200, { a1: 1200 }), main("b", 800, { a1: 800 })],
      });
      const m = buildSankeyModel(d, { isMobile: false });
      expect(node(m, "income")).toBeTruthy();
      expect(node(m, "a1")?.type).toBe("account");
      expect(sumOut(m, "income")).toBe(3000); // Einnahmen → Konto
      expect(sumIn(m, "a")).toBe(1200);
      expect(sumIn(m, "b")).toBe(800);
    });
  });

  it("liefert leeres Modell ohne Hauptkategorien", () => {
    expect(buildSankeyModel(mk({}), {}).nodes).toHaveLength(0);
  });
});
