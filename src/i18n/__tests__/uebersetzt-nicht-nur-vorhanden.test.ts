/**
 * Ein Schlüssel kann VORHANDEN und trotzdem UNÜBERSETZT sein.
 *
 * `locale-parity.test.ts` vergleicht Schlüsselmengen und Platzhalter — also
 * die Struktur. Ob hinter einem Schlüssel auch wirklich die fremde Sprache
 * steht, sieht sie nicht: Ein leerer Wert und ein wörtlich kopierter deutscher
 * Satz bestehen beide die Paritätsprüfung. Auf dem Bildschirm steht dann
 * nichts oder Deutsch, und rot wird nichts.
 *
 * ZWEI PRÜFUNGEN MIT ZWEI VERSCHIEDENEN SCHÄRFEN, und das ist der Kern:
 *
 * 1. LEER — harte Regel, keine Ausnahme. Ein leerer Wert ist unter keinen
 *    Umständen eine Übersetzung. Stand: 0 in allen Sprachen.
 *
 * 2. WÖRTLICH WIE DEUTSCH — nur dort, wo es SCHÄDLICH ist. Gemessen sind das
 *    heute 175 Blätter im Englischen und 52 im Russischen, und **jedes
 *    einzelne davon ist richtig so**: Produktnamen (Spotify, PayPal, eToro,
 *    Supabase), Formatkürzel (CSV, PDF, .json), Währungscodes, Steuerformulare
 *    („Anlage N", „EÜR"), Umgebungsvariablen, Platzhalter („0", „178.50") und
 *    Symbole (%, Δ, Ø, ✓).
 *
 *    Eine Ratsche über diese Zahl wäre deshalb falsch: Der nächste
 *    Produktname würde sie heben, und ein Wächter, der die richtige Antwort
 *    bestraft, wird abgeschaltet statt durchgesetzt (dieselbe Lehre wie bei
 *    `check:money-format`). Gemeldet wird stattdessen die FORM, die einen
 *    kopierten Satz von einem Eigennamen unterscheidet: deutsche
 *    Sonderbuchstaben (ä ö ü ß) in einem Wert aus mindestens zwei Wörtern.
 *
 *    Ein Eigenname trägt keine Umlaute, und „EÜR" ist ein Wort — beide fallen
 *    nicht darunter. Ein versehentlich kopierter deutscher Satz trägt fast
 *    immer beides. Dieselbe Idee wie die Positionsregel in `check:i18n`: Nicht
 *    der Text entscheidet, sondern seine Gestalt.
 */

import { describe, it, expect } from 'vitest';
import { translations } from '../translations';
import { SUPPORTED_LOCALES } from '../locale';

function blaetter(
  knoten: unknown,
  pfad: string[] = [],
  aus: Record<string, string> = {},
): Record<string, string> {
  for (const [schluessel, wert] of Object.entries(knoten as Record<string, unknown>)) {
    if (typeof wert === 'string') aus[[...pfad, schluessel].join('.')] = wert;
    else if (wert && typeof wert === 'object') blaetter(wert, [...pfad, schluessel], aus);
  }
  return aus;
}

/** Deutsche Sonderbuchstaben — der Ausweis dafür, dass Text kopiert wurde. */
const DEUTSCHE_ZEICHEN = /[äöüßÄÖÜ]/;

const alleBaeume = translations as unknown as Record<string, unknown>;
const deutsch = blaetter(alleBaeume.de);
const fremdsprachen = SUPPORTED_LOCALES.filter((locale) => locale !== 'de');

describe('Übersetzungen sind übersetzt, nicht nur vorhanden', () => {
  it.each(fremdsprachen)('sollte in %s keinen leeren Wert tragen', (locale) => {
    const leer = Object.entries(blaetter(alleBaeume[locale]))
      .filter(([, wert]) => wert.trim() === '')
      .map(([schluessel]) => schluessel);

    // Ein leerer Wert rendert eine leere Stelle im Bildschirmtext, und die
    // Paritätsprüfung ist damit zufrieden. Keine Ausnahme.
    expect(leer).toEqual([]);
  });

  it.each(fremdsprachen)(
    'sollte in %s keinen wörtlich kopierten deutschen Satz tragen',
    (locale) => {
      const eigene = blaetter(alleBaeume[locale]);

      const kopiert = Object.keys(deutsch).filter((schluessel) => {
        const wert = eigene[schluessel];
        if (wert === undefined || wert !== deutsch[schluessel]) return false;
        // Ein Eigenname trägt keine Umlaute; „EÜR" ist ein einziges Wort.
        // Erst beides zusammen weist einen kopierten Satz aus.
        return DEUTSCHE_ZEICHEN.test(wert) && wert.trim().split(/\s+/).length >= 2;
      });

      expect(kopiert).toEqual([]);
    },
  );

  it('sollte den deutschen Baum als Bezug haben, nicht als Sprache unter vielen', () => {
    // Wenn diese Annahme fällt, misst der Test oben etwas anderes als er sagt.
    expect(SUPPORTED_LOCALES).toContain('de');
    expect(Object.keys(deutsch).length).toBeGreaterThan(1000);
  });
});
