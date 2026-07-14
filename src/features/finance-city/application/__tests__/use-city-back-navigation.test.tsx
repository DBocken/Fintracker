import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { CityNavigationViewModel } from '../city-view-model';
import { useCityBackNavigation } from '../use-city-back-navigation';

const isNativePlatformMock = vi.fn();
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => isNativePlatformMock() },
}));

type BackButtonHandler = (event: { canGoBack: boolean }) => void;

const addListenerMock = vi.fn();
vi.mock('@capacitor/app', () => ({
  App: { addListener: (...args: unknown[]) => addListenerMock(...args) },
}));

/** Fake-Handle, das `App.addListener` auflöst — hält den abgegriffenen Handler + einen `remove`-Spy bereit. */
function mockAddListenerOnce() {
  const removeMock = vi.fn();
  let capturedHandler: BackButtonHandler | null = null;
  let resolveHandle!: (handle: { remove: () => Promise<void> }) => void;
  const pending = new Promise<{ remove: () => Promise<void> }>((resolve) => {
    resolveHandle = resolve;
  });

  addListenerMock.mockImplementationOnce((_event: string, handler: BackButtonHandler) => {
    capturedHandler = handler;
    return pending;
  });

  return {
    removeMock,
    getHandler: () => capturedHandler,
    resolve: () => {
      resolveHandle({ remove: () => { removeMock(); return Promise.resolve(); } });
      return pending;
    },
  };
}

function createNav(overrides: Partial<CityNavigationViewModel> = {}): CityNavigationViewModel {
  return {
    level: 'city',
    focusDistrictId: null,
    activeDistrictId: null,
    activeSubcategoryId: null,
    selectedContractId: null,
    breadcrumb: [],
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useCityBackNavigation', () => {
  it('sollte im Web (kein natives Platform) keinen backButton-Listener registrieren', () => {
    isNativePlatformMock.mockReturnValue(false);
    const nav = createNav();

    renderHook(() => useCityBackNavigation(nav));

    expect(addListenerMock).not.toHaveBeenCalled();
  });

  it('sollte auf Distrikt-Ebene beim Hardware-Back eine Ebene hoch zoomen (zoomOutStep, kein history.back)', async () => {
    isNativePlatformMock.mockReturnValue(true);
    const historyBackSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const { getHandler, resolve } = mockAddListenerOnce();
    const nav = createNav({ level: 'district', activeDistrictId: 'leisure', focusDistrictId: 'leisure' });

    renderHook(() => useCityBackNavigation(nav));
    await act(async () => {
      await resolve();
    });

    act(() => {
      getHandler()?.({ canGoBack: true });
    });

    expect(nav.actions.zoomOutStep).toHaveBeenCalledTimes(1);
    expect(nav.actions.reset).not.toHaveBeenCalled();
    expect(historyBackSpy).not.toHaveBeenCalled();
  });

  it('sollte auf Unterkategorie-Ebene beim Hardware-Back eine Ebene hoch zoomen (zoomOutStep)', async () => {
    isNativePlatformMock.mockReturnValue(true);
    const { getHandler, resolve } = mockAddListenerOnce();
    const nav = createNav({
      level: 'subcategory',
      activeDistrictId: 'leisure',
      focusDistrictId: 'leisure',
      activeSubcategoryId: 'streaming',
    });

    renderHook(() => useCityBackNavigation(nav));
    await act(async () => {
      await resolve();
    });

    act(() => {
      getHandler()?.({ canGoBack: true });
    });

    expect(nav.actions.zoomOutStep).toHaveBeenCalledTimes(1);
  });

  it('sollte auf Stadt-Ebene mit Fokus (Ebene 1, nicht eingetaucht) beim Hardware-Back nur den Fokus lösen (reset, kein zoomOutStep, kein history.back)', async () => {
    isNativePlatformMock.mockReturnValue(true);
    const historyBackSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const { getHandler, resolve } = mockAddListenerOnce();
    const nav = createNav({ level: 'city', focusDistrictId: 'leisure' });

    renderHook(() => useCityBackNavigation(nav));
    await act(async () => {
      await resolve();
    });

    act(() => {
      getHandler()?.({ canGoBack: true });
    });

    expect(nav.actions.reset).toHaveBeenCalledTimes(1);
    expect(nav.actions.zoomOutStep).not.toHaveBeenCalled();
    expect(historyBackSpy).not.toHaveBeenCalled();
  });

  it('sollte auf oberster Ebene ohne Fokus die Standard-Navigation auslösen (window.history.back)', async () => {
    isNativePlatformMock.mockReturnValue(true);
    const historyBackSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {});
    const { getHandler, resolve } = mockAddListenerOnce();
    const nav = createNav({ level: 'city', focusDistrictId: null });

    renderHook(() => useCityBackNavigation(nav));
    await act(async () => {
      await resolve();
    });

    act(() => {
      getHandler()?.({ canGoBack: true });
    });

    expect(historyBackSpy).toHaveBeenCalledTimes(1);
    expect(nav.actions.zoomOutStep).not.toHaveBeenCalled();
    expect(nav.actions.reset).not.toHaveBeenCalled();
  });

  it('sollte den nativen Listener beim Unmount entfernen (remove)', async () => {
    isNativePlatformMock.mockReturnValue(true);
    const { removeMock, resolve } = mockAddListenerOnce();
    const nav = createNav();

    const { unmount } = renderHook(() => useCityBackNavigation(nav));
    await act(async () => {
      await resolve();
    });

    unmount();

    expect(removeMock).toHaveBeenCalledTimes(1);
  });

  it('[REGRESSION] sollte bei Unmount VOR aufgelöstem addListener-Promise den Listener nach Auflösung sofort entfernen (Race)', async () => {
    isNativePlatformMock.mockReturnValue(true);
    const { removeMock, resolve } = mockAddListenerOnce();
    const nav = createNav();

    const { unmount } = renderHook(() => useCityBackNavigation(nav));
    // Unmount VOR der Promise-Auflösung — die Race, die das Cleanup abdecken muss.
    unmount();
    expect(removeMock).not.toHaveBeenCalled();

    await act(async () => {
      await resolve();
    });

    await waitFor(() => expect(removeMock).toHaveBeenCalledTimes(1));
  });

  it('sollte nach einem Rerender den AKTUELLEN nav-Zustand nutzen, nicht den vom Registrierungszeitpunkt (Ref-Spiegelung)', async () => {
    isNativePlatformMock.mockReturnValue(true);
    const { getHandler, resolve } = mockAddListenerOnce();
    const initialNav = createNav({ level: 'city', focusDistrictId: null });

    const { rerender } = renderHook((props: CityNavigationViewModel) => useCityBackNavigation(props), {
      initialProps: initialNav,
    });
    await act(async () => {
      await resolve();
    });

    const updatedNav = createNav({ level: 'district', activeDistrictId: 'leisure', focusDistrictId: 'leisure' });
    rerender(updatedNav);

    act(() => {
      getHandler()?.({ canGoBack: true });
    });

    expect(updatedNav.actions.zoomOutStep).toHaveBeenCalledTimes(1);
    expect(initialNav.actions.zoomOutStep).not.toHaveBeenCalled();
    // addListener wurde nur EINMAL aufgerufen (kein Re-Register bei nav-Wechsel).
    expect(addListenerMock).toHaveBeenCalledTimes(1);
  });
});
