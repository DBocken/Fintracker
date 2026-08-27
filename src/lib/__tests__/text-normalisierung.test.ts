import { describe, it, expect } from 'vitest';
import { normalisiereFrage } from '../text-normalisierung';

describe('Frage-Normalisierung', () => {
  it('sollte Umlaute und Eszett falten', () => {
    expect(normalisiereFrage('Für Größe')).toBe('fuer groesse');
  });

  it('[REGRESSION] sollte „wieviel" wie „wie viel" lesen', () => {
    // Browser-Fund: „Wieviel geld habe ich" blieb unbeantwortet, während
    // „wie viel geld habe ich" den Kontostand traf. Der Unterschied war ein
    // Leerzeichen — und „wieviel" war bis zur Rechtschreibreform die
    // Regelform.
    expect(normalisiereFrage('Wieviel geld habe ich')).toBe(normalisiereFrage('Wie viel geld habe ich'));
    expect(normalisiereFrage('Wieviele Buchungen')).toBe('wie viele buchungen');
    expect(normalisiereFrage('soviel')).toBe('so viel');
  });

  it('sollte nur an Wortgrenzen trennen', () => {
    // „Wievielfache" ist ein anderes Wort — eine Trennung mitten darin wäre
    // geraten, und ein Router, der rät, ist genau das Gegenteil der Zusage.
    expect(normalisiereFrage('Wievielfache')).toBe('wievielfache');
  });
});
