import { describe, it, expect } from 'vitest';
import { matchesKeyword, WORD_BOUNDARY_MAX_LENGTH } from '../keyword-match';

describe('matchesKeyword', () => {
  describe('Wortgrenzen für kurze Keywords (≤ 6 Buchstaben)', () => {
    it('sollte "verein" NICHT in "Bausparverein" finden (Suffix-Kompositum)', () => {
      expect(matchesKeyword('bausparverein schwäbisch hall', 'verein')).toBe(false);
    });

    it('sollte "verein" als eigenständiges Wort finden', () => {
      expect(matchesKeyword('sportverein köln beitrag', 'verein')).toBe(false);
      expect(matchesKeyword('verein für deutsche schäferhunde', 'verein')).toBe(true);
      expect(matchesKeyword('beitrag verein 2026', 'verein')).toBe(true);
    });

    it('sollte "verdi" NICHT in "Verdienstabrechnung" finden (Präfix)', () => {
      expect(matchesKeyword('verdienstabrechnung juli', 'verdi')).toBe(false);
      expect(matchesKeyword('verdi mitgliedsbeitrag', 'verdi')).toBe(true);
    });

    it('sollte "etf" NICHT in "GetFit" finden', () => {
      expect(matchesKeyword('getfit gmbh mitgliedschaft', 'etf')).toBe(false);
      expect(matchesKeyword('msci world etf sparplan', 'etf')).toBe(true);
    });

    it('sollte "miete" NICHT in "gemietet" finden', () => {
      expect(matchesKeyword('objekt gemietet zahlung', 'miete')).toBe(false);
      expect(matchesKeyword('miete januar wohnung', 'miete')).toBe(true);
    });

    it('sollte am String-Anfang und -Ende als Wortgrenze werten', () => {
      expect(matchesKeyword('miete', 'miete')).toBe(true);
      expect(matchesKeyword('warmmiete', 'miete')).toBe(false);
    });

    it('sollte Satzzeichen/Bindestriche als Wortgrenze werten', () => {
      expect(matchesKeyword('uber *trip help.uber.com', 'uber')).toBe(true);
      expect(matchesKeyword('gez-beitragsservice', 'gez')).toBe(true);
      expect(matchesKeyword('zuber gmbh', 'uber')).toBe(false);
    });

    it('sollte spätere eigenständige Vorkommen finden (nicht nur das erste)', () => {
      expect(matchesKeyword('bausparverein und verein', 'verein')).toBe(true);
    });

    it('sollte Ziffern als Wortbestandteil werten (keine Grenze)', () => {
      // "obi" klebt an Ziffern → kein eigenständiges Wort (z. B. Kundennummern).
      expect(matchesKeyword('kdnr123obi456', 'obi')).toBe(false);
      expect(matchesKeyword('obi baumarkt 123', 'obi')).toBe(true);
    });
  });

  describe('Umlaut-Sicherheit (kein ASCII-\\b)', () => {
    it('sollte kurze Umlaut-Keywords mit echten Wortgrenzen matchen', () => {
      expect(matchesKeyword('möbel martin gmbh', 'möbel')).toBe(true);
      // Kompositum: strikte Grenze — Kompensation erfolgt über eigenes Keyword "möbelhaus".
      expect(matchesKeyword('möbelhaus xxl', 'möbel')).toBe(false);
    });

    it('sollte Umlaute als Wortbestandteil werten (Grenze nicht mitten im Wort)', () => {
      // "für" endet vor "verein"? Nein: "fürverein" wäre ein Wort — ü ist Buchstabe, keine Grenze.
      expect(matchesKeyword('xyzfürverein', 'verein')).toBe(false);
    });
  });

  describe('Substring-Verhalten für lange/mehrteilige Keywords', () => {
    it('sollte lange Keywords als Substring matchen (Komposita-freundlich)', () => {
      // 'heizung' (7 Zeichen) > Grenzwert → Substring, matcht Komposita.
      expect(matchesKeyword('fernheizung stadtwerke', 'heizung')).toBe(true);
      expect(matchesKeyword('kaltmiete januar', 'kaltmiete')).toBe(true);
    });

    it('sollte Keywords mit Leerzeichen/Punkten als Substring matchen', () => {
      expect(matchesKeyword('trade republic bank gmbh', 'trade republic')).toBe(true);
      expect(matchesKeyword('e.on energie deutschland', 'e.on')).toBe(true);
      expect(matchesKeyword('ver.di bezirk', 'ver.di')).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('sollte case-insensitiv sein', () => {
      expect(matchesKeyword('REWE SAGT DANKE', 'rewe')).toBe(true);
      expect(matchesKeyword('rewe markt', 'REWE')).toBe(true);
    });

    it('sollte mit leeren Eingaben umgehen', () => {
      expect(matchesKeyword('', 'rewe')).toBe(false);
      expect(matchesKeyword('rewe', '')).toBe(false);
    });

    it('sollte den Grenzwert exportieren (Auditierbarkeit der Heuristik)', () => {
      expect(WORD_BOUNDARY_MAX_LENGTH).toBe(6);
    });
  });
});
