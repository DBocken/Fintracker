import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithI18n } from '@/test-utils/render';
import { CityLegend } from '../CityLegend';
import type { CityModel } from '../../domain/city-model';

/**
 * WP-5.8 — Legende der visuellen Sprache.
 *
 * Zweisprachig nach AGENTS.md §6. Der Kern der Zusicherung ist nicht, DASS
 * Text erscheint, sondern dass er zu dem passt, was gerade auf dem Schirm ist:
 * eine Erklärung für etwas Unsichtbares schickt den Blick auf die Suche.
 */
const EXPENSES: CityModel = {
  districts: [
    {
      id: 'living',
      label: 'Lebenshaltung',
      color: '#3b82f6',
      total: 400,
      subcategories: [{ id: 'food', label: 'Lebensmittel', amount: 400, activity: 'busy' }],
    },
    {
      id: 'leisure',
      label: 'Freizeit',
      color: '#f97316',
      total: 100,
      subcategories: [{ id: 'streaming', label: 'Streaming', amount: 100 }],
    },
  ],
};

const GOALS: CityModel = {
  valueKind: 'progress',
  districts: [
    {
      id: 'goal:puffer',
      label: 'Puffer',
      color: '#3b82f6',
      total: 0.6,
      targetAmount: 1,
      stage: 'underway',
      subcategories: [{ id: 'progress', label: 'Puffer', amount: 0.6 }],
    },
  ],
};

describe.each(['de', 'en'] as const)('CityLegend (%s)', (locale) => {
  it('sollte die Höhe erklären', () => {
    renderWithI18n(
      <CityLegend open onOpenChange={vi.fn()} model={EXPENSES} level="city" hasFlowLines={false} />,
      locale,
    );

    expect(screen.getByTestId('city-legend-height')).toHaveTextContent(
      locale === 'de' ? /wie viel Geld/i : /how much money/i,
    );
  });

  it('sollte im Ziele-Tab den Fortschritt statt des Betrags erklären', () => {
    renderWithI18n(<CityLegend open onOpenChange={vi.fn()} model={GOALS} level="city" hasFlowLines={false} />, locale);

    expect(screen.getByTestId('city-legend-heightProgress')).toBeInTheDocument();
    expect(screen.queryByTestId('city-legend-height')).not.toBeInTheDocument();
  });

  it('[REGRESSION] sollte nichts erklären, was gerade nicht zu sehen ist', () => {
    // Flusslinien sind hier abgeschaltet (Qualitätsstufe oder Ebene) — eine
    // Erklärung dafür würde den Blick auf die Suche schicken.
    renderWithI18n(
      <CityLegend open onOpenChange={vi.fn()} model={EXPENSES} level="city" hasFlowLines={false} />,
      locale,
    );

    expect(screen.queryByTestId('city-legend-flowLines')).not.toBeInTheDocument();
    expect(screen.queryByTestId('city-legend-hull')).not.toBeInTheDocument();
    expect(screen.queryByTestId('city-legend-floors')).not.toBeInTheDocument();
  });

  it('sollte die Flusslinien erklären, sobald welche gezeichnet werden', () => {
    renderWithI18n(<CityLegend open onOpenChange={vi.fn()} model={EXPENSES} level="city" hasFlowLines />, locale);

    expect(screen.getByTestId('city-legend-flowLines')).toHaveTextContent(
      locale === 'de' ? /regelmäßig/i : /regularly/i,
    );
  });

  it('sollte einen Titel und einen Hinweis auf die Auswahl tragen', () => {
    renderWithI18n(
      <CityLegend open onOpenChange={vi.fn()} model={EXPENSES} level="city" hasFlowLines={false} />,
      locale,
    );

    expect(screen.getByText(locale === 'de' ? 'Die Stadt lesen' : 'Reading the city')).toBeInTheDocument();
    expect(
      screen.getByText(
        locale === 'de'
          ? 'Erklärt wird nur, was gerade zu sehen ist.'
          : 'Only what is currently visible is explained.',
      ),
    ).toBeInTheDocument();
  });

  it('sollte einen Anker für eine spätere Führung tragen', () => {
    // `docs/tutorial-progressive-disclosure.md`: „Ohne stabile Marker
    // (`data-tour-id`) bricht jeder Refactor die Tour still."
    const { baseElement } = renderWithI18n(
      <CityLegend open onOpenChange={vi.fn()} model={EXPENSES} level="city" hasFlowLines={false} />,
      locale,
    );

    expect(baseElement.querySelector('[data-tour-id="city-legend"]')).not.toBeNull();
  });
});
