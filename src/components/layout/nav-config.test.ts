import { describe, expect, it, beforeEach } from "vitest";

import { NAV_GROUPS, getBottomNavItems, getVisibleNavGroups } from "./nav-config";

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
    const trading = getVisibleNavGroups()
      .flatMap((g) => g.items)
      .find((i) => i.path === "/trading");
    expect(trading).toBeDefined();
    expect(trading?.requiredTier).not.toBe("premium");
  });

  it("lässt alle Nav-Ziele sichtbar", () => {
    const visiblePaths = getVisibleNavGroups().flatMap((g) => g.items).map((i) => i.path);
    const allPaths = NAV_GROUPS.flatMap((g) => g.items).map((i) => i.path);
    expect(visiblePaths).toEqual(allPaths);
  });
});
