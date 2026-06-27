import { describe, it, expect } from "vitest";
import {
  evaluateSweepGate,
  minBalanceWithinHorizon,
  projectMonthlyInvestment,
} from "@/lib/budget-sweep";

describe("budget-sweep", () => {
  describe("evaluateSweepGate", () => {
    it("sollte den vollen Betrag freigeben, wenn Spielraum reicht", () => {
      const r = evaluateSweepGate({ desiredAmount: 100, projectedMinBalance: 1500, safetyBuffer: 1000 });
      expect(r.safe).toBe(true);
      expect(r.safeAmount).toBe(100);
    });

    it("sollte auf den sicheren Teilbetrag kürzen", () => {
      const r = evaluateSweepGate({ desiredAmount: 800, projectedMinBalance: 1500, safetyBuffer: 1000 });
      expect(r.safe).toBe(true);
      expect(r.safeAmount).toBe(500); // 1500 - 1000 Headroom
      expect(r.reason).toMatch(/sicher abführbar/i);
    });

    it("sollte sperren, wenn der Puffer schon unterschritten würde", () => {
      const r = evaluateSweepGate({ desiredAmount: 100, projectedMinBalance: 900, safetyBuffer: 1000 });
      expect(r.safe).toBe(false);
      expect(r.safeAmount).toBe(0);
    });

    it("sollte den sicheren Betrag auf volle Euro abrunden", () => {
      const r = evaluateSweepGate({ desiredAmount: 1000, projectedMinBalance: 1450.9, safetyBuffer: 1000 });
      expect(r.safeAmount).toBe(450);
    });

    it("sollte bei projectedMinBalance=Infinity (keine Prognosedaten) nicht blockieren", () => {
      const r = evaluateSweepGate({ desiredAmount: 120, projectedMinBalance: Infinity, safetyBuffer: 1000 });
      expect(r.safe).toBe(true);
      expect(r.safeAmount).toBe(120);
    });
  });

  describe("minBalanceWithinHorizon", () => {
    const points = [
      { date: "2026-07-01", balance: 2000 },
      { date: "2026-07-20", balance: 1200 },
      { date: "2026-08-15", balance: 300 }, // 45 Tage nach dem 01.07.
    ];

    it("sollte den Tiefststand im Horizont liefern", () => {
      // 30-Tage-Horizont (bis 31.07.) – der 300er-Punkt am 15.08. zählt noch nicht.
      expect(minBalanceWithinHorizon(points, "2026-07-01", 30)).toBe(1200);
    });

    it("sollte spätere Punkte außerhalb des Horizonts ignorieren", () => {
      // Mit 60 Tagen rückt der 300er-Punkt in den Horizont.
      expect(minBalanceWithinHorizon(points, "2026-07-01", 60)).toBe(300);
    });

    it("sollte ohne Punkte im Fenster +Infinity liefern (keine Restriktion)", () => {
      expect(minBalanceWithinHorizon([], "2026-07-01", 60)).toBe(Infinity);
    });
  });

  describe("projectMonthlyInvestment", () => {
    it("sollte bei Rendite 0 die Summe der Einzahlungen liefern", () => {
      expect(projectMonthlyInvestment(100, 10, 0)).toBe(12000);
    });

    it("sollte mit Zinseszins über den Einzahlungen liegen", () => {
      const fv = projectMonthlyInvestment(100, 10, 5);
      expect(fv).toBeGreaterThan(12000);
      expect(fv).toBeGreaterThan(15000);
      expect(fv).toBeLessThan(16000);
    });
  });
});
