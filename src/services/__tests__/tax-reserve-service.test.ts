import { describe, it, expect, beforeEach } from 'vitest';
import {
  addTaxReserveMovement,
  deleteTaxReserveMovement,
  getTaxReserveState,
  setTaxReservePercentOverride,
} from '../tax-reserve-service';
import { writeLocalFinanceList } from '../local-finance-store';

beforeEach(async () => {
  localStorage.setItem('ausgabentracker_locale_v1', 'de');
  await writeLocalFinanceList('taxReserves', []);
});

describe('tax-reserve-service (CRUD je Veranlagungsjahr)', () => {
  describe('Normal Behavior', () => {
    it('sollte für ein unbenutztes Jahr null liefern', async () => {
      expect(await getTaxReserveState(2025)).toBeNull();
    });

    it('sollte die erste Bewegung anlegen und den Jahres-Stand erzeugen', async () => {
      await addTaxReserveMovement(2025, { date: '2025-03-01', amount: 500, note: 'Q1' });

      const state = await getTaxReserveState(2025);
      expect(state?.year).toBe(2025);
      expect(state?.movements).toHaveLength(1);
      expect(state?.movements[0].amount).toBe(500);
      expect(state?.movements[0].note).toBe('Q1');
    });

    it('sollte weitere Bewegungen anhängen (auch negative = Steuer gezahlt)', async () => {
      await addTaxReserveMovement(2025, { date: '2025-03-01', amount: 500 });
      await addTaxReserveMovement(2025, { date: '2025-06-15', amount: -200 });

      const state = await getTaxReserveState(2025);
      expect(state?.movements.map((m) => m.amount)).toEqual([500, -200]);
    });

    it('sollte Bewegungen löschen können', async () => {
      await addTaxReserveMovement(2025, { date: '2025-03-01', amount: 500 });
      const state = await getTaxReserveState(2025);
      const movementId = state!.movements[0].id;

      await deleteTaxReserveMovement(2025, movementId);

      expect((await getTaxReserveState(2025))?.movements).toHaveLength(0);
    });

    it('sollte den Prozent-Override je Jahr persistieren und per null löschen', async () => {
      await setTaxReservePercentOverride(2025, 42);
      expect((await getTaxReserveState(2025))?.percent_override).toBe(42);

      await setTaxReservePercentOverride(2025, null);
      expect((await getTaxReserveState(2025))?.percent_override).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('sollte Jahre strikt trennen (2024-Bewegung taucht nicht in 2025 auf)', async () => {
      await addTaxReserveMovement(2024, { date: '2024-12-30', amount: 900 });
      await addTaxReserveMovement(2025, { date: '2025-01-02', amount: 100 });

      expect((await getTaxReserveState(2024))?.movements.map((m) => m.amount)).toEqual([900]);
      expect((await getTaxReserveState(2025))?.movements.map((m) => m.amount)).toEqual([100]);
    });

    it('sollte ungültige Beträge ablehnen (0/NaN)', async () => {
      await expect(addTaxReserveMovement(2025, { date: '2025-03-01', amount: 0 })).rejects.toThrow();
      await expect(
        addTaxReserveMovement(2025, { date: '2025-03-01', amount: Number.NaN }),
      ).rejects.toThrow();
    });
  });
});
