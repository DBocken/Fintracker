import { describe, it, expect } from 'vitest';
import {
  formatDaysUntil,
  formatCoachDaysUntil,
  pluralize,
  pluralTransactions,
  pluralCharges,
  replaceTemplate,
} from '../format';

const mockT = (key: string) => {
  const translations: Record<string, string> = {
    'common.today': 'heute',
    'common.tomorrow': 'morgen',
    'common.inDays': 'in {days} Tagen',
    'coach.whenToday': 'heute',
    'coach.whenTomorrow': 'morgen',
    'coach.whenInDays': 'in {days} Tagen',
    'common.singularTransaction': 'Buchung',
    'common.pluralTransaction': 'Buchungen',
    'common.singularCharge': 'Abbuchung',
    'common.pluralCharge': 'Abbuchungen',
  };
  return translations[key] || key;
};

describe('formatDaysUntil', () => {
  it('sollte "heute" für daysUntil <= 0 zurückgeben', () => {
    expect(formatDaysUntil(0, mockT)).toBe('heute');
    expect(formatDaysUntil(-5, mockT)).toBe('heute');
  });

  it('sollte "morgen" für daysUntil === 1 zurückgeben', () => {
    expect(formatDaysUntil(1, mockT)).toBe('morgen');
  });

  it('sollte "in X Tagen" für daysUntil > 1 zurückgeben', () => {
    expect(formatDaysUntil(5, mockT)).toBe('in 5 Tagen');
    expect(formatDaysUntil(30, mockT)).toBe('in 30 Tagen');
  });
});

describe('formatCoachDaysUntil', () => {
  it('sollte Coach-Texte verwenden', () => {
    expect(formatCoachDaysUntil(0, mockT)).toBe('heute');
    expect(formatCoachDaysUntil(1, mockT)).toBe('morgen');
    expect(formatCoachDaysUntil(7, mockT)).toBe('in 7 Tagen');
  });
});

describe('pluralize', () => {
  it('sollte singularKey für count === 1 verwenden', () => {
    expect(pluralize(1, 'common.singularTransaction', 'common.pluralTransaction', mockT)).toBe(
      'Buchung',
    );
  });

  it('sollte pluralKey für count !== 1 verwenden', () => {
    expect(pluralize(0, 'common.singularTransaction', 'common.pluralTransaction', mockT)).toBe(
      'Buchungen',
    );
    expect(pluralize(2, 'common.singularTransaction', 'common.pluralTransaction', mockT)).toBe(
      'Buchungen',
    );
    expect(pluralize(100, 'common.singularTransaction', 'common.pluralTransaction', mockT)).toBe(
      'Buchungen',
    );
  });
});

describe('pluralTransactions', () => {
  it('sollte korrekt pluralisieren', () => {
    expect(pluralTransactions(1, mockT)).toBe('Buchung');
    expect(pluralTransactions(5, mockT)).toBe('Buchungen');
  });
});

describe('pluralCharges', () => {
  it('sollte korrekt pluralisieren', () => {
    expect(pluralCharges(1, mockT)).toBe('Abbuchung');
    expect(pluralCharges(3, mockT)).toBe('Abbuchungen');
  });
});

describe('replaceTemplate', () => {
  it('sollte Template-Variablen ersetzen', () => {
    expect(replaceTemplate('in {days} Tagen', { days: 5 })).toBe('in 5 Tagen');
    expect(replaceTemplate('Es gibt {count} Buchungen', { count: 3 })).toBe(
      'Es gibt 3 Buchungen',
    );
  });

  it('sollte mehrere Variablen ersetzen', () => {
    const result = replaceTemplate('Datum: {date}, Betrag: {amount}€', {
      date: '2026-07-04',
      amount: 50,
    });
    expect(result).toBe('Datum: 2026-07-04, Betrag: 50€');
  });

  it('sollte unbekannte Variablen ignorieren', () => {
    expect(replaceTemplate('in {days} Tagen', {})).toBe('in  Tagen');
  });
});
