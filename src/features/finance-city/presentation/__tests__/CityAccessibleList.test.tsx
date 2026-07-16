import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithI18n } from '@/test-utils/render';
import { CityAccessibleList } from '../CityAccessibleList';
import type { CityModel } from '../../domain/city-model';
import type { CityNavigationViewModel } from '../../application/city-view-model';

function makeModel(): CityModel {
  return {
    districts: [
      {
        id: 'housing',
        label: 'Wohnen',
        color: '#1d5c54',
        total: 1069,
        subcategories: [{ id: 'rent', label: 'Miete', amount: 980 }],
      },
      {
        id: 'leisure',
        label: 'Freizeit',
        color: '#7d6b8a',
        total: 79.97,
        subcategories: [
          { id: 'hobbies', label: 'Hobbys', amount: 40 },
          {
            id: 'streaming',
            label: 'Streaming & Abos',
            amount: 39.97,
            contracts: [
              { id: 'netflix', label: 'Netflix', amount: 17.99 },
              { id: 'spotify', label: 'Spotify', amount: 10.99 },
            ],
          },
        ],
      },
    ],
  };
}

function makeNav(overrides: Partial<CityNavigationViewModel> = {}): CityNavigationViewModel {
  return {
    level: 'city',
    focusDistrictId: null,
    activeDistrictId: null,
    activeSubcategoryId: null,
    selectedContractId: null,
    breadcrumb: [{ level: 'city', id: null, label: 'Stadt' }],
    cameraIntent: { seq: 1, kind: 'fit-city', targetId: null },
    actions: {
      tapDistrict: vi.fn(),
      tapSubcategory: vi.fn(),
      tapContract: vi.fn(),
      closeContract: vi.fn(),
      goTo: vi.fn(),
      zoomOutStep: vi.fn(),
      reset: vi.fn(),
    },
    ...overrides,
  };
}

describe.each(['de', 'en'] as const)('CityAccessibleList (%s)', (locale) => {
  it('sollte auf city-Ebene die Distrikte mit ihren Beträgen rendern', () => {
    const model = makeModel();
    const nav = makeNav();
    renderWithI18n(<CityAccessibleList model={model} nav={nav} />, locale);

    expect(screen.getByRole('button', { name: /Wohnen/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Freizeit/ })).toBeInTheDocument();
  });

  it('sollte bei Klick auf eine Distrikt-Zeile tapDistrict mit der Distrikt-Id aufrufen', async () => {
    const model = makeModel();
    const nav = makeNav();
    const user = userEvent.setup();
    renderWithI18n(<CityAccessibleList model={model} nav={nav} />, locale);

    await user.click(screen.getByRole('button', { name: /Wohnen/ }));

    expect(nav.actions.tapDistrict).toHaveBeenCalledWith('housing');
  });

  it('sollte auf district-Ebene die Unterkategorien der aktiven Distrikts rendern und tapSubcategory auslösen', async () => {
    const model = makeModel();
    const nav = makeNav({
      level: 'district',
      activeDistrictId: 'leisure',
      breadcrumb: [
        { level: 'city', id: null, label: 'Stadt' },
        { level: 'district', id: 'leisure', label: 'Freizeit' },
      ],
    });
    const user = userEvent.setup();
    renderWithI18n(<CityAccessibleList model={model} nav={nav} />, locale);

    expect(screen.getByRole('button', { name: /Hobbys/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Streaming/ }));

    expect(nav.actions.tapSubcategory).toHaveBeenCalledWith('streaming');
  });

  it('sollte auf subcategory-Ebene die Verträge rendern und tapContract auslösen', async () => {
    const model = makeModel();
    const nav = makeNav({
      level: 'subcategory',
      activeDistrictId: 'leisure',
      activeSubcategoryId: 'streaming',
      breadcrumb: [
        { level: 'city', id: null, label: 'Stadt' },
        { level: 'district', id: 'leisure', label: 'Freizeit' },
        { level: 'subcategory', id: 'streaming', label: 'Streaming & Abos' },
      ],
    });
    const user = userEvent.setup();
    renderWithI18n(<CityAccessibleList model={model} nav={nav} />, locale);

    await user.click(screen.getByRole('button', { name: /Netflix/ }));

    expect(nav.actions.tapContract).toHaveBeenCalledWith('netflix');
  });

  it('sollte eine aria-live-Region mit dem aktuellen Pfad rendern', () => {
    const model = makeModel();
    const nav = makeNav({
      breadcrumb: [
        { level: 'city', id: null, label: 'Stadt' },
        { level: 'district', id: 'leisure', label: 'Freizeit' },
      ],
    });
    renderWithI18n(<CityAccessibleList model={model} nav={nav} />, locale);

    const region = screen.getByTestId('city-list-path-announcement');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region.textContent).toContain('Stadt');
    expect(region.textContent).toContain('Freizeit');
  });

  it('sollte den Zurück-zur-3D-Ansicht-Button togglen (onBackToCanvas aufrufen)', async () => {
    const model = makeModel();
    const nav = makeNav();
    const onBackToCanvas = vi.fn();
    const user = userEvent.setup();
    renderWithI18n(<CityAccessibleList model={model} nav={nav} onBackToCanvas={onBackToCanvas} />, locale);

    await user.click(screen.getByRole('button', { name: /3D/ }));

    expect(onBackToCanvas).toHaveBeenCalledTimes(1);
  });

  it('sollte alle Zeilen-Touch-Ziele mit mindestens 44px Mindesthöhe rendern', () => {
    const model = makeModel();
    const nav = makeNav();
    renderWithI18n(<CityAccessibleList model={model} nav={nav} />, locale);

    // `InteractiveCard`s Karten-Chrome garantiert das ≥44px-Touch-Ziel (`min-h-[44px]`).
    expect(screen.getByRole('button', { name: /Wohnen/ }).className).toMatch(/min-h-\[44px\]/);
  });
});
