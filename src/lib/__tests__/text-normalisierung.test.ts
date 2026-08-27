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

/**
 * Trennbare Verben — der Browser-Fund vom 27.08.
 *
 * „Wie viel gebe ich für Netflix aus?" blieb unbeantwortet, „Wie viel habe
 * ich für Netflix ausgegeben" traf. Der Unterschied ist kein Vokabel-Loch,
 * sondern die deutsche Satzklammer: Im Hauptsatz steht der Verbstamm vorn
 * und die Partikel am Satzende, und dazwischen liegt genau das, wonach
 * gefragt wird. Auf der Wortebene sieht der Router deshalb weder „ausgeben"
 * noch „ausgegeben" — er sieht „gebe" und „aus", und keines von beiden
 * trägt allein die Absicht.
 *
 * Deshalb wird die Klammer VOR jeder Router-Stufe geschlossen, nicht in der
 * Auslöserliste geflickt: Ein Eintrag je Beugungsform wäre je Verb ein
 * halbes Dutzend, und der Klassifikator der Stufe 2 sähe die Frage weiter
 * zerlegt.
 */
describe('normalisiereFrage: die Satzklammer trennbarer Verben', () => {
  it('sollte „gebe … aus" zu „ausgegeben" zusammenziehen', () => {
    expect(normalisiereFrage('Wie viel gebe ich für Netflix aus?')).toContain('ausgegeben');
  });

  it('sollte den Bezug zwischen Stamm und Partikel erhalten', () => {
    // Der Händler steht MITTEN in der Klammer und muss die Umformung
    // überleben — sonst ist die Frage verstanden und der Slot leer.
    expect(normalisiereFrage('Wie viel gebe ich für Netflix aus?')).toContain('netflix');
  });

  it('sollte alle finiten Formen erfassen', () => {
    for (const satz of [
      'was gebe ich fuer netflix aus',
      'wie viel gibst du fuer netflix aus',
      'wie viel gibt er fuer netflix aus',
      'wie viel geben wir fuer netflix aus',
      'wie viel gebt ihr fuer netflix aus',
    ]) {
      expect(normalisiereFrage(satz), satz).toContain('ausgegeben');
    }
  });

  it('sollte die PRÄPOSITION „aus" unangetastet lassen', () => {
    // „aus" ist im Deutschen weit häufiger Präposition als Verbpartikel.
    // Nur die Satzklammer wird geschlossen — erkannt daran, dass die
    // Partikel den Teilsatz BEENDET.
    const satz = normalisiereFrage('welche buchungen gebe ich aus dem gemeinsamen konto frei');
    expect(satz).toContain('aus dem gemeinsamen konto');
    expect(satz).not.toContain('ausgegeben');
  });

  it('sollte nicht über die Satzgrenze hinweg zusammenziehen', () => {
    const satz = normalisiereFrage('wie viel gebe ich? zeig mir alles aus');
    expect(satz).not.toContain('ausgegeben');
  });
});
