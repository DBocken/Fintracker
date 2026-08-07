/**
 * Die Annäherungsleiter des Sanften Modus (`docs/debt-avoidance-recovery.md`).
 *
 * Geprüft wird hier vor allem die **Reihenfolge**: Beim Abstieg von 3 nach 0
 * taucht zuerst auf, was man zum Handeln braucht, und zuletzt die Zahl mit der
 * meisten Scham. Genau diese Reihenfolge ist die inhaltliche Aussage des
 * Modus — dreht sie jemand um, ist die Leiter kaputt, ohne dass irgendetwas
 * anderes rot würde.
 */

import { describe, it, expect } from 'vitest';
import {
  GENTLE_AMOUNT_MASK,
  GENTLE_LEVELS,
  gentleLevelFromLegacy,
  isAmountMasked,
  maskAmount,
  parseGentleLevel,
  type AmountKind,
  type GentleLevel,
} from '../gentle-mode';

describe('Sanfter Modus — Stufen und Betragsklassen', () => {
  it('sollte auf Stufe 0 nichts verdecken', () => {
    const kinds: AmountKind[] = ['total', 'installment', 'progress'];
    expect(kinds.filter((kind) => isAmountMasked(0, kind))).toEqual([]);
  });

  it('sollte auf Stufe 3 alles verdecken', () => {
    const kinds: AmountKind[] = ['total', 'installment', 'progress'];
    expect(kinds.filter((kind) => isAmountMasked(3, kind))).toEqual(kinds);
  });

  it('sollte auf Stufe 2 genau die naechste Rate zeigen', () => {
    // Die Zahl, die man zum Handeln braucht — und nur sie.
    expect(isAmountMasked(2, 'installment')).toBe(false);
    expect(isAmountMasked(2, 'progress')).toBe(true);
    expect(isAmountMasked(2, 'total')).toBe(true);
  });

  it('sollte auf Stufe 1 zusaetzlich den Fortschritt zeigen, die Gesamtsumme aber nicht', () => {
    expect(isAmountMasked(1, 'installment')).toBe(false);
    expect(isAmountMasked(1, 'progress')).toBe(false);
    expect(isAmountMasked(1, 'total')).toBe(true);
  });

  it('sollte die Gesamtsumme als letzte Klasse wieder aufdecken', () => {
    // Der eigentliche Kern der Leiter: Es gibt keine Stufe > 0, auf der die
    // Gesamtsumme sichtbar ist, aber die Rate nicht.
    const levels: GentleLevel[] = [1, 2, 3];
    const verkehrtHerum = levels.filter(
      (level) => !isAmountMasked(level, 'total') && isAmountMasked(level, 'installment'),
    );
    expect(verkehrtHerum).toEqual([]);
  });

  it('sollte monoton sein — eine hoehere Stufe deckt nie mehr auf', () => {
    const kinds: AmountKind[] = ['total', 'installment', 'progress'];
    const rueckschritte = kinds.flatMap((kind) =>
      ([0, 1, 2] as GentleLevel[])
        .filter(
          (level) =>
            isAmountMasked(level, kind) &&
            !isAmountMasked((level + 1) as GentleLevel, kind),
        )
        .map((level) => `${kind}@${level}`),
    );
    expect(rueckschritte).toEqual([]);
  });
});

describe('maskAmount', () => {
  it('sollte ohne Klassenangabe die geschuetzteste Klasse annehmen', () => {
    // Eine vergessene Angabe darf nie zu einer unerwartet sichtbaren Zahl
    // fuehren — der Fehler faellt in Richtung Maske.
    expect(maskAmount('1.234,50 €', 1)).toBe(GENTLE_AMOUNT_MASK);
    expect(maskAmount('1.234,50 €', 3)).toBe(GENTLE_AMOUNT_MASK);
  });

  it('sollte eine unbekannte Klasse wie die geschuetzteste behandeln', () => {
    // Ein Tippfehler im Klassennamen ist sonst eine aufgedeckte Zahl.
    expect(maskAmount('1.234,50 €', 1, 'tilgung' as AmountKind)).toBe(GENTLE_AMOUNT_MASK);
  });

  it('sollte auf Stufe 0 unveraendert durchreichen', () => {
    expect(maskAmount('1.234,50 €', 0)).toBe('1.234,50 €');
    expect(maskAmount('1.234,50 €', 0, 'installment')).toBe('1.234,50 €');
  });

  it('sollte die Groessenordnung nicht durchscheinen lassen', () => {
    expect(maskAmount('12,00 €', 3)).toBe(maskAmount('1.234.567,89 €', 3));
  });
});

describe('Altbestaende', () => {
  it('sollte den abgeloesten Schalter auf die verdeckteste Stufe abbilden', () => {
    // Wer den Modus an hatte, hat ALLES verdeckt gesehen. Eine Migration, die
    // dabei Betraege aufdeckt, waere genau der Schreck, den der Modus
    // verhindern soll.
    expect(gentleLevelFromLegacy(true)).toBe(3);
    expect(gentleLevelFromLegacy(false)).toBe(0);
    expect(gentleLevelFromLegacy(undefined)).toBe(0);
  });

  it('sollte den alten Schnellstart-Wert aus localStorage weiter lesen', () => {
    expect(parseGentleLevel('true')).toBe(3);
    expect(parseGentleLevel('false')).toBe(0);
  });

  it('sollte Stufen als Schnellstart-Wert lesen', () => {
    expect(GENTLE_LEVELS.map((level) => parseGentleLevel(String(level)))).toEqual([3, 2, 1, 0]);
  });

  it('sollte einen kaputten Wert nicht in einen ungewaehlten Modus zwingen', () => {
    expect(parseGentleLevel(null)).toBe(0);
    expect(parseGentleLevel('')).toBe(0);
    expect(parseGentleLevel('7')).toBe(0);
    expect(parseGentleLevel('2.5')).toBe(0);
    expect(parseGentleLevel('irgendwas')).toBe(0);
  });
});
