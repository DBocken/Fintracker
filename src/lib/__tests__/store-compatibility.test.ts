import { describe, it, expect } from 'vitest';
import {
  StoreVersionTooNewError,
  checkStoreCompatibility,
  parseStoredVersion,
} from '../store-compatibility';

/**
 * [INTEGRITY] WP-11.3 — Rollback ohne Datenverlust.
 *
 * Der Fall, um den es geht, ist unspektakulär und teuer: Eine Auslieferung
 * wird zurückgenommen. Eine **ältere** App trifft auf **neuere** Daten. Ohne
 * Prüfung liest sie, was sie versteht, ignoriert den Rest — und schreibt ihn
 * beim nächsten Speichern weg. Kein Absturz, keine Meldung; der Verlust fällt
 * Wochen später auf.
 */

describe('parseStoredVersion', () => {
  it.each([
    ['2', 2],
    ['10', 10],
  ])('sollte %s als %i lesen', (raw, expected) => {
    expect(parseStoredVersion(raw)).toBe(expected);
  });

  it.each([null, '', 'zwei', '0', '-1', 'NaN'])(
    'sollte %s als „nichts Verwertbares" behandeln',
    (raw) => {
      expect(parseStoredVersion(raw)).toBeNull();
    },
  );
});

describe('checkStoreCompatibility', () => {
  it('sollte gleiche Staende durchlassen', () => {
    expect(checkStoreCompatibility('2', 2)).toEqual({ status: 'ok' });
  });

  it('sollte eine aeltere Ablage zur Migration freigeben', () => {
    expect(checkStoreCompatibility('1', 2)).toEqual({ status: 'migrate', from: 1, to: 2 });
  });

  it('[INTEGRITY][REGRESSION] sollte eine NEUERE Ablage verweigern', () => {
    // Das ist der Rollback-Fall. „So gut es geht" ist hier die falsche
    // Antwort: Ein Rollback darf Daten kosten, aber keine zerstoeren.
    expect(checkStoreCompatibility('3', 2)).toEqual({ status: 'refuse', stored: 3, supported: 2 });
  });

  it('sollte einen Bestand ohne Eintrag nicht aussperren', () => {
    // Ablagen aus der Zeit vor dieser Pruefung haben keinen Eintrag. Sie als
    // unbekannt zu verweigern hiesse, bestehende Nutzer von ihrer eigenen
    // Buchfuehrung auszusperren.
    expect(checkStoreCompatibility(null, 2)).toEqual({ status: 'migrate', from: 1, to: 2 });
    expect(checkStoreCompatibility(null, 1)).toEqual({ status: 'ok' });
  });

  it('sollte einen beschaedigten Eintrag wie „kein Eintrag" behandeln', () => {
    // In beiden Faellen gibt es nichts zu retten, und ein Schreiben ist
    // gefahrlos — im Gegensatz zum Fall „neuer als ich".
    expect(checkStoreCompatibility('kaputt', 2)).toEqual({ status: 'migrate', from: 1, to: 2 });
  });
});

describe('StoreVersionTooNewError', () => {
  it('sollte beide Versionen mitfuehren', () => {
    // Die Oberflaeche muss „deine App ist zu alt" von „Speicher kaputt"
    // unterscheiden koennen — hier ist nichts kaputt.
    const error = new StoreVersionTooNewError(3, 2);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('StoreVersionTooNewError');
    expect(error.stored).toBe(3);
    expect(error.supported).toBe(2);
  });
});
