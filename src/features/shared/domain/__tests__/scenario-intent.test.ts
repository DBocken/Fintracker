import { describe, expect, it } from 'vitest';
import {
  extrahiereSzenarioAbsicht,
  parseBetraege,
  parseZukunft,
} from '@/features/shared/domain/scenario-intent';

/** Fixes „heute" für reproduzierbare Offsets: Montag, 24. August 2026. */
const JETZT = new Date('2026-08-24T12:00:00Z');

describe('parseBetraege', () => {
  it('sollte mehrere Beträge in Textreihenfolge liefern', () => {
    const werte = parseBetraege('ich verdiene 2000 € und will 5.000 € ausgeben').map((b) => b.wert);
    expect(werte).toEqual([2000, 5000]);
  });

  it('sollte das k-Suffix als Faktor 1000 lesen', () => {
    expect(parseBetraege('2k netto')[0]?.wert).toBe(2000);
    expect(parseBetraege('für 5k in den urlaub')[0]?.wert).toBe(5000);
    expect(parseBetraege('1,5k miete')[0]?.wert).toBe(1500);
  });

  it('sollte deutsche Tausenderpunkte und Komma-Nachkommastellen lesen', () => {
    expect(parseBetraege('1.200,50 euro')[0]?.wert).toBe(1200.5);
  });

  it('sollte kleine nackte Zahlen ohne Ausweis NICHT als Betrag werten', () => {
    // „3 kinder", „2 wochen" — eine Anzahl, kein Geld.
    expect(parseBetraege('wir sind 3 kinder und 2 erwachsene')).toEqual([]);
    // Mit Währungszeichen zählt auch eine kleine Zahl.
    expect(parseBetraege('nur 5 €')[0]?.wert).toBe(5);
  });
});

describe('parseZukunft', () => {
  it('sollte „in 2 monaten" als 60 Tage lesen', () => {
    expect(parseZukunft('in 2 monaten', 'de', JETZT)[0]?.abTag).toBe(60);
  });

  it('sollte Wochen und Tage umrechnen', () => {
    expect(parseZukunft('in 3 wochen', 'de', JETZT)[0]?.abTag).toBe(21);
    expect(parseZukunft('in 10 tagen', 'de', JETZT)[0]?.abTag).toBe(10);
  });

  it('sollte einen Monatsnamen in die ZUKUNFT auflösen — Gegenrichtung zu parseZeitraum', () => {
    // August 2026 → „im dezember" meint den 1. Dezember 2026 (99 Tage),
    // nicht den Dezember 2025, den parseZeitraum für Auswertungen wählt.
    const treffer = parseZukunft('im dezember', 'de', JETZT);
    expect(treffer[0]?.abTag).toBe(99);
  });

  it('sollte einen bereits vergangenen Monat ins Folgejahr schieben', () => {
    // „im märz" im August 2026 → 1. März 2027.
    const treffer = parseZukunft('im maerz', 'de', JETZT);
    const erwartet = Math.round(
      (Date.UTC(2027, 2, 1) - JETZT.getTime()) / (24 * 60 * 60 * 1000),
    );
    expect(treffer[0]?.abTag).toBe(erwartet);
  });

  it('sollte englische und russische Ausdrücke lesen', () => {
    expect(parseZukunft('in 2 months', 'en', JETZT)[0]?.abTag).toBe(60);
    expect(parseZukunft('через 2 месяца', 'ru', JETZT)[0]?.abTag).toBe(60);
    expect(parseZukunft('in december', 'en', JETZT)[0]?.abTag).toBe(99);
    expect(parseZukunft('в декабре', 'ru', JETZT)[0]?.abTag).toBe(99);
  });

  it('sollte ohne Zukunftsausdruck leer bleiben', () => {
    expect(parseZukunft('wieviel habe ich letzten monat ausgegeben', 'de', JETZT)).toEqual([]);
  });
});

