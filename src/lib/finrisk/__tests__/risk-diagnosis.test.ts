import { describe, it, expect } from 'vitest';
import { generateRiskDiagnosis } from '../risk-diagnosis';
import type { StressCapacityLevel } from '../scenario-payload-types';

function capacity(value: number, conf = 0.9): StressCapacityLevel {
  return {
    confidenceLevel: conf,
    thresholdAmount: 1000,
    maxAffordableShock: value,
    criticalDay: 10,
    interpretation: `Bei ${(conf * 100).toFixed(0)} % …`,
  };
}

describe('generateRiskDiagnosis', () => {
  describe('Normal Behavior', () => {
    it('sollte den Nicht-Beratungs-Disclaimer enthalten', () => {
      const diag = generateRiskDiagnosis({
        baselineEndP50: 5000,
        scenarioEndP50: 4800,
        stressCapacity: [capacity(2000)],
      });
      expect(diag.summary).toContain('keine Finanzberatung');
    });

    it('sollte das 90 %-Niveau in die Stress-Aussage übernehmen', () => {
      const diag = generateRiskDiagnosis({
        baselineEndP50: 5000,
        scenarioEndP50: 5000,
        stressCapacity: [capacity(1500, 0.8), capacity(900, 0.9), capacity(500, 0.95)],
      });
      expect(diag.summary).toContain('90 %');
      expect(diag.summary).toContain('900');
    });

    it('sollte eine sichtbare Belastung benennen, wenn das Delta stark negativ ist', () => {
      const diag = generateRiskDiagnosis({
        baselineEndP50: 5000,
        scenarioEndP50: 2000,
        stressCapacity: [capacity(0)],
      });
      expect(diag.deltaEndP50).toBe(-3000);
      expect(diag.summary).toContain('belastet');
    });
  });

  describe('Edge Cases', () => {
    it('sollte keine absolute „maximal“-Aussage ohne Sicherheitsniveau treffen', () => {
      const diag = generateRiskDiagnosis({
        baselineEndP50: 5000,
        scenarioEndP50: 4900,
        stressCapacity: [capacity(1000)],
      });
      expect(diag.summary).not.toContain('maximal');
    });

    it('sollte ohne Stress-Capacity dennoch eine valide Diagnose liefern', () => {
      const diag = generateRiskDiagnosis({
        baselineEndP50: 5000,
        scenarioEndP50: 5000,
        stressCapacity: [],
      });
      expect(diag.summary).toContain('keine Finanzberatung');
    });
  });
});
