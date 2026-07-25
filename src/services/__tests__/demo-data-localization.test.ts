import { describe, it, expect, afterEach } from 'vitest';
import { buildDemoDataset } from '../demo-data-service';

/**
 * Demo-Buchungen sind autorierter Inhalt, kein Nutzerdatum — ihre
 * Beschreibungen folgen deshalb der Sprache.
 *
 * Die `payee`-Werte bleiben dagegen unangetastet: das sind Händler- und
 * Firmennamen (REWE, Netflix, „Wohnbau Süd"). Ein Buchungspartner ist ein
 * Datum, keine Beschriftung — er wird in keiner Sprache umgeschrieben.
 */

const LOCALE_STORAGE_KEY = 'ausgabentracker_locale_v1';
const FIXED_NOW = new Date('2026-03-15T12:00:00Z');

afterEach(() => {
  window.localStorage.removeItem(LOCALE_STORAGE_KEY);
});

function descriptionsFor(locale: string): string[] {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  return buildDemoDataset(FIXED_NOW, 1).transactions.map((t) => t.description ?? '');
}

describe('Lokalisierte Demo-Daten', () => {
  it('sollte die Beschreibungen auf Deutsch erzeugen', () => {
    const descriptions = descriptionsFor('de');
    expect(descriptions).toContain('Gehalt');
    expect(descriptions).toContain('Wocheneinkauf');
  });

  it('[REGRESSION] sollte die Beschreibungen auf Englisch erzeugen', () => {
    // Vorher waren die Templates eine Modul-`const` — eine dort aufgeloeste
    // Uebersetzung haette beim Import eingefroren und diesen Fall nie erfuellt.
    const descriptions = descriptionsFor('en');
    expect(descriptions).toContain('Salary');
    expect(descriptions).toContain('Weekly shop');
    expect(descriptions).not.toContain('Gehalt');
  });

  it('sollte die Beschreibungen auf Russisch erzeugen', () => {
    const descriptions = descriptionsFor('ru');
    expect(descriptions).toContain('Зарплата');
  });

  it('[REGRESSION] sollte Buchungspartner in JEDER Sprache unveraendert lassen', () => {
    // Haendlernamen sind Daten. Sie zu uebersetzen waere derselbe Fehler wie
    // uebersetzte Such-Stichwoerter.
    const payeesFor = (locale: string) => {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
      return buildDemoDataset(FIXED_NOW, 1).transactions.map((t) => t.payee);
    };
    const german = payeesFor('de');
    expect(german).toContain('REWE');
    expect(payeesFor('en')).toEqual(german);
    expect(payeesFor('ru')).toEqual(german);
  });

  it('sollte in jeder Sprache dieselbe Anzahl Buchungen erzeugen', () => {
    // Die Uebersetzung darf die Datenmenge nicht beeinflussen.
    expect(descriptionsFor('en').length).toBe(descriptionsFor('de').length);
  });
});
