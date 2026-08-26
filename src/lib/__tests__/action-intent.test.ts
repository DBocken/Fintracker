import { describe, expect, it } from 'vitest';
import {
  endetMitFragezeichen,
  hatVerb,
  istFrage,
  normalisiereAktion,
  restText,
} from '../action-intent';

/**
 * Die gemeinsame Grundlage aller schreibenden Chat-Absichten (Welle 5).
 *
 * Geprüft wird hier vor allem das **Imperativ-Gate** — die Sicherung, nicht
 * die Erkennung. Eine falsch beantwortete Frage zeigt eine falsche Zahl; ein
 * falsch gedeuteter Befehl schlägt eine Änderung an den Daten vor. Deshalb
 * ist es absichtlich streng: Im Zweifel keine Aktion.
 */

describe('istFrage', () => {
  it('sollte Fragewörter erkennen, auch mitten im Satz', () => {
    // „kann ich mein budget erhöhen ohne …" fragt, befiehlt nicht.
    expect(istFrage(normalisiereAktion('Kann ich mein Budget erhöhen?'))).toBe(true);
    expect(istFrage(normalisiereAktion('Wie viel Budget habe ich noch'))).toBe(true);
    expect(istFrage(normalisiereAktion('Lohnt es sich, das Budget zu senken'))).toBe(true);
  });

  it('[REGRESSION] sollte auch gebeugte Frageworte als Frage erkennen', () => {
    // Der WP-I-Fund: `welche` steht ohne Wortgrenze, weil „welches",
    // „welchen", „welcher" dieselbe Frage sind. „Welches Budget sollte ich
    // reduzieren?" fiel genau durch diese Lücke und wurde zum Befehl.
    for (const form of ['welche', 'welches', 'welchen', 'welcher']) {
      expect(istFrage(normalisiereAktion(`${form} Budget sollte ich reduzieren`)), form).toBe(true);
    }
  });

  it('sollte einen echten Befehl NICHT als Frage werten', () => {
    // Die Gegenprobe: Ein Gate, das auch Befehle bremst, ist keine Schranke,
    // sondern eine Abschaltung.
    expect(istFrage(normalisiereAktion('Lege ein Budget von 200 € für Essen an'))).toBe(false);
    expect(istFrage(normalisiereAktion('Erhöhe mein Freizeitbudget um 50'))).toBe(false);
  });
});

describe('endetMitFragezeichen', () => {
  it('sollte einen befehlsförmigen Satz mit Fragezeichen als Frage werten', () => {
    // „Budget für Essen anlegen?" trägt kein Fragewort und sieht grammatisch
    // wie ein Befehl aus — das Fragezeichen macht die Absicht trotzdem klar.
    expect(endetMitFragezeichen('Budget für Essen anlegen?')).toBe(true);
    expect(endetMitFragezeichen('Budget für Essen anlegen')).toBe(false);
  });
});

describe('hatVerb', () => {
  it('sollte Verben je Wirkungsgruppe erkennen', () => {
    expect(hatVerb(normalisiereAktion('Lösch das Budget für Kino'), 'loeschen')).toBe(true);
    expect(hatVerb(normalisiereAktion('Ordne die Buchung Lebensmitteln zu'), 'zuordnen')).toBe(true);
    expect(hatVerb(normalisiereAktion('Markiere das als Übertrag'), 'markieren')).toBe(true);
  });

  it('sollte ein Gesprächswort NICHT als Aktionsverb werten', () => {
    expect(hatVerb(normalisiereAktion('das war teuer'), 'anlegen')).toBe(false);
  });
});

describe('restText', () => {
  it('sollte das Bezugswort aus dem Satzrest holen', () => {
    const rest = restText(normalisiereAktion('lege 200 euro budget für lebensmittel an'), /budget/);
    expect(rest).toBe('lebensmittel');
  });

  it('sollte ohne Bezugswort undefined liefern statt eines leeren Strings', () => {
    // Ein leerer String wäre ein Wert und würde die Auflösung im ViewModel
    // mit einer leeren Suche beschäftigen; `undefined` heisst „nichts genannt".
    expect(restText(normalisiereAktion('lösch das budget'), /budget/)).toBeUndefined();
  });
});
