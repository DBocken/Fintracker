import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/render';
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

  it('sollte fuer Locales ohne Overlay den Schalter sperren und das sagen', () => {
    // `ru` hat kein Alltagssprache-Overlay — ein aktiver Schalter waere eine
    // leere Zusage.
    renderWithI18n(<WordingSettings />, 'ru');
    expect(
      screen.getByText('Для этого языка пока доступен только профессиональный стиль.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeDisabled();
  });
});
