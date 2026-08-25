import { describe, expect, it } from 'vitest';
import { extrahiereBudgetAktion } from '../budget-action-intent';

describe('extrahiereBudgetAktion', () => {
  it('sollte das Anlegen mit Betrag und Kategorie-Text erkennen', () => {
    expect(extrahiereBudgetAktion('Lege 200 € Budget für Lebensmittel an')).toEqual({
      art: 'anlegen',
      betrag: 200,
      kategorieText: 'lebensmittel',
    });
    expect(extrahiereBudgetAktion('erstell mir ein budget von 150 euro für freizeit')).toMatchObject({
      art: 'anlegen',
      betrag: 150,
      kategorieText: 'freizeit',
    });
  });

  it('sollte relative und absolute Änderung unterscheiden — auf vs. um', () => {
    expect(extrahiereBudgetAktion('Erhöhe mein Freizeitbudget um 50 €')).toMatchObject({
      art: 'aendern',
      modus: 'um',
      betrag: 50,
      richtung: 'mehr',
    });
    expect(extrahiereBudgetAktion('setz das Budget für Essen auf 250')).toMatchObject({
      art: 'aendern',
      modus: 'auf',
      betrag: 250,
    });
    expect(extrahiereBudgetAktion('reduzier mein Shoppingbudget um 30 €')).toMatchObject({
      art: 'aendern',
      modus: 'um',
      betrag: 30,
      richtung: 'weniger',
    });
    // „erhöhe … auf 300" — Erhöhungs-Verb, aber absoluter Zielwert.
    expect(extrahiereBudgetAktion('erhöhe das Lebensmittelbudget auf 300 €')).toMatchObject({
      art: 'aendern',
      modus: 'auf',
      betrag: 300,
      richtung: 'mehr',
    });
  });

  it('sollte das Löschen erkennen', () => {
    expect(extrahiereBudgetAktion('lösch das Budget für Kino')).toMatchObject({
      art: 'loeschen',
      kategorieText: 'kino',
    });
  });

  it('sollte Tippfehler-Varianten lesen', () => {
    expect(extrahiereBudgetAktion('leg mal 100euro budget für essn an')).toMatchObject({
      art: 'anlegen',
      betrag: 100,
    });
    expect(extrahiereBudgetAktion('erhoehe freizeit budget um 50')).toMatchObject({
      art: 'aendern',
      modus: 'um',
      betrag: 50,
    });
  });

  it('[REGRESSION] sollte Lese-Fragen NIE als Aktion deuten — das Imperativ-Gate', () => {
    // Jede dieser Fragen enthält „budget" und teils einen Betrag; eine
    // falsch gedeutete Frage würde eine Schreiboperation VORSCHLAGEN.
    expect(extrahiereBudgetAktion('Wie viel Budget habe ich noch?')).toBeNull();
    expect(extrahiereBudgetAktion('Welche Budgets sind überzogen?')).toBeNull();
    expect(extrahiereBudgetAktion('Kann ich noch 100 Euro ausgeben ohne mein Budget zu sprengen?')).toBeNull();
    expect(extrahiereBudgetAktion('kann ich mein budget erhöhen ohne meine sparziele zu gefährden')).toBeNull();
    expect(extrahiereBudgetAktion('wie hoch sollte mein Lebensmittelbudget sein')).toBeNull();
  });

  it('sollte ohne Budget-Wort nichts behaupten', () => {
    // „erhöhe" allein könnte alles meinen — ohne „budget" keine Aktion.
    expect(extrahiereBudgetAktion('erhöhe meine Sparrate um 50 €')).toBeNull();
    expect(extrahiereBudgetAktion('lege 500 € zurück')).toBeNull();
  });

  it('sollte Anlegen und Ändern ohne Betrag verwerfen statt zu raten', () => {
    expect(extrahiereBudgetAktion('leg ein Budget für Essen an')).toBeNull();
    expect(extrahiereBudgetAktion('erhöhe mein Freizeitbudget')).toBeNull();
  });

  it('sollte englische Befehle lesen', () => {
    expect(extrahiereBudgetAktion('set a budget of 200 for groceries')).toMatchObject({
      art: 'aendern',
      modus: 'auf',
      betrag: 200,
    });
    expect(extrahiereBudgetAktion('increase my food budget by 50')).toMatchObject({
      art: 'aendern',
      modus: 'um',
      betrag: 50,
      richtung: 'mehr',
    });
  });
});
