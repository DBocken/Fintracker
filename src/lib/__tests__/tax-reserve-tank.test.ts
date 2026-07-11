import { describe, it, expect } from 'vitest';
import { computeTaxTank } from '../tax-reserve-tank';
import type { TaxReserveMovement } from '@/types';

function mv(amount: number, date = '2025-03-01'): TaxReserveMovement {
  return { id: `mv-${amount}-${date}`, date, amount };
}

describe('computeTaxTank (pure Tank-Mathematik)', () => {
  describe('Zielformel (nie persistiert, immer abgeleitet)', () => {
    it('sollte das Ziel aus YTD-Betriebseinnahmen × Prozent bilden (10.000 × 30 % = 3.000)', () => {
      const tank = computeTaxTank(10000, 30, []);
      expect(tank.target).toBe(3000);
      expect(tank.saved).toBe(0);
      expect(tank.gap).toBe(3000);
      expect(tank.fillRatio).toBe(0);
      expect(tank.overfunded).toBe(false);
    });

    it('sollte Prozent auf 0..100 klemmen', () => {
      expect(computeTaxTank(1000, 150, []).target).toBe(1000);
      expect(computeTaxTank(1000, -10, []).target).toBe(0);
    });

    it('sollte negatives/kein Einkommen als Ziel 0 behandeln (Leerzustand)', () => {
      expect(computeTaxTank(-500, 30, []).target).toBe(0);
      expect(computeTaxTank(0, 30, []).target).toBe(0);
      expect(computeTaxTank(Number.NaN, 30, []).target).toBe(0);
    });
  });

  describe('Movement-Summe (+ zurückgelegt, − Steuer gezahlt)', () => {
    it('sollte Rücklagen und Zahlungen saldieren', () => {
      const tank = computeTaxTank(10000, 30, [mv(2000), mv(500), mv(-800)]);
      expect(tank.saved).toBe(1700);
      expect(tank.gap).toBe(1300);
      expect(tank.fillRatio).toBeCloseTo(1700 / 3000, 5);
    });

    it('sollte eine negative Gesamtsumme ehrlich ausweisen (mehr gezahlt als zurückgelegt)', () => {
      const tank = computeTaxTank(10000, 30, [mv(100), mv(-500)]);
      expect(tank.saved).toBe(-400);
      expect(tank.fillRatio).toBe(0); // Anzeige-Clamp, Daten bleiben ehrlich
      expect(tank.gap).toBe(3400);
    });
  });

  describe('Clamps & Overfunded', () => {
    it('sollte fillRatio auf 1 deckeln und overfunded melden', () => {
      const tank = computeTaxTank(10000, 30, [mv(4000)]);
      expect(tank.fillRatio).toBe(1);
      expect(tank.gap).toBe(0);
      expect(tank.overfunded).toBe(true);
    });

    it('sollte bei Ziel 0 nicht durch 0 teilen (fillRatio 0, kein overfunded)', () => {
      const tank = computeTaxTank(0, 30, [mv(500)]);
      expect(tank.target).toBe(0);
      expect(tank.fillRatio).toBe(0);
      expect(tank.overfunded).toBe(false);
    });

    it('sollte exakt volles Ziel als fillRatio 1 ohne overfunded werten', () => {
      const tank = computeTaxTank(10000, 30, [mv(3000)]);
      expect(tank.fillRatio).toBe(1);
      expect(tank.gap).toBe(0);
      expect(tank.overfunded).toBe(false);
    });
  });
});
