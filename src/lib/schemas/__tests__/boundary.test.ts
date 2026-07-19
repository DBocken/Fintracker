import { describe, it, expect } from 'vitest';
import {
  parseAtBoundary,
  safeParseAtBoundary,
  BoundaryValidationError,
  replacementPlanSchema,
  contractRecordSchema,
  householdSettlementSchema,
} from '../index';

describe('parseAtBoundary', () => {
  it('sollte gültige ReplacementPlan-Daten parsen', () => {
    const value = {
      id: 'rp-1',
      name: 'Waschmaschine',
      replacement_cost_minor: 65000,
      lifespan_months: 120,
    };
    expect(parseAtBoundary(replacementPlanSchema, value, 'ReplacementPlan')).toMatchObject(value);
  });

  it('sollte gültige ContractRecord-Daten parsen', () => {
    const value = { id: 'cr-1', name: 'Stromvertrag', fingerprint: 'iban:DE…' };
    expect(parseAtBoundary(contractRecordSchema, value, 'ContractRecord')).toMatchObject(value);
  });

  it('sollte gültige HouseholdSettlement-Daten parsen', () => {
    const value = {
      id: 's-1',
      household_id: 'h-1',
      from_member_id: 'a',
      to_member_id: 'b',
      amount_minor: 1500,
      date: '2026-07-19',
    };
    expect(parseAtBoundary(householdSettlementSchema, value, 'HouseholdSettlement')).toMatchObject(
      value,
    );
  });

  it('[INTEGRITY] sollte ungültige Eingabe an der Datengrenze ablehnen (Invariante 18)', () => {
    const invalid = { id: 'rp-1' }; // name + Betrag fehlen
    expect(() => parseAtBoundary(replacementPlanSchema, invalid, 'ReplacementPlan')).toThrow(
      BoundaryValidationError,
    );
  });

  it('[INTEGRITY] sollte ein teilweise gültiges Objekt vollständig ablehnen, nicht partiell übernehmen', () => {
    const partial = { id: 'rp-1', name: 'Kühlschrank', replacement_cost_minor: -5, lifespan_months: 120 }; // negativ unzulässig
    const result = safeParseAtBoundary(replacementPlanSchema, partial, 'ReplacementPlan');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(BoundaryValidationError);
      expect(result.error.issues.length).toBeGreaterThan(0);
      expect(result.error.resource).toBe('ReplacementPlan');
    }
  });

  it('[INTEGRITY] sollte einen nicht-ganzzahligen Cent-Betrag ablehnen', () => {
    const value = {
      id: 's-1',
      household_id: 'h-1',
      from_member_id: 'a',
      to_member_id: 'b',
      amount_minor: 15.5,
      date: '2026-07-19',
    };
    expect(() =>
      parseAtBoundary(householdSettlementSchema, value, 'HouseholdSettlement'),
    ).toThrow(BoundaryValidationError);
  });
});
