import { describe, it, expect } from 'vitest';
import {
  evaluateDebtFreedom,
  INITIAL_DEBT_FREEDOM_MEMORY,
  type DebtFreedomMemory,
} from '../debt-freedom';

/**
 * WP-7.4 — Signature Moment „Schuldenfrei".
 *
 * Die tragende Frage ist fachlich, nicht gestalterisch: „Schuldensumme ist
 * null" trifft auch auf jeden zu, der nie Schulden erfasst hat. Dem einen
 * Erfolgsmoment hinzuwerfen wäre albern bis verletzend.
 */

const HAD_DEBT: DebtFreedomMemory = { everHadDebt: true, celebrated: false };
const ALREADY_CELEBRATED: DebtFreedomMemory = { everHadDebt: true, celebrated: true };

describe('evaluateDebtFreedom', () => {
  it('sollte nicht feiern, wenn nie Schulden bestanden', () => {
    // Der wichtigste Fall des Arbeitspakets.
    const result = evaluateDebtFreedom(0, INITIAL_DEBT_FREEDOM_MEMORY);
    expect(result.isDebtFree).toBe(false);
    expect(result.shouldCelebrate).toBe(false);
  });

  it('sollte feiern, wenn die letzte Schuld getilgt ist', () => {
    const result = evaluateDebtFreedom(0, HAD_DEBT);
    expect(result.isDebtFree).toBe(true);
    expect(result.shouldCelebrate).toBe(true);
  });

  it('sollte denselben Moment nicht zweimal feiern', () => {
    // Sonst erschiene die Feier bei jedem Seitenaufruf erneut.
    const result = evaluateDebtFreedom(0, ALREADY_CELEBRATED);
    expect(result.isDebtFree).toBe(true);
    expect(result.shouldCelebrate).toBe(false);
  });

  it('sollte bei bestehenden Schulden nicht feiern, sich diese aber merken', () => {
    const result = evaluateDebtFreedom(1200, INITIAL_DEBT_FREEDOM_MEMORY);
    expect(result.isDebtFree).toBe(false);
    expect(result.memory.everHadDebt).toBe(true);
  });

  it('sollte eine erneute Schuldenfreiheit wieder feiern', () => {
    // Wer Schulden abbaut, neue aufnimmt und sie wieder abbaut, hat das
    // zweite Mal genauso verdient wie das erste.
    const afterNewDebt = evaluateDebtFreedom(500, ALREADY_CELEBRATED);
    expect(afterNewDebt.memory.celebrated).toBe(false);

    const afterPayoff = evaluateDebtFreedom(0, afterNewDebt.memory);
    expect(afterPayoff.shouldCelebrate).toBe(true);
  });

  it('sollte eine Überzahlung als schuldenfrei werten', () => {
    expect(evaluateDebtFreedom(-50, HAD_DEBT).shouldCelebrate).toBe(true);
  });

  it('[REGRESSION] sollte bei NaN weder feiern noch das Gedächtnis verändern', () => {
    // NaN kommt aus einer fehlgeschlagenen Rechnung. Als „null Schulden"
    // gelesen wäre das ein Erfolg, der aus einem Fehler entsteht.
    const result = evaluateDebtFreedom(Number.NaN, HAD_DEBT);
    expect(result.shouldCelebrate).toBe(false);
    expect(result.isDebtFree).toBe(false);
    expect(result.memory).toEqual(HAD_DEBT);
  });

  it('sollte das Gedächtnis fortschreiben statt es zu mutieren', () => {
    // Eine mutierte Vorlage würde in React-State zu ausbleibenden Renders
    // führen — der Erfolgsmoment erschiene dann gar nicht.
    const memory = { ...HAD_DEBT };
    const result = evaluateDebtFreedom(0, memory);
    expect(memory).toEqual(HAD_DEBT);
    expect(result.memory).not.toBe(memory);
  });
});
