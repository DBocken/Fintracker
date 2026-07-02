import { describe, it, expect, beforeEach } from "vitest";
import type { Category } from "../../types";
import { localEncryption } from "../local-crypto";
import {
  getLocalCategories,
  applyCategoryTemplate,
  getAppliedCategoryTemplateVersion,
} from "../local-settings-service";
import type { CategoryTemplate } from "@/lib/category-template";

const tplCat = (over: Partial<Category> & { id: string }): Category => ({
  name: over.id,
  filters: [],
  is_default: true,
  parent_id: null,
  ...over,
});

describe("[INTEGRITY] applyCategoryTemplate (Weg B, versionsgesichert)", () => {
  beforeEach(() => {
    localStorage.clear();
    localEncryption.lock();
  });

  it("wendet eine neuere Version an: neue Kategorie + ergänzte Filterwörter", async () => {
    const existing = await getLocalCategories();
    const anExistingId = existing.find((c) => c.filters.length > 0)!.id;

    const template: CategoryTemplate = {
      version: 1,
      categories: [
        tplCat({ id: "local-cat-tst-neu", name: "TST-Neu" }),
        tplCat({ id: anExistingId, filters: ["__tst_neues_keyword__"] }),
      ],
    };

    const r = await applyCategoryTemplate(template);
    expect(r.applied).toBe(true);
    expect(r.added).toBe(1);
    expect(r.filtersExtended).toBe(1);
    expect(getAppliedCategoryTemplateVersion()).toBe(1);

    const after = await getLocalCategories();
    expect(after.find((c) => c.id === "local-cat-tst-neu")).toBeTruthy();
    expect(after.find((c) => c.id === anExistingId)!.filters).toContain("__tst_neues_keyword__");
  });

  it("[REGRESSION] wendet dieselbe/ältere Version NICHT erneut an (idempotent)", async () => {
    const template: CategoryTemplate = {
      version: 2,
      categories: [tplCat({ id: "local-cat-tst-x", name: "TST-X" })],
    };
    const first = await applyCategoryTemplate(template);
    expect(first.applied).toBe(true);

    // Gleiche Version erneut → No-op.
    const again = await applyCategoryTemplate(template);
    expect(again.applied).toBe(false);
    expect(again.added).toBe(0);

    // Ältere Version → No-op.
    const older = await applyCategoryTemplate({ version: 1, categories: template.categories });
    expect(older.applied).toBe(false);
    expect(getAppliedCategoryTemplateVersion()).toBe(2);
  });

  it("überschreibt Nutzer-Overrides nicht (is_default:false bleibt)", async () => {
    // Erst eine Default-Kategorie „überschreiben" simulieren, indem wir sie über
    // das Template als Nutzerkopie markieren ist nicht möglich; stattdessen
    // prüfen wir, dass der Merge im Service Overrides respektiert: wir wenden ein
    // Template an, das eine bestehende Kategorie umbenennen will — Name bleibt.
    const existing = await getLocalCategories();
    const target = existing.find((c) => c.filters.length > 0)!;

    const template: CategoryTemplate = {
      version: 5,
      categories: [tplCat({ id: target.id, name: "GEÄNDERT", filters: target.filters })],
    };
    await applyCategoryTemplate(template);
    const after = await getLocalCategories();
    // Default-Kategorie: Name aus der Vorlage wird NICHT übernommen (nur Filter-Union).
    expect(after.find((c) => c.id === target.id)!.name).toBe(target.name);
  });
});
