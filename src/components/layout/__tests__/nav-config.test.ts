import { describe, expect, it, beforeEach } from "vitest";

import { NAV_GROUPS, getBottomNavItems, getVisibleNavGroups } from "../nav-config";
import {
  ALWAYS_VISIBLE_NAV_PATHS,
  DEFAULT_OFF_FEATURES,
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
  it("liefert die 4 mobilen Kernziele (vor dem Mehr-Tab)", () => {
    // Vier plus „Mehr" ist das Maximum — danach ist die Leiste auf 375 px zu.
    expect(getBottomNavItems()).toHaveLength(4);
  });

  it("speist sich aus NAV_GROUPS (eine Quelle für Nav, Palette und Bottom-Nav)", () => {
    const navPaths = NAV_GROUPS.flatMap((g) => g.items).map((i) => i.path);
    for (const item of getBottomNavItems()) {
      expect(navPaths).toContain(item.path);
    }
  });

  it("deckt die Kernziele Heute, Übersicht, Stadt, Buchungen ab", () => {
    const paths = getBottomNavItems().map((i) => i.path);
    expect(paths).toEqual(["/coach", "/dashboard", "/city", "/transactions"]);
  });

  it("[REGRESSION] verliert kein Ziel, egal wie eng beide Achsen stehen", () => {
    // Alle Ziele der Leiste sind Kernbereiche — genau deshalb darf keine
    // Bereichsauswahl und keine Freischaltung sie antasten. Die Pruefung im
    // Filter ist Vorsorge fuer kuenftige Eintraege, nicht fuer die heutigen.
    const expected = ["/coach", "/dashboard", "/city", "/transactions"];
    expect(getBottomNavItems([], []).map((i) => i.path)).toEqual(expected);
    expect(getBottomNavItems(null, null).map((i) => i.path)).toEqual(expected);
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
  const visiblePaths = (features?: readonly NavFeatureId[] | null): string[] =>
    getVisibleNavGroups(features).flatMap((g) => g.items).map((i) => i.path);

  beforeEach(() => {
    localStorage.clear();
  });

  it("[REGRESSION] zeigt Trading ohne Beta-Flag und ohne Premium-Gate (Nutzer-Entscheid)", () => {
    // Trading war zuvor doppelt versteckt (trading_beta-Flag + Premium-Tier)
    // und leitete Nutzer verwirrend zum Coach um. Jetzt normal sichtbar.
    const trading = getVisibleNavGroups()
      .flatMap((g) => g.items)
      .find((i) => i.path === "/trading");
    expect(trading).toBeDefined();
    expect(trading?.requiredTier).not.toBe("premium");
  });

  describe("EÜR als Opt-in-Bereich (Einzelunternehmer, „Ruhe vor Fülle“)", () => {
    it("[REGRESSION] versteckt /euer ohne getroffene Auswahl", () => {
      // Früher über den businessOnly-Sonderweg, jetzt über DEFAULT_OFF_FEATURES —
      // das Verhalten für Bestandsnutzer muss identisch bleiben.
      expect(visiblePaths(null)).not.toContain("/euer");
    });

    it("zeigt /euer in der Analysen-Gruppe, sobald der Bereich gewählt ist", () => {
      const analysen = getVisibleNavGroups(["euer"]).find((g) => g.id === "analysen");
      expect(analysen?.items.map((i) => i.path)).toContain("/euer");
    });

    it("[REGRESSION] versteckt ohne Auswahl außer /euer nichts", () => {
      const hidden = NAV_GROUPS.flatMap((g) => g.items)
        .map((i) => i.path)
        .filter((path) => !visiblePaths(null).includes(path));
      expect(hidden).toEqual(["/euer"]);
    });

    it("führt kein zweites Gating mehr neben der Bereichsauswahl", () => {
      // Der businessOnly-Sonderweg ist ersatzlos entfallen: ein Mechanismus.
      expect(NAV_GROUPS.flatMap((g) => g.items).every((i) => !("businessOnly" in i))).toBe(true);
    });
  });

  describe("Situations-Filter (Onboarding)", () => {
    it("[REGRESSION] zeigt ohne gewählte Lebenssituation alles außer den Opt-in-Bereichen", () => {
      // null = Onboarding nie durchlaufen. Ein Update darf niemandem
      // stillschweigend die halbe Navigation wegnehmen.
      const all = NAV_GROUPS.flatMap((g) => g.items).map((i) => i.path);
      const optIn = DEFAULT_OFF_FEATURES.map((f) => NAV_FEATURE_PATHS[f]);
      expect(visiblePaths(null)).toEqual(all.filter((p) => !optIn.includes(p)));
      expect(visiblePaths(undefined)).toEqual(visiblePaths(null));
    });

    it("versteckt nicht gewählte Bereiche in der Navigation", () => {
      const paths = visiblePaths(["budgets", "milestones"]);
      expect(paths).toContain("/budgets");
      expect(paths).toContain("/milestones");
      expect(paths).not.toContain("/trading");
      expect(paths).not.toContain("/net-worth");
    });

    it("hält Kernbereiche auch bei leerer Auswahl sichtbar", () => {
      const paths = visiblePaths([]);
      for (const corePath of ALWAYS_VISIBLE_NAV_PATHS) {
        expect(paths).toContain(corePath);
      }
    });

    it("[REGRESSION] lässt die mobilen Bottom-Nav-Ziele nie verschwinden", () => {
      // getBottomNavItems() zieht seine Ziele aus NAV_GROUPS — fehlt eines,
      // verliert die Bottom-Nav kommentarlos einen Tab.
      const paths = visiblePaths([]);
      for (const item of getBottomNavItems()) {
        expect(paths).toContain(item.path);
      }
    });

    it("hält den Rückweg in die Einstellungen offen (sonst sperrt man sich aus)", () => {
      expect(visiblePaths([])).toContain("/settings");
    });

    it("zeigt für eine Lebenssituation genau deren Bereiche plus die Kernbereiche", () => {
      const { features } = resolveFeatureSelection("student_school", []);
      const expected = [
        ...ALWAYS_VISIBLE_NAV_PATHS,
        ...features.map((f) => NAV_FEATURE_PATHS[f]),
      ].sort();
      expect([...visiblePaths(features)].sort()).toEqual(expected);
    });

    it("lässt keine leeren Gruppen in der Navigation zurück", () => {
      for (const group of getVisibleNavGroups([])) {
        expect(group.items.length).toBeGreaterThan(0);
      }
    });
  });
});
