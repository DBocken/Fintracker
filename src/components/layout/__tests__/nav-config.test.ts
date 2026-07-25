import { describe, expect, it, beforeEach } from "vitest";

import { NAV_GROUPS, getBottomNavItems, getVisibleNavGroups } from "../nav-config";
import {
  ALWAYS_VISIBLE_NAV_PATHS,
  NAV_FEATURE_PATHS,
  resolveFeatureSelection,
  type NavFeatureId,
} from "@/lib/life-situations";

describe("NAV_GROUPS (Issue #42)", () => {
  const allItems = NAV_GROUPS.flatMap((g) => g.items);

  it("hat eindeutige Pfade über alle Gruppen", () => {
    const paths = allItems.map((i) => i.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("enthält keine Entwickler-Werkzeuge in der Hauptnavigation", () => {
    const paths = allItems.map((i) => i.path);
    expect(paths).not.toContain("/performance");
    expect(paths).not.toContain("/backups");
  });

  it("führt Einstellungen als Nav-Ziel (Backups & Performance leben dort)", () => {
    expect(allItems.map((i) => i.path)).toContain("/settings");
  });

  it("hält Schulden und Coach prominent in der ersten Gruppe", () => {
    const firstGroupPaths = NAV_GROUPS[0].items.map((i) => i.path);
    expect(firstGroupPaths).toContain("/coach");
    expect(firstGroupPaths).toContain("/debts");
  });
});

describe("getBottomNavItems (Issue #42)", () => {
  it("liefert die 3 mobilen Kernziele (vor dem Mehr-Tab)", () => {
    expect(getBottomNavItems()).toHaveLength(3);
  });

  it("speist sich aus NAV_GROUPS (eine Quelle für Nav, Palette und Bottom-Nav)", () => {
    const navPaths = NAV_GROUPS.flatMap((g) => g.items).map((i) => i.path);
    for (const item of getBottomNavItems()) {
      expect(navPaths).toContain(item.path);
    }
  });

  it("deckt die Kernziele Heute, Übersicht, Buchungen ab", () => {
    const paths = getBottomNavItems().map((i) => i.path);
    expect(paths).toEqual(["/coach", "/dashboard", "/transactions"]);
  });

  it("trägt kompakte Tab-Beschriftungen", () => {
    for (const item of getBottomNavItems()) {
      expect(item.shortLabel.length).toBeGreaterThan(0);
      expect(item.shortLabel.length).toBeLessThanOrEqual(10);
    }
  });

  it("verlangt für kein Kernziel ein Premium-Tier", () => {
    for (const item of getBottomNavItems()) {
      expect(item.requiredTier).not.toBe("premium");
    }
  });
});

describe("getVisibleNavGroups", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("[REGRESSION] zeigt Trading ohne Beta-Flag und ohne Premium-Gate (Nutzer-Entscheid)", () => {
    // Trading war zuvor doppelt versteckt (trading_beta-Flag + Premium-Tier)
    // und leitete Nutzer verwirrend zum Coach um. Jetzt normal sichtbar.
    const trading = getVisibleNavGroups(false)
      .flatMap((g) => g.items)
      .find((i) => i.path === "/trading");
    expect(trading).toBeDefined();
    expect(trading?.requiredTier).not.toBe("premium");
  });

  it("lässt im Business-Modus alle Nav-Ziele sichtbar", () => {
    const visiblePaths = getVisibleNavGroups(true).flatMap((g) => g.items).map((i) => i.path);
    const allPaths = NAV_GROUPS.flatMap((g) => g.items).map((i) => i.path);
    expect(visiblePaths).toEqual(allPaths);
  });

  describe("businessOnly-Gating (Einzelunternehmer, „Ruhe vor Fülle“)", () => {
    it("versteckt /euer ohne Business-Modus (Default)", () => {
      const paths = getVisibleNavGroups(false).flatMap((g) => g.items).map((i) => i.path);
      expect(paths).not.toContain("/euer");
    });

    it("zeigt /euer im Business-Modus in der Analysen-Gruppe", () => {
      const analysen = getVisibleNavGroups(true).find((g) => g.id === "analysen");
      expect(analysen?.items.map((i) => i.path)).toContain("/euer");
    });

    it("[REGRESSION] versteckt außer businessOnly-Zielen nichts", () => {
      const hidden = NAV_GROUPS.flatMap((g) => g.items)
        .filter((i) => !getVisibleNavGroups(false).flatMap((g) => g.items).some((v) => v.path === i.path));
      expect(hidden.every((i) => i.businessOnly)).toBe(true);
      expect(hidden.map((i) => i.path)).toEqual(["/euer"]);
    });
  });

  describe("Situations-Filter (Onboarding)", () => {
    const visiblePaths = (
      businessMode: boolean,
      features?: readonly NavFeatureId[] | null,
    ): string[] => getVisibleNavGroups(businessMode, features).flatMap((g) => g.items).map((i) => i.path);

    it("[REGRESSION] zeigt ohne gewählte Lebenssituation alles wie bisher (Bestandsnutzer)", () => {
      // null = Onboarding nie durchlaufen. Ein Update darf niemandem
      // stillschweigend die halbe Navigation wegnehmen.
      expect(visiblePaths(false, null)).toEqual(visiblePaths(false));
      expect(visiblePaths(true, undefined)).toEqual(visiblePaths(true));
    });

    it("versteckt nicht gewählte Bereiche in der Navigation", () => {
      const paths = visiblePaths(false, ["budgets", "milestones"]);
      expect(paths).toContain("/budgets");
      expect(paths).toContain("/milestones");
      expect(paths).not.toContain("/trading");
      expect(paths).not.toContain("/net-worth");
    });

    it("hält Kernbereiche auch bei leerer Auswahl sichtbar", () => {
      const paths = visiblePaths(false, []);
      for (const corePath of ALWAYS_VISIBLE_NAV_PATHS) {
        expect(paths).toContain(corePath);
      }
    });

    it("[REGRESSION] lässt die mobilen Bottom-Nav-Ziele nie verschwinden", () => {
      // getBottomNavItems() zieht seine Ziele aus NAV_GROUPS — fehlt eines,
      // verliert die Bottom-Nav kommentarlos einen Tab.
      const paths = visiblePaths(false, []);
      for (const item of getBottomNavItems()) {
        expect(paths).toContain(item.path);
      }
    });

    it("hält den Rückweg in die Einstellungen offen (sonst sperrt man sich aus)", () => {
      expect(visiblePaths(false, [])).toContain("/settings");
    });

    it("blendet EÜR nur ein, wenn Feature UND Business-Modus gesetzt sind", () => {
      expect(visiblePaths(false, ["euer"])).not.toContain("/euer");
      expect(visiblePaths(true, [])).not.toContain("/euer");
      expect(visiblePaths(true, ["euer"])).toContain("/euer");
    });

    it("zeigt für eine Lebenssituation genau deren Bereiche plus die Kernbereiche", () => {
      const { features, settings } = resolveFeatureSelection("student_school", []);
      const paths = visiblePaths(Boolean(settings.business_mode), features);
      const expected = [
        ...ALWAYS_VISIBLE_NAV_PATHS,
        ...features.map((f) => NAV_FEATURE_PATHS[f]),
      ].sort();
      expect([...paths].sort()).toEqual(expected);
    });

    it("lässt keine leeren Gruppen in der Navigation zurück", () => {
      for (const group of getVisibleNavGroups(false, [])) {
        expect(group.items.length).toBeGreaterThan(0);
      }
    });
  });
});