describe('extrahiereSzenarioAbsicht', () => {
  it('sollte die Referenzfrage in ihre Deltas zerlegen — der Abnahmetest des Pakets', () => {
    const absicht = extrahiereSzenarioAbsicht(
      'Ich verdiene aktuell 2k netto und bekomme in 2 Monaten eine Gehaltserhöhung. ' +
        'Mein Auto würde ich verkaufen. ' +
        'Kann ich im Dezember für 5k in den Urlaub fliegen, ohne in den Notgroschen zu fallen?',
      'de',
      JETZT,
    );

    expect(absicht).not.toBeNull();
    expect(absicht?.schwelle).toBe('notgroschen');

    const arten = absicht?.deltas.map((d) => d.art);
    expect(arten).toContain('einkommen');
    expect(arten).toContain('flow_entfaellt');
    expect(arten).toContain('einmalausgabe');

    const einkommen = absicht?.deltas.find((d) => d.art === 'einkommen');
    expect(einkommen).toMatchObject({ abTag: 60 });
    // „2k" ist der IST-Stand („verdiene aktuell") — er darf NICHT als
    // Erhöhungsbetrag geraten werden. Unbeziffert heisst: die Fläche fragt.
    expect(einkommen && 'betragProMonat' in einkommen && einkommen.betragProMonat).toBeUndefined();

    const auto = absicht?.deltas.find((d) => d.art === 'flow_entfaellt');
    expect(auto).toMatchObject({ konzept: 'auto' });
    expect(auto && 'stichworte' in auto ? auto.stichworte : []).toContain('kraftstoff');

    const urlaub = absicht?.deltas.find((d) => d.art === 'einmalausgabe');
    expect(urlaub).toMatchObject({ betrag: 5000, abTag: 99 });
  });

  it('sollte einen Jobverlust als −100 % erkennen', () => {
    const absicht = extrahiereSzenarioAbsicht(
      'was passiert wenn ich in 3 monaten meinen job verliere',
      'de',
      JETZT,
    );
    expect(absicht?.deltas).toContainEqual({ art: 'einkommen', prozent: -100, abTag: 90 });
  });

  it('sollte eine Mieterhöhung NICHT als Einkommensdelta lesen', () => {
    // „erhoehung" allein ist kein Einkommenssignal — nur die Komposita.
    // Ohne beziffertes Delta bleibt die Aussage ehrlich unverstanden (null),
    // statt als Gehaltserhöhung simuliert zu werden.
    expect(
      extrahiereSzenarioAbsicht('meine mieterhöhung kommt in 2 monaten', 'de', JETZT),
    ).toBeNull();
  });

  it('sollte einen konkreten Vertragsnamen als Stichwort übernehmen', () => {
    const absicht = extrahiereSzenarioAbsicht('was wäre wenn ich netflix kündige', 'de', JETZT);
    const delta = absicht?.deltas.find((d) => d.art === 'flow_entfaellt');
    expect(delta && 'stichworte' in delta ? delta.stichworte : []).toContain('netflix');
  });

  it('sollte monatliches Zusatzsparen als Ausgabe führen — Sparen bindet Geld', () => {
    const absicht = extrahiereSzenarioAbsicht(
      'wenn ich 200 € im monat zusätzlich spare',
      'de',
      JETZT,
    );
    expect(absicht?.deltas).toContainEqual({
      art: 'flow_neu',
      betragProMonat: 200,
      richtung: 'ausgabe',
      abTag: 0,
    });
  });

  it('sollte monatliches Zusatzeinkommen als Einnahme führen', () => {
    const absicht = extrahiereSzenarioAbsicht(
      'ich verdiene mit einem nebenjob 400 € im monat dazu',
      'de',
      JETZT,
    );
    expect(absicht?.deltas).toContainEqual({
      art: 'flow_neu',
      betragProMonat: 400,
      richtung: 'einnahme',
      abTag: 0,
    });
  });

  it('sollte für eine reine Bestandsfrage null liefern', () => {
    expect(
      extrahiereSzenarioAbsicht('wieviel habe ich letzten monat für essen ausgegeben', 'de', JETZT),
    ).toBeNull();
    expect(extrahiereSzenarioAbsicht('was kostet mich mein auto', 'de', JETZT)).toBeNull();
  });

  it('sollte die einfache Leistbarkeitsfrage ohne Deltas null lassen', () => {
    // „kann ich mir 800 € leisten" gehört zur bestehenden Leistbarkeits-
    // Familie — KEIN Kombinations-Szenario: Betrag, aber kein Zukunftstermin
    // und keine weiteren Deltas.
    expect(extrahiereSzenarioAbsicht('kann ich mir 800 € leisten', 'de', JETZT)).toBeNull();
  });

  it('sollte englische Szenarien zerlegen', () => {
    const absicht = extrahiereSzenarioAbsicht(
      'if i sell my car, can i spend 3k on a holiday in december without touching my emergency fund',
      'en',
      JETZT,
    );
    expect(absicht?.schwelle).toBe('notgroschen');
    expect(absicht?.deltas.map((d) => d.art)).toEqual(
      expect.arrayContaining(['flow_entfaellt', 'einmalausgabe']),
    );
  });
});
