import { describe, it, expect, beforeEach } from 'vitest';
import {
  DEFAULT_WORDING,
  BASE_WORDING,
  SUPPORTED_WORDINGS,
  WORDING_STORAGE_KEY,
  isWording,
  resolveInitialWording,
} from '../wording';
import { lookupTranslation, lookupWorded } from '../I18nProvider';
import { overlayFor } from '../overlays';

/**
 * Sprachstil (`wording`) ist eine eigene Achse neben der Sprache: der Basisbaum
 * in translations.ts IST die Fachsprache, `everyday` ist ein duennes Overlay.
 * Diese Tests sichern die Aufloesungsreihenfolge und den Rueckfall auf die Basis.
 */

describe('Sprachstil-Aufloesung', () => {
  beforeEach(() => {
    window.localStorage.removeItem(WORDING_STORAGE_KEY);
  });

  it('sollte Alltagssprache als Standard verwenden', () => {
    expect(DEFAULT_WORDING).toBe('everyday');
  });

  it('sollte die Fachsprache als Basis-Register kennzeichnen', () => {
    // Der Basisbaum wird fuer dieses Register unveraendert ausgeliefert.
    expect(BASE_WORDING).toBe('technical');
  });

  it('sollte genau zwei Register unterstuetzen', () => {
    expect(SUPPORTED_WORDINGS).toEqual(['everyday', 'technical']);
  });

  it('sollte gueltige Register erkennen und alles andere ablehnen', () => {
    expect(isWording('everyday')).toBe(true);
    expect(isWording('technical')).toBe(true);
    expect(isWording('beginner')).toBe(false);
    expect(isWording(null)).toBe(false);
    expect(isWording(undefined)).toBe(false);
  });

  it('sollte den gespeicherten Sprachstil lesen', () => {
    window.localStorage.setItem(WORDING_STORAGE_KEY, 'technical');
    expect(resolveInitialWording()).toBe('technical');
  });

  it('sollte bei ungueltigem gespeicherten Wert auf den Standard zurueckfallen', () => {
    window.localStorage.setItem(WORDING_STORAGE_KEY, 'expert-mode');
    expect(resolveInitialWording()).toBe(DEFAULT_WORDING);
  });

  it('sollte ohne gespeicherte Wahl den Standard liefern', () => {
    expect(resolveInitialWording()).toBe(DEFAULT_WORDING);
  });
});

describe('lookupWorded', () => {
  /** Fachbegriff mit Overlay-Eintrag. */
  const OVERLAID_KEY = 'netWorth.liquidity';
  /** Allgemeiner Begriff, der bewusst kein Register kennt. */
  const PLAIN_KEY = 'common.save';

  it('sollte fuer die Fachsprache exakt den Basistext liefern', () => {
    expect(lookupWorded('de', OVERLAID_KEY, 'technical')).toBe('Liquidität');
    expect(lookupWorded('de', OVERLAID_KEY, 'technical')).toBe(
      lookupTranslation('de', OVERLAID_KEY),
    );
  });

  it('sollte fuer die Alltagssprache den Overlay-Eintrag liefern', () => {
    expect(lookupWorded('de', OVERLAID_KEY, 'everyday')).toBe('Verfügbares Geld');
  });

  it('sollte bei fehlendem Overlay-Eintrag auf den Basistext zurueckfallen', () => {
    // Overlay-Miss ist der Normalfall, kein Fehler.
    expect(lookupWorded('de', PLAIN_KEY, 'everyday')).toBe(lookupTranslation('de', PLAIN_KEY));
  });

  it('sollte fuer Locales ohne Overlay den Basistext liefern', () => {
    // Subjekt war frueher `ru` — das hat inzwischen ein vollstaendiges
    // Overlay (siehe `overlay-coverage.test.ts`, das genau das erzwingt).
    // Die MECHANIK muss trotzdem geprueft bleiben, also uebernimmt `tlh` die
    // Rolle: eine bekannte Locale aus `INACTIVE_LOCALES`, die absichtlich
    // keine Alltagssprache bekommt und deshalb komplett auf die Basis
    // durchfallen muss.
    expect(overlayFor('everyday', 'tlh')).toBeUndefined();
    expect(lookupWorded('tlh', OVERLAID_KEY, 'everyday')).toBe(
      lookupTranslation('tlh', OVERLAID_KEY),
    );
  });

  it('sollte fuer unbekannte Keys undefined liefern', () => {
    expect(lookupWorded('de', 'gibt.es.nicht', 'everyday')).toBeUndefined();
  });

  it('sollte fuer die Fachsprache kein Overlay konsultieren', () => {
    // Auch wenn ein Overlay-Eintrag existiert, gewinnt im Register `technical`
    // immer der Basistext.
    const overlay = overlayFor('everyday', 'de');
    const firstKey = overlay ? Object.keys(overlay)[0] : undefined;
    if (!firstKey) return; // Welle 0: Overlays sind noch leer
    expect(lookupWorded('de', firstKey, 'technical')).toBe(lookupTranslation('de', firstKey));
  });
});
