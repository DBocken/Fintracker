import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/render';
import { SUPPORTED_LOCALES } from '@/i18n/translations';
import { WordingSettings } from '../WordingSettings';

/**
 * Die Karte ist der dauerhaft sichtbare Ausgang aus dem Sprachstil
 * (docs/tutorial-progressive-disclosure.md) und zugleich der Ort, an dem das
 * Glossar ohne Zufallsfund erreichbar ist.
 */

describe('WordingSettings', () => {
  it('sollte den Sprachstil-Titel auf Deutsch zeigen', () => {
    renderWithI18n(<WordingSettings />, 'de');
    expect(screen.getByText('Sprachstil')).toBeInTheDocument();
  });

  it('sollte den Sprachstil-Titel auf Englisch zeigen', () => {
    renderWithI18n(<WordingSettings />, 'en');
    expect(screen.getByText('Wording')).toBeInTheDocument();
  });

  it('sollte das vollstaendige Glossar auflisten', () => {
    renderWithI18n(<WordingSettings />, 'de', 'technical');
    // Stichprobe ueber verschiedene Namespaces des Glossars.
    expect(screen.getByText('Liquidität')).toBeInTheDocument();
    expect(screen.getByText('Sparquote')).toBeInTheDocument();
    expect(screen.getByText('Tilgung')).toBeInTheDocument();
  });

  it('sollte in der Alltagssprache die Alltagsbegriffe auflisten', () => {
    renderWithI18n(<WordingSettings />, 'de', 'everyday');
    expect(screen.getByText('Verfügbares Geld')).toBeInTheDocument();
    expect(screen.getByText('Wie viel du sparst')).toBeInTheDocument();
  });

  it('sollte zu jedem Begriff die Entsprechung im anderen Sprachstil zeigen', () => {
    renderWithI18n(<WordingSettings />, 'de', 'everyday');
    // Alltagsbegriff als Stichwort, Fachbegriff als Gegenstueck.
    expect(screen.getByText('Verfügbares Geld')).toBeInTheDocument();
    expect(screen.getByText('Liquidität')).toBeInTheDocument();
  });

  it.each(SUPPORTED_LOCALES)('sollte den Schalter in %s anbieten', (locale) => {
    // Seit jede unterstuetzte Sprache ein Overlay hat, ist der Schalter
    // ueberall nutzbar. Das ist die Oberflaechen-Seite von
    // `overlay-coverage.test.ts`: dort wird geprueft, DASS ein Overlay
    // existiert, hier, dass die Nutzerin es auch einschalten kann.
    renderWithI18n(<WordingSettings />, locale);
    expect(screen.getByRole('combobox')).not.toBeDisabled();
  });

  it('sollte fuer Locales ohne Overlay den Schalter sperren', () => {
    // Subjekt war frueher `ru`. Seit Russisch ein vollstaendiges Overlay hat,
    // uebernimmt `tlh` die Rolle: bekannte Locale aus `INACTIVE_LOCALES`, die
    // absichtlich keine Alltagssprache bekommt. Ein aktiver Schalter waere
    // dort eine leere Zusage.
    //
    // Geprueft wird nur der gesperrte Schalter, nicht der Hinweistext:
    // `tlh` ist nicht paritaetspflichtig, der Text existiert dort also gar
    // nicht — eine Assertion darauf wuerde die Fallback-Kette testen statt
    // das Verhalten.
    renderWithI18n(<WordingSettings />, 'tlh');
    expect(screen.getByRole('combobox')).toBeDisabled();
  });
});
