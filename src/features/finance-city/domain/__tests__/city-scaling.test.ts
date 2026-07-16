import { describe, it, expect } from 'vitest';
import { scaleHeight, scaleFloors } from '../city-scaling';
import type { CityContract } from '../city-model';

describe('scaleHeight', () => {
  describe('Happy Path', () => {
    it('sollte den vollen maxHeight liefern, wenn amount === maxAmount ist', () => {
      expect(scaleHeight(100, 100, 10)).toBeCloseTo(10, 10);
    });

    it('sollte Wurzel-Skalierung anwenden (amount = maxAmount/4 -> halbe Höhe)', () => {
      // sqrt(25/100) * 10 = sqrt(0.25) * 10 = 0.5 * 10 = 5
      expect(scaleHeight(25, 100, 10)).toBeCloseTo(5, 10);
    });

    it('sollte kleine Beträge gegenüber linearer Skalierung sichtbar größer machen', () => {
      // Wurzel-Skalierung: 1% des Betrags ergibt 10% der Höhe (sqrt(0.01) = 0.1), nicht 1%.
      const linear = (1 / 100) * 10;
      const scaled = scaleHeight(1, 100, 10);
      expect(scaled).toBeGreaterThan(linear);
      expect(scaled).toBeCloseTo(1, 10);
    });

    it('sollte streng monoton steigend in amount sein', () => {
      const h1 = scaleHeight(10, 1000, 10);
      const h2 = scaleHeight(50, 1000, 10);
      const h3 = scaleHeight(200, 1000, 10);
      expect(h2).toBeGreaterThan(h1);
      expect(h3).toBeGreaterThan(h2);
    });
  });

  describe('Edge Cases', () => {
    it('sollte 0 liefern, wenn amount <= 0 ist', () => {
      expect(scaleHeight(0, 100, 10)).toBe(0);
      expect(scaleHeight(-5, 100, 10)).toBe(0);
    });

    it('sollte 0 liefern, wenn maxAmount <= 0 ist', () => {
      expect(scaleHeight(10, 0, 10)).toBe(0);
      expect(scaleHeight(10, -1, 10)).toBe(0);
    });

    it('sollte 0 liefern, wenn beide Guards gleichzeitig greifen', () => {
      expect(scaleHeight(-1, -1, 10)).toBe(0);
    });

    it('sollte maxHeight deckeln, wenn amount > maxAmount ist (sqrt > 1)', () => {
      // Kein explizites Clamping gefordert - Spec beschreibt nur amount<=maxAmount-Fall,
      // aber die Formel selbst bleibt konsistent (sqrt(4)*10 = 20).
      expect(scaleHeight(400, 100, 10)).toBeCloseTo(20, 10);
    });
  });
});

