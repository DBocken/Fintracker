import { describe, it, expect } from 'vitest';
import { activityLevel, ACTIVITY_LEVELS } from '../city-activity';

/**
 * WP-5.4 — Fensteraktivität als Datenkanal.
 *
 * Das Fenster-Raster war reine Dekoration: eine geteilte Textur, überall
 * gleich viele Fenster. Der Kanal kann etwas zeigen, das die HÖHE nicht kann —
 * ob ein Betrag aus EINER großen Zahlung besteht oder aus vielen kleinen.
 */
describe('activityLevel', () => {
  it('sollte ohne Buchungen ruhig sein', () => {
    expect(activityLevel(0, 12)).toBe('quiet');
  });

  it('sollte eine einzelne Zahlung im Jahr als ruhig einstufen', () => {
    // Jahresbeitrag einer Versicherung: ein Vorgang, kein Betrieb.
    expect(activityLevel(1, 12)).toBe('quiet');
  });

  it('sollte eine monatliche Zahlung als gleichmäßig einstufen', () => {
    expect(activityLevel(12, 12)).toBe('steady');
  });

  it('sollte mehrmals wöchentliche Buchungen als belebt einstufen', () => {
    expect(activityLevel(120, 12)).toBe('busy');
  });

  it('[REGRESSION] sollte die FREQUENZ messen, nicht die absolute Zahl', () => {
    // Der Kern der Sache: wer zwei Jahre importiert, hätte sonst überall
    // „viel Aktivität". Dieselbe Frequenz muss dieselbe Stufe ergeben,
    // unabhängig von der Länge des geladenen Fensters.
    expect(activityLevel(12, 12)).toBe(activityLevel(24, 24));
    expect(activityLevel(60, 12)).toBe(activityLevel(120, 24));
  });

  it('[REGRESSION] sollte das GESAMTE Datenfenster als Bezug nehmen', () => {
    // Sonst käme ein Gebäude mit einer einzigen Buchung in einem einzigen
    // Monat auf „1 Buchung / 1 Monat" und damit auf dieselbe Stufe wie ein
    // echtes monatliches Abo. Der Aufrufer übergibt deshalb die Länge des
    // Datenfensters, nicht die Monate DIESES Gebäudes.
    expect(activityLevel(1, 12)).toBe('quiet');
    expect(activityLevel(1, 1)).toBe('steady');
  });

  it('sollte ein unbrauchbares Fenster nicht durch Null teilen', () => {
    expect(activityLevel(5, 0)).toBe('busy');
    expect(activityLevel(5, Number.NaN)).toBe('busy');
  });

  it('sollte unbrauchbare Buchungszahlen als ruhig behandeln', () => {
    expect(activityLevel(Number.NaN, 12)).toBe('quiet');
    expect(activityLevel(-3, 12)).toBe('quiet');
  });

  it('sollte die Stufen in aufsteigender Ordnung führen', () => {
    expect(ACTIVITY_LEVELS).toEqual(['quiet', 'steady', 'busy']);
  });

  it('sollte über den ganzen Bereich monoton steigen', () => {
    // Mehr Buchungen dürfen nie eine RUHIGERE Fassade ergeben.
    let lastIndex = 0;
    for (let count = 0; count <= 200; count += 1) {
      const index = ACTIVITY_LEVELS.indexOf(activityLevel(count, 12));
      expect(index, `Stufe fällt bei ${count} Buchungen zurück`).toBeGreaterThanOrEqual(lastIndex);
      lastIndex = index;
    }
  });
});
