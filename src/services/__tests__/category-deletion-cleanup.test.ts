import { describe, it, expect, beforeEach } from "vitest";
import type { Budget } from "../../types";
import { localEncryption } from "../local-crypto";
import { saveLocalCategory } from "../local-settings-service";
import { deleteCategory } from "../category-service";
import { saveBudget, getBudgets } from "../budget-service";
import { upsertMerchantRule, getMerchantRules } from "../merchant-rules-service";

/**
 * F-CAT-DELETE: Das Löschen einer Kategorie hinterließ Zombie-Budgets
 * (category_id/subcategory_ids auf Geist-Kategorien) und Händlerregeln, die auf
 * nicht existierende Kategorien zeigten. deleteCategory räumt jetzt mit auf.
 */
describe("[INTEGRITY] deleteCategory bereinigt Referenzen (F-CAT-DELETE)", () => {
  beforeEach(() => {
    localStorage.clear();
    localEncryption.lock();
  });

  async function seedCategories() {
    // Hauptkategorie mit zwei Unterkategorien.
    const main = await saveLocalCategory({ name: "TST-Freizeit" });
    const subA = await saveLocalCategory({ name: "TST-Kino", parent_id: main.id });
    const subB = await saveLocalCategory({ name: "TST-Sport", parent_id: main.id });
    return { main, subA, subB };
  }

  it("entfernt Budgets mit gelöschter Hauptkategorie", async () => {
    const { main } = await seedCategories();
    await saveBudget({ name: "TST-Freizeit", category_id: main.id, limit: 100 });

    const result = await deleteCategory(main.id);
    expect(result.deletedBudgets).toBe(1);
    expect(await getBudgets()).toHaveLength(0);
  });

  it("streicht gelöschte Unterkategorien aus subcategory_ids", async () => {
    const { subA, subB } = await seedCategories();
    // Budget auf eine ANDERE Hauptkategorie, das subA/subB referenziert.
    const other = await saveLocalCategory({ name: "TST-Sonstiges" });
    await saveBudget({
      name: "TST-Mix",
      category_id: other.id,
      subcategory_ids: [subA.id, subB.id],
      limit: 200,
    } as Partial<Budget>);

    // Nur subA löschen (als eigenständige Kategorie ohne Kinder).
    const result = await deleteCategory(subA.id);
    expect(result.prunedBudgets).toBe(1);
    const budgets = await getBudgets();
    expect(budgets[0].subcategory_ids).toEqual([subB.id]);
  });

  it("löscht Händlerregeln, die auf gelöschte Kategorien zeigen", async () => {
    const { main, subA } = await seedCategories();
    await upsertMerchantRule("kino xyz", subA.id);
    await upsertMerchantRule("anderer haendler", main.id);

    // Hauptkategorie löschen → main + subA + subB verschwinden; beide Regeln weg.
    const result = await deleteCategory(main.id);
    expect(result.deletedRules).toBe(2);
    expect(await getMerchantRules()).toHaveLength(0);
  });

  it("lässt Budgets/Regeln fremder Kategorien unberührt", async () => {
    const { main } = await seedCategories();
    const other = await saveLocalCategory({ name: "TST-Unberuehrt" });
    await saveBudget({ name: "TST-Bleibt", category_id: other.id, limit: 50 });
    await upsertMerchantRule("bleibt haendler", other.id);

    await deleteCategory(main.id);
    expect(await getBudgets()).toHaveLength(1);
    expect(await getMerchantRules()).toHaveLength(1);
  });
});