describe('scaleFloors', () => {
  function contract(id: string, label: string, amount: number): CityContract {
    return { id, label, amount };
  }

  describe('Happy Path', () => {
    it('sollte Etagen proportional zu ihren Beträgen verteilen und größten Betrag unten stapeln', () => {
      const contracts = [contract('a', 'A', 50), contract('b', 'B', 30), contract('c', 'C', 20)];
      const floors = scaleFloors(contracts, 10);

      expect(floors).toHaveLength(3);
      // größter Betrag (a=50) unten -> kleinstes y
      expect(floors[0].id).toBe('a');
      expect(floors[1].id).toBe('b');
      expect(floors[2].id).toBe('c');
      expect(floors[0].y).toBeLessThan(floors[1].y);
      expect(floors[1].y).toBeLessThan(floors[2].y);

      // proportional: 50/100*10=5, 30/100*10=3, 20/100*10=2 (keine Mindesthöhe nötig, alle > 2%)
      expect(floors[0].height).toBeCloseTo(5, 10);
      expect(floors[1].height).toBeCloseTo(3, 10);
      expect(floors[2].height).toBeCloseTo(2, 10);
    });

    it('sollte amount und label pro Etage aus dem Vertrag übernehmen', () => {
      const contracts = [contract('netflix', 'Netflix', 17.99)];
      const floors = scaleFloors(contracts, 5);
      expect(floors[0]).toMatchObject({ id: 'netflix', label: 'Netflix', amount: 17.99 });
    });
  });

  describe('[REGRESSION] Summen-Invariante', () => {
    it('sollte für die Spec-Streaming-Daten (17.99+10.99+9.99+1.00) exakt barHeight ergeben', () => {
      const contracts = [
        contract('netflix', 'Netflix', 17.99),
        contract('spotify', 'Spotify', 10.99),
        contract('hbo', 'HBO', 9.99),
        contract('apple_tv', 'Apple TV', 1.0),
      ];

      for (const barHeight of [1, 5, 10, 6.283]) {
        const floors = scaleFloors(contracts, barHeight);
        const sum = floors.reduce((acc, f) => acc + f.height, 0);
        expect(sum).toBeCloseTo(barHeight, 10);
      }
    });

    it('sollte apple_tv (1.00 von 39.97 = 2.5% > 2%) NICHT auf die Mindesthöhe anheben', () => {
      const contracts = [
        contract('netflix', 'Netflix', 17.99),
        contract('spotify', 'Spotify', 10.99),
        contract('hbo', 'HBO', 9.99),
        contract('apple_tv', 'Apple TV', 1.0),
      ];
      const barHeight = 10;
      const floors = scaleFloors(contracts, barHeight);
      const appleTv = floors.find((f) => f.id === 'apple_tv')!;
      // 1.00 / 39.97 * 10 = 0.25019...
      expect(appleTv.height).toBeCloseTo((1.0 / 39.97) * barHeight, 10);
      expect(appleTv.height).toBeGreaterThan(0.02 * barHeight);
    });

    it('sollte einen synthetischen 0,5%-Fall auf 2% Mindesthöhe anheben und den Rest proportional stauchen (Summe bleibt exakt barHeight)', () => {
      // total = 200, C = 1 -> 0.5% < 2% -> wird auf 2% angehoben.
      const contracts = [contract('a', 'A', 100), contract('b', 'B', 99), contract('c', 'C', 1)];
      const barHeight = 20;
      const floors = scaleFloors(contracts, barHeight);

      const min = floors.find((f) => f.id === 'c')!;
      expect(min.height).toBeCloseTo(0.02 * barHeight, 10);

      const sum = floors.reduce((acc, f) => acc + f.height, 0);
      expect(sum).toBeCloseTo(barHeight, 10);

      // A und B teilen sich den Rest proportional zu ihren Beträgen (100:99).
      const a = floors.find((f) => f.id === 'a')!;
      const b = floors.find((f) => f.id === 'b')!;
      const remaining = barHeight - min.height;
      expect(a.height).toBeCloseTo((100 / 199) * remaining, 10);
      expect(b.height).toBeCloseTo((99 / 199) * remaining, 10);
    });

    it('sollte auch bei mehreren Mindesthöhen-Etagen in Folge (Kaskade) die Summe exakt halten', () => {
      // a dominiert; b, c, d sind jeweils winzig und würden ohne Kaskade nach der
      // ersten Anhebung immer noch unter 2% liegen.
      const contracts = [
        contract('a', 'A', 970),
        contract('b', 'B', 10),
        contract('c', 'C', 10),
        contract('d', 'D', 10),
      ];
      const barHeight = 15;
      const floors = scaleFloors(contracts, barHeight);
      const sum = floors.reduce((acc, f) => acc + f.height, 0);
      expect(sum).toBeCloseTo(barHeight, 10);
      for (const f of floors.filter((f) => f.id !== 'a')) {
        expect(f.height).toBeCloseTo(0.02 * barHeight, 10);
      }
    });
  });

  describe('Edge Cases', () => {
    it('sollte leeres Array zu leerem Array verarbeiten', () => {
      expect(scaleFloors([], 10)).toEqual([]);
    });

    it('sollte bei barHeight <= 0 ein leeres Array liefern', () => {
      expect(scaleFloors([contract('a', 'A', 10)], 0)).toEqual([]);
      expect(scaleFloors([contract('a', 'A', 10)], -1)).toEqual([]);
    });

    it('sollte bei Gesamtsumme <= 0 ein leeres Array liefern', () => {
      expect(scaleFloors([contract('a', 'A', 0)], 10)).toEqual([]);
    });

    it('sollte eine einzelne Etage exakt auf barHeight setzen', () => {
      const floors = scaleFloors([contract('a', 'A', 42)], 7);
      expect(floors).toHaveLength(1);
      expect(floors[0].height).toBeCloseTo(7, 10);
      expect(floors[0].y).toBeCloseTo(3.5, 10);
    });
  });
});
