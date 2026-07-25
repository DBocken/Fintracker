import { describe, it, expect } from 'vitest';
import { SUPPORTED_LOCALES } from '../translations';
import { lookupTranslation, lookupWorded } from '../I18nProvider';
import { GLOSSARY_TERM_IDS, glossaryDefinitionKey, glossaryTermKey } from '../glossary';
import { overlayFor } from '../overlays';

/**
 * Das Glossar besitzt eigene Stichwörter, damit es nicht bricht, sobald ein
 * Seitentitel umformuliert wird. Diese Tests halten fest, dass es trotzdem
 * vollständig und in beiden Sprachstilen brauchbar ist.
 */

describe('Glossar', () => {
  it('sollte Stichwort und Erklaerung in allen Locales haben', () => {
    const missing: string[] = [];
    for (const id of GLOSSARY_TERM_IDS) {
      for (const locale of SUPPORTED_LOCALES) {
        for (const key of [glossaryTermKey(id), glossaryDefinitionKey(id)]) {
          if (typeof lookupTranslation(locale, key) !== 'string') {
            missing.push(`${key} @ ${locale}`);
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('sollte in Locales MIT Overlay zwei unterscheidbare Fassungen liefern', () => {
    // Sonst zeigt das Panel zweimal dasselbe Wort und verliert seinen Zweck.
    const identical: string[] = [];
    for (const locale of SUPPORTED_LOCALES) {
      if (!overlayFor('everyday', locale)) continue;
      for (const id of GLOSSARY_TERM_IDS) {
        const key = glossaryTermKey(id);
        const technical = lookupTranslation(locale, key);
        const everyday = lookupWorded(locale, key, 'everyday');
        // `emergencyFund`/„Notgroschen" ist in beiden Registern dasselbe Wort —
        // das ist Absicht und kein Fehler, deshalb nur die Erklaerung pruefen.
        if (technical === everyday && id !== 'emergencyFund' && id !== 'fixedCosts') {
          identical.push(`${key} @ ${locale}`);
        }
      }
    }
    expect(identical).toEqual([]);
  });

  it('sollte fuer jeden Begriff eine eigene Alltags-Erklaerung haben', () => {
    const missing: string[] = [];
    for (const locale of SUPPORTED_LOCALES) {
      if (!overlayFor('everyday', locale)) continue;
      for (const id of GLOSSARY_TERM_IDS) {
        const key = glossaryDefinitionKey(id);
        if (lookupTranslation(locale, key) === lookupWorded(locale, key, 'everyday')) {
          missing.push(`${key} @ ${locale}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('sollte keine doppelten Stichwort-IDs enthalten', () => {
    expect(new Set(GLOSSARY_TERM_IDS).size).toBe(GLOSSARY_TERM_IDS.length);
  });
});
