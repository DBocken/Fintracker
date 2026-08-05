import { describe, it, expect } from 'vitest';
import { deriveAtmosphere } from '../useAtmosphereState';

describe('deriveAtmosphere', () => {
  it('sollte bei leerem Saldo neutral, steady, intensity 0 liefern', () => {
    const result = deriveAtmosphere({
      monthlyIncome: 0,
      monthlyExpenses: 0,
      hasData: false,
      budgetOvercount: 0,
    });
    expect(result.temperature).toBe('neutral');
    expect(result.intensity).toBe(0);
    expect(result.pulse).toBe('steady');
  });

  it('sollte bei positivem Saldo warm liefern', () => {
    const result = deriveAtmosphere({
      monthlyIncome: 3000,
      monthlyExpenses: 2200,
      hasData: true,
      budgetOvercount: 0,
    });
    expect(result.temperature).toBe('warm');
    expect(result.intensity).toBeGreaterThan(0);
  });

  it('sollte bei stark positivem Saldo intensity ≥ 0.7 liefern', () => {
    const result = deriveAtmosphere({
      monthlyIncome: 5000,
      monthlyExpenses: 2000,
      hasData: true,
      budgetOvercount: 0,
    });
    expect(result.intensity).toBeGreaterThanOrEqual(0.7);
  });

  it('sollte bei negativem Saldo cool liefern', () => {
    const result = deriveAtmosphere({
      monthlyIncome: 2500,
      monthlyExpenses: 3100,
      hasData: true,
      budgetOvercount: 1,
    });
    expect(result.temperature).toBe('cool');
    expect(result.intensity).toBeGreaterThan(0);
  });

  it('sollte bei Saldo ≈ 0 neutral liefern', () => {
    const result = deriveAtmosphere({
      monthlyIncome: 2500,
      monthlyExpenses: 2500,
      hasData: true,
      budgetOvercount: 0,
    });
    expect(result.temperature).toBe('neutral');
  });

  it('[VB-3] sollte bei moderatem Risiko (1 Budget überzogen, aber positiver Saldo) steady liefern', () => {
    const result = deriveAtmosphere({
      monthlyIncome: 3000,
      monthlyExpenses: 2800,
      hasData: true,
      budgetOvercount: 1,
    });
    expect(result.pulse).toBe('steady');
  });

  it('sollte bei akutem Risiko (negativer Saldo + Budget überzogen) alert liefern', () => {
    const result = deriveAtmosphere({
      monthlyIncome: 2000,
      monthlyExpenses: 2800,
      hasData: true,
      budgetOvercount: 2,
    });
    expect(result.pulse).toBe('alert');
    expect(result.temperature).toBe('cool');
  });

  it('sollte intensity zwischen 0 und 1 clampen', () => {
    const result = deriveAtmosphere({
      monthlyIncome: 100000,
      monthlyExpenses: 0,
      hasData: true,
      budgetOvercount: 0,
    });
    expect(result.intensity).toBeLessThanOrEqual(1);
    expect(result.intensity).toBeGreaterThanOrEqual(0);
  });

  it('sollte bei hasData=false immer neutral liefern', () => {
    const result = deriveAtmosphere({
      monthlyIncome: 5000,
      monthlyExpenses: 1000,
      hasData: false,
      budgetOvercount: 0,
    });
    expect(result.temperature).toBe('neutral');
    expect(result.intensity).toBe(0);
  });
});
