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
  it("liefert genau 4 Kernziele", () => {
    expect(getBottomNavItems()).toHaveLength(4);
  });

  it("speist sich aus NAV_GROUPS (eine Quelle für Nav, Palette und Bottom-Nav)", () => {
    const navPaths = NAV_GROUPS.flatMap((g) => g.items).map((i) => i.path);
    for (const item of getBottomNavItems()) {
      expect(navPaths).toContain(item.path);
    }
  });

  it("deckt die Kernziele Coach, Schulden, Analyse, Konten ab", () => {
    const paths = getBottomNavItems().map((i) => i.path);
    expect(paths).toEqual(["/coach", "/debts", "/dashboard", "/accounts"]);
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

  it("blendet Beta-Ziele ohne aktives Flag aus", () => {
    const items = getVisibleNavGroups().flatMap((g) => g.items);
    expect(items.map((i) => i.path)).not.toContain("/trading");
  });

  it("lässt alle Nicht-Beta-Ziele sichtbar", () => {
    const visiblePaths = getVisibleNavGroups().flatMap((g) => g.items).map((i) => i.path);
    const nonBetaPaths = NAV_GROUPS.flatMap((g) => g.items)
      .filter((i) => !i.betaFlag)
      .map((i) => i.path);
    expect(visiblePaths).toEqual(nonBetaPaths);
  });
});
