/**
 * WP 6.4 (ARCH-5): Weltwechsel, Hover-Kopplung und Tap-Zuordnung der Stadt.
 * Lagen bis hierher als drei Effekte und ein `useCallback` in `CityPage.tsx`
 * und waren damit nur ueber einen WebGL-Canvas erreichbar — jsdom baut keinen.
 */
import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { renderHook, act } from '@testing-library/react';
import type { CityLevel, CityNavigationViewModel } from '../city-view-model';
import { OVERVIEW_BALANCE_DISTRICT_ID } from '../../domain/city-overview-adapter';
import type { CityModelTab } from '../use-city-model';
import { useCityWorld } from '../use-city-world';

/**
 * Nav-Attrappe. Alle Felder sind ausdruecklich uebergebbar — auch als
 * explizites `undefined`, dann greift die jeweilige Vorgabe.
 */
function createFakeNav(options?: { level?: CityLevel; focusDistrictId?: string | null }) {
  const actions = {
    tapDistrict: vi.fn<(id: string) => void>(),
    tapSubcategory: vi.fn<(id: string) => void>(),
    tapContract: vi.fn<(id: string) => void>(),
    closeContract: vi.fn<() => void>(),
    goTo: vi.fn<(level: CityLevel, id?: string) => void>(),
    zoomOutStep: vi.fn<() => void>(),
    reset: vi.fn<() => void>(),
  };
  const nav: CityNavigationViewModel = {
    level: options?.level ?? 'city',
    focusDistrictId: options?.focusDistrictId ?? null,
    activeDistrictId: null,
    activeSubcategoryId: null,
    selectedContractId: null,
    breadcrumb: [],
    cameraIntent: { seq: 0, kind: 'fit-city', targetId: null },
    actions,
  };
  return { ...nav, actions };
}

type FakeNav = ReturnType<typeof createFakeNav>;

const KEINE_EINNAHMEN: ReadonlySet<string> = new Set();

/**
 * Haelt den Tab so, wie `useCityPageModel` es tut (der Hook selbst ist
 * gesteuert — `useCityModel` braucht den Tab eine Zeile frueher). `level` und
 * `incomeDistrictIds` sind ausdruecklich uebergebbar, explizites `undefined`
 * faellt auf die Vorgabe zurueck.
 */
function renderWorld(
  nav: FakeNav,
  options?: { incomeDistrictIds?: ReadonlySet<string>; onInteract?: () => void; level?: CityLevel },
) {
  const rendered = renderHook(
    (props: { level: CityLevel }) => {
      const [tab, setTab] = useState<CityModelTab>('expenses');
      const world = useCityWorld({
        tab,
        setTab,
        nav: { ...nav, level: props.level },
        incomeDistrictIds: options?.incomeDistrictIds ?? KEINE_EINNAHMEN,
        onInteract: options?.onInteract,
      });
      return { ...world, tab, setTab };
    },
    { initialProps: { level: options?.level ?? ('city' as CityLevel) } },
  );
  return rendered;
}

describe('useCityWorld', () => {
  it('sollte beim Weltwechsel auf die Stadt-Ebene zuruecksetzen', () => {
    const nav = createFakeNav();
    const { result } = renderWorld(nav);
    nav.actions.goTo.mockClear();

    act(() => result.current.setTab('goals'));

    expect(nav.actions.goTo).toHaveBeenCalledWith('city');
  });

  it('sollte den Hover beim Ebenenwechsel aufheben — die gehoverte Box existiert im neuen Layout evtl. nicht mehr', () => {
    const nav = createFakeNav();
    const { result, rerender } = renderWorld(nav);

    act(() => result.current.setHoveredBox('leisure'));
    expect(result.current.hoveredBoxId).toBe('leisure');

    rerender({ level: 'district' });

    expect(result.current.hoveredBoxId).toBeNull();
  });

  it('sollte einen Tap auf ein Viertel an die Navigation weiterreichen', () => {
    const nav = createFakeNav();
    const { result } = renderWorld(nav);

    act(() => result.current.handleTapBox('leisure'));

    expect(nav.actions.tapDistrict).toHaveBeenCalledWith('leisure');
  });

  it('sollte einen Tap auf einen Balken als Unterkategorie-Tap weiterreichen', () => {
    const nav = createFakeNav();
    const { result } = renderWorld(nav);

    act(() => result.current.handleTapBox('leisure/streaming'));

    expect(nav.actions.tapSubcategory).toHaveBeenCalledWith('streaming');
  });

  it('sollte einen Tap auf eine Etage als Vertrags-Tap weiterreichen', () => {
    const nav = createFakeNav();
    const { result } = renderWorld(nav);

    act(() => result.current.handleTapBox('leisure/streaming/netflix'));

    expect(nav.actions.tapContract).toHaveBeenCalledWith('netflix');
  });

  it('sollte einen Tap auf Boden/Leere ignorieren und die erste Interaktion NICHT melden', () => {
    const nav = createFakeNav();
    const onInteract = vi.fn();
    const { result } = renderWorld(nav, { onInteract });

    act(() => result.current.handleTapBox(null));

    expect(nav.actions.tapDistrict).not.toHaveBeenCalled();
    expect(onInteract).not.toHaveBeenCalled();
  });

  it('sollte die erste erfolgreiche Interaktion melden (Erst-Besuch-Hinweis ausblenden)', () => {
    const nav = createFakeNav();
    const onInteract = vi.fn();
    const { result } = renderWorld(nav, { onInteract });

    act(() => result.current.handleTapBox('leisure'));

    expect(onInteract).toHaveBeenCalledTimes(1);
  });

  it('sollte beim zweiten Uebersichts-Tap in die Ausgaben-Welt wechseln UND den Distrikt direkt betreten', () => {
    const nav = createFakeNav({ focusDistrictId: 'leisure' });
    const { result } = renderWorld(nav);

    act(() => result.current.setTab('overview'));
    nav.actions.goTo.mockClear();
    act(() => result.current.handleTapBox('leisure'));

    expect(result.current.tab).toBe('expenses');
    expect(nav.actions.goTo).toHaveBeenCalledWith('district', 'leisure');
    expect(nav.actions.goTo).not.toHaveBeenCalledWith('city');
  });

  it('sollte beim zweiten Uebersichts-Tap auf ein Einnahmen-Viertel in die Einnahmen-Welt wechseln', () => {
    const nav = createFakeNav({ focusDistrictId: 'salary' });
    const { result } = renderWorld(nav, { incomeDistrictIds: new Set(['salary']) });

    act(() => result.current.setTab('overview'));
    act(() => result.current.handleTapBox('salary'));

    expect(result.current.tab).toBe('income');
  });

  it('sollte den Spar-Turm der Uebersicht nicht als Sprungziel behandeln', () => {
    const nav = createFakeNav({ focusDistrictId: OVERVIEW_BALANCE_DISTRICT_ID });
    const { result } = renderWorld(nav);

    act(() => result.current.setTab('overview'));
    act(() => result.current.handleTapBox(OVERVIEW_BALANCE_DISTRICT_ID));

    expect(result.current.tab).toBe('overview');
    expect(nav.actions.tapDistrict).not.toHaveBeenCalled();
  });
});
