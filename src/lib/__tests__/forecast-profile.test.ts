import { describe, it, expect } from 'vitest';
import { addDays, getDay, getDaysInMonth, getDate } from 'date-fns';
import {
  buildDailySpendingProfile,
  distributeMonthlyByProfile,
  neutralProfile,
  type DailySpendingProfile,
} from '../forecast-profile';
import type { Transaction } from '@/types';

/** Wochentage (getDay) für jeden Tag eines Monats, in Tagesreihenfolge. */
function monthWeekdays(year: number, monthIndex0: number): number[] {
  const first = new Date(year, monthIndex0, 1);
  const days = getDaysInMonth(first);
  return Array.from({ length: days }, (_, i) => getDay(addDays(first, i)));
}

function tx(date: string, amount: number, extra: Partial<Transaction> = {}): Transaction {
  return {
    date,
    amount,
    payee: 'Test',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: true,
    ...extra,
  };
}

describe('distributeMonthlyByProfile', () => {
  describe('Summen-Erhalt', () => {
    it('[REGRESSION] sollte die Monatssumme exakt erhalten (neutrales Profil)', () => {
      const weekdays = monthWeekdays(2026, 0); // Januar 2026, 31 Tage
      const result = distributeMonthlyByProfile(100000, weekdays, neutralProfile());
      expect(result.reduce((s, v) => s + v, 0)).toBe(100000);
    });

    it('[REGRESSION] sollte die Monatssumme exakt erhalten (schiefes Profil)', () => {
      const weekdays = monthWeekdays(2026, 1); // Februar 2026
      const profile: DailySpendingProfile = { weekdayWeights: [2.1, 0.3, 0.4, 0.9, 1.2, 1.5, 2.6] };
      for (const cents of [1, 99, 100000, 123457]) {
        const result = distributeMonthlyByProfile(cents, weekdays, profile);
        expect(result.reduce((s, v) => s + v, 0)).toBe(cents);
      }
    });
  });

  describe('Normal Behavior', () => {
    it('sollte Wochenend-Tage höher gewichten als Werktage', () => {
      const year = 2026;
      const monthIndex = 2; // März 2026
      const weekdays = monthWeekdays(year, monthIndex);
      // Wochenende (Sa=6, So=0) stark übergewichtet.
      const profile: DailySpendingProfile = { weekdayWeights: [1.8, 0.6, 0.6, 0.6, 0.6, 1.0, 1.8] };
      const result = distributeMonthlyByProfile(300000, weekdays, profile);

      const first = new Date(year, monthIndex, 1);
      let weekendTotal = 0;
      let weekendDays = 0;
      let weekdayTotal = 0;
      let weekdayDays = 0;
      result.forEach((cents, i) => {
        const dow = getDay(addDays(first, i));
        if (dow === 0 || dow === 6) {
          weekendTotal += cents;
          weekendDays += 1;
        } else {
          weekdayTotal += cents;
          weekdayDays += 1;
        }
      });
      // Durchschnittlicher Wochenend-Tag bekommt mehr als ein Werktag.
      expect(weekendTotal / weekendDays).toBeGreaterThan(weekdayTotal / weekdayDays);
    });

    it('sollte bei neutralem Profil identisch zur Linearverteilung sein', () => {
      const year = 2026;
      const monthIndex = 0; // Januar, 31 Tage
      const weekdays = monthWeekdays(year, monthIndex);
      const monthlyCents = 100000;
      const result = distributeMonthlyByProfile(monthlyCents, weekdays, neutralProfile());

      // Referenz: exakt die bisherige Engine-Logik (floor + Restcent auf erste Tage).
      const daysInMonth = weekdays.length;
      const base = Math.floor(monthlyCents / daysInMonth);
      const remainder = monthlyCents - base * daysInMonth;
      const first = new Date(year, monthIndex, 1);
      const expected = Array.from({ length: daysInMonth }, (_, i) =>
        base + (getDate(addDays(first, i)) <= remainder ? 1 : 0),
      );
      expect(result).toEqual(expected);
    });
  });

  describe('Edge Cases', () => {
    it('sollte bei 0 € nur Nullen liefern', () => {
      const weekdays = monthWeekdays(2026, 0);
      const result = distributeMonthlyByProfile(0, weekdays, neutralProfile());
      expect(result.every((v) => v === 0)).toBe(true);
    });

    it('sollte bei entartetem Profil (alle 0) gleichmäßig und summenerhaltend verteilen', () => {
      const weekdays = monthWeekdays(2026, 0);
      const profile: DailySpendingProfile = { weekdayWeights: [0, 0, 0, 0, 0, 0, 0] };
      const result = distributeMonthlyByProfile(100000, weekdays, profile);
      expect(result.reduce((s, v) => s + v, 0)).toBe(100000);
    });
  });
});

describe('buildDailySpendingProfile', () => {
  const NOW = new Date(2026, 5, 15); // 15. Juni 2026

  /** Erzeugt für jeden Tag im Fenster eine Ausgabe an bestimmten Wochentagen. */
  function weekdayHeavyHistory(): Transaction[] {
    const out: Transaction[] = [];
    let d = new Date(2025, 7, 1); // 1. Aug 2025
    while (d <= NOW) {
      const dow = getDay(d);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (dow === 6) out.push(tx(iso, -100, { category: 'Restaurant' })); // Samstag teuer
      else if (dow === 3) out.push(tx(iso, -20, { category: 'Restaurant' })); // Mittwoch günstig
      d = addDays(d, 1);
    }
    return out;
  }

  describe('Normal Behavior', () => {
    it('sollte das stärkere Wochenende im Profil abbilden', () => {
      const profiles = buildDailySpendingProfile(weekdayHeavyHistory(), { now: NOW });
      const profile = profiles.get('Restaurant');
      expect(profile).toBeDefined();
      // Samstag (6) > Mittwoch (3).
      expect(profile!.weekdayWeights[6]).toBeGreaterThan(profile!.weekdayWeights[3]);
    });

    it('sollte ein auf Mittel 1.0 normiertes Profil liefern (Summe ≈ 7)', () => {
      const profiles = buildDailySpendingProfile(weekdayHeavyHistory(), { now: NOW });
      const profile = profiles.get('Restaurant')!;
      const sum = profile.weekdayWeights.reduce((s, v) => s + v, 0);
      expect(sum).toBeCloseTo(7, 1);
    });
  });

  describe('Edge Cases', () => {
    it('sollte Kategorien mit zu wenig Transaktionen auslassen', () => {
      const sparse = [
        tx('2026-05-02', -50, { category: 'Selten' }),
        tx('2026-05-09', -50, { category: 'Selten' }),
      ];
      const profiles = buildDailySpendingProfile(sparse, { now: NOW, minTransactions: 20 });
      expect(profiles.has('Selten')).toBe(false);
    });

    it('sollte Transfers und Verträge ausschließen', () => {
      const data = [
        ...Array.from({ length: 30 }, (_, i) =>
          tx(`2026-04-${String((i % 28) + 1).padStart(2, '0')}`, -5000, {
            category: 'Übertrag',
            is_transfer: true,
          }),
        ),
      ];
      const profiles = buildDailySpendingProfile(data, { now: NOW });
      expect(profiles.has('Übertrag')).toBe(false);
    });
  });
});
