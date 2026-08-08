import { describe, it, expect, beforeEach } from 'vitest';
import { recordSkipped, getIntegrityReport, clearIntegrityReport } from '../data-integrity-report';

describe('data-integrity-report (WP 1.2, RES-2/DOM-2)', () => {
  beforeEach(() => {
    clearIntegrityReport();
  });

  it('sollte einen leeren Bericht liefern, solange nichts gemeldet wurde', () => {
    expect(getIntegrityReport()).toEqual([]);
  });

  it('sollte übersprungene Items je Collection festhalten', () => {
    recordSkipped('debts', 2);
    expect(getIntegrityReport()).toEqual([{ key: 'debts', skipped: 2 }]);
  });

  it('sollte den Zähler beim nächsten Lesen ERSETZEN, nicht aufsummieren', () => {
    recordSkipped('debts', 2);
    recordSkipped('debts', 5);
    expect(getIntegrityReport()).toEqual([{ key: 'debts', skipped: 5 }]);
  });

  it('sollte einen Eintrag löschen, wenn eine Collection wieder sauber gelesen wird (count 0)', () => {
    recordSkipped('debts', 3);
    recordSkipped('debts', 0);
    expect(getIntegrityReport()).toEqual([]);
  });

  it('sollte mehrere Collections unabhängig voneinander führen', () => {
    recordSkipped('debts', 1);
    recordSkipped('transactions', 4);
    const report = getIntegrityReport();
    expect(report).toHaveLength(2);
    expect(report).toEqual(
      expect.arrayContaining([
        { key: 'debts', skipped: 1 },
        { key: 'transactions', skipped: 4 },
      ]),
    );
  });

  it('clearIntegrityReport() sollte den gesamten Bericht zurücksetzen', () => {
    recordSkipped('debts', 1);
    recordSkipped('transactions', 4);
    clearIntegrityReport();
    expect(getIntegrityReport()).toEqual([]);
  });
});
