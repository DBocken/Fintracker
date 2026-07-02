import { describe, expect, it } from "vitest";
import type { FinancialHealth } from "@/services/financial-health-service";
import {
  buildLandscapeScene,
  SCENE_HOTSPOTS,
  type LandscapeMetricKey,
} from "../landscape-scene";

function makeHealth(scores: Partial<Record<LandscapeMetricKey, number>>, overall = 50): FinancialHealth {
  return {
    score: overall,
    subScores: Object.entries(scores).map(([key, score]) => ({
      key,
      label: key,
      score,
      explanation: `${key}-Erklärung`,
    })),
    netWorth: {} as FinancialHealth["netWorth"],
    monthlyIncome: 0,
    monthlyExpenses: 0,
    savingsRate: 0,
  };
}

const ALL_SCORES: Record<LandscapeMetricKey, number> = {
  emergency_fund: 50,
  debt: 50,
  savings_rate: 50,
  liquidity: 50,
  contracts: 50,
};

describe("buildLandscapeScene", () => {
  describe("Normal Behavior", () => {
    it("sollte für jede vorhandene Metrik ein Szenen-Element erzeugen", () => {
      const scene = buildLandscapeScene(makeHealth(ALL_SCORES));
      expect(scene.sun).not.toBeNull();
      expect(scene.mountain).not.toBeNull();
      expect(scene.tree).not.toBeNull();
      expect(scene.water).not.toBeNull();
      expect(scene.house).not.toBeNull();
      expect(Object.keys(scene.metrics)).toHaveLength(5);
    });

    it("sollte höhere Sparquote als größeren Baum abbilden (monoton wachsend)", () => {
      const small = buildLandscapeScene(makeHealth({ savings_rate: 10 }));
      const big = buildLandscapeScene(makeHealth({ savings_rate: 90 }));
      expect(big.tree!.growth).toBeGreaterThan(small.tree!.growth);
      // Früchte erst ab mittlerer Stufe — ein Setzling trägt nichts.
      expect(small.tree!.fruitCount).toBe(0);
      expect(big.tree!.fruitCount).toBeGreaterThan(0);
    });

    it("sollte hohen Schulden-Score als kleineren Berg abbilden (invers)", () => {
      const heavyDebt = buildLandscapeScene(makeHealth({ debt: 5 }));
      const almostFree = buildLandscapeScene(makeHealth({ debt: 95 }));
      expect(heavyDebt.mountain!.height).toBeGreaterThan(almostFree.mountain!.height);
    });

    it("sollte den Wasserstand mit dem Liquiditäts-Score steigen lassen", () => {
      const dry = buildLandscapeScene(makeHealth({ liquidity: 0 }));
      const full = buildLandscapeScene(makeHealth({ liquidity: 100 }));
      expect(full.water!.level).toBeGreaterThan(dry.water!.level);
      expect(dry.water!.level).toBeGreaterThan(0); // nie komplett leer (sichtbares Flussbett)
      expect(full.water!.level).toBeLessThanOrEqual(1);
    });

    it("sollte Sonne und Wolken aus dem Notgroschen-Score ableiten", () => {
      const stormy = buildLandscapeScene(makeHealth({ emergency_fund: 10 }));
      const sunny = buildLandscapeScene(makeHealth({ emergency_fund: 95 }));
      expect(stormy.sun!.stormy).toBe(true);
      expect(sunny.sun!.stormy).toBe(false);
      expect(stormy.sun!.cloudCount).toBeGreaterThan(sunny.sun!.cloudCount);
      expect(sunny.sun!.size).toBeGreaterThan(stormy.sun!.size);
    });

    it("sollte Fensterlicht und Kaminrauch aus dem Vertrags-Score ableiten", () => {
      const shaky = buildLandscapeScene(makeHealth({ contracts: 15 }));
      const solid = buildLandscapeScene(makeHealth({ contracts: 85 }));
      expect(shaky.house!.litWindows).toBe(0);
      expect(shaky.house!.hasSmoke).toBe(false);
      expect(solid.house!.litWindows).toBeGreaterThan(0);
      expect(solid.house!.hasSmoke).toBe(true);
    });

    it("sollte die Himmel-Stimmung aus dem Gesamtscore ableiten", () => {
      const bad = buildLandscapeScene(makeHealth(ALL_SCORES, 10));
      const good = buildLandscapeScene(makeHealth(ALL_SCORES, 90));
      expect(bad.overallBucket).toBe("critical");
      expect(good.overallBucket).toBe("excellent");
      expect(bad.sky).not.toEqual(good.sky);
    });

    it("sollte pro Metrik Stufe, Bucket und Statusfarbe mitliefern", () => {
      const scene = buildLandscapeScene(makeHealth({ savings_rate: 85 }));
      const metric = scene.metrics.savings_rate!;
      expect(metric.stage).toBe(5);
      expect(metric.bucket).toBe("excellent");
      expect(metric.color).toBe("hsl(var(--status-excellent))");
    });
  });

  describe("Edge Cases", () => {
    it("sollte ohne health eine neutrale Szene ohne Metrik-Elemente liefern", () => {
      const scene = buildLandscapeScene(undefined);
      expect(scene.sun).toBeNull();
      expect(scene.mountain).toBeNull();
      expect(scene.tree).toBeNull();
      expect(scene.water).toBeNull();
      expect(scene.house).toBeNull();
      expect(Object.keys(scene.metrics)).toHaveLength(0);
      expect(scene.overallBucket).toBe("mid");
    });

    it("sollte unbekannte Metrik-Schlüssel ignorieren", () => {
      const health = makeHealth({ savings_rate: 50 });
      health.subScores.push({ key: "unknown_metric", label: "?", score: 50, explanation: "?" });
      const scene = buildLandscapeScene(health);
      expect(Object.keys(scene.metrics)).toEqual(["savings_rate"]);
    });

    it("sollte Score 0 und 100 innerhalb der Geometrie-Grenzen (0..1) halten", () => {
      const zero = buildLandscapeScene(makeHealth({
        emergency_fund: 0, debt: 0, savings_rate: 0, liquidity: 0, contracts: 0,
      }));
      const hundred = buildLandscapeScene(makeHealth({
        emergency_fund: 100, debt: 100, savings_rate: 100, liquidity: 100, contracts: 100,
      }));
      for (const scene of [zero, hundred]) {
        expect(scene.sun!.size).toBeGreaterThan(0);
        expect(scene.sun!.size).toBeLessThanOrEqual(1);
        expect(scene.mountain!.height).toBeGreaterThan(0);
        expect(scene.mountain!.height).toBeLessThanOrEqual(1);
        expect(scene.tree!.growth).toBeGreaterThan(0);
        expect(scene.tree!.growth).toBeLessThanOrEqual(1);
        expect(scene.water!.level).toBeGreaterThan(0);
        expect(scene.water!.level).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("Regression Protection", () => {
    it("[REGRESSION] sollte fehlende Metriken weglassen statt Platzhalter zu erzeugen (kein Broken-Image-Äquivalent)", () => {
      // Vorher: fehlende PNG-Assets erzeugten Broken Images (Emoji-Fallback nötig).
      // Die dynamische Szene darf für fehlende Metriken gar kein Element liefern.
      const scene = buildLandscapeScene(makeHealth({ liquidity: 60 }));
      expect(scene.water).not.toBeNull();
      expect(scene.sun).toBeNull();
      expect(scene.mountain).toBeNull();
      expect(scene.tree).toBeNull();
      expect(scene.house).toBeNull();
    });

    it("sollte für jede Metrik eine Hotspot-Position definieren", () => {
      const keys: LandscapeMetricKey[] = ["emergency_fund", "debt", "savings_rate", "liquidity", "contracts"];
      for (const key of keys) {
        expect(SCENE_HOTSPOTS[key]).toMatchObject({
          top: expect.stringMatching(/%$/),
          left: expect.stringMatching(/%$/),
        });
      }
    });
  });
});
