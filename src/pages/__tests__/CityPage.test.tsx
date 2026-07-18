import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { forwardRef, useEffect, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { renderWithProviders } from '@/test-utils/render';
import { merchantFingerprint } from '@/lib/merchant-fingerprint';
import type { Category, Transaction } from '@/types';
import type { ContractDecision } from '@/services/contract-decision-service';
import type { CityLabelsHandle, CityLabelsProps } from '@/features/finance-city/presentation/CityLabels';
import type { CityControlsApi } from '@/features/finance-city/presentation/CityCanvas';
import type { CitySceneHandle } from '@/features/finance-city/presentation/city-scene';
import CityPage from '../CityPage';

// jsdom kennt weder ResizeObserver noch requestAnimationFrame standardmäßig
// (Präzedenzfall: CityCanvas.test.tsx) — CityPage misst die Canvas-Fläche
// selbst über einen eigenen ResizeObserver (Label-`canvasSize`).
globalThis.ResizeObserver ||= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

if (typeof globalThis.requestAnimationFrame !== 'function') {
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = ((id: number) => clearTimeout(id)) as typeof cancelAnimationFrame;
}

// jsdom hat keinen echten WebGL-Kontext — `CityCanvas` würde ohnehin auf
// seinen eigenen "unavailable"-Fallback zurückfallen (siehe CityCanvas.tsx).
// Für den `onFrame`-Verdrahtungstest wird hier ein schlanker Stub verwendet,
// der `onFrame` über einen Button gezielt auslösbar macht (deterministisch,
// ohne echten WebGL-Kontext). Der Stub befüllt zusätzlich — wie das echte
// CityCanvas in seinem Mount-Effekt — `controlsApiRef`/`sceneRef`, damit der
// Kamera-Controller der Page in Tests tatsächlich erstellt wird (nötig für
// den StrictMode-/Remount-[REGRESSION]-Test unten).
let capturedOnFrame: ((camera: THREE.PerspectiveCamera) => void) | undefined;
let capturedControlsApiRef: MutableRefObject<CityControlsApi | null> | undefined;

/** Loop-API-Stub mit signaturtreuen Mocks — strukturell kompatibel zu `CityControlsApi`, Assertions über `.mock.calls`. */
function makeControlsApiStub() {
  return {
    setLimits: vi.fn<(minDistance: number, maxDistance: number) => void>(),
    invalidate: vi.fn<() => void>(),
  };
}
let stubControlsApi: ReturnType<typeof makeControlsApiStub> | undefined;

function makeSceneStub(): CitySceneHandle {
  return {
    applyLayout: vi.fn(),
    advanceAnimations: vi.fn(() => false),
    setAnimationsEnabled: vi.fn(),
    setTheme: vi.fn(),
    pick: vi.fn(() => null),
    setHighlight: vi.fn(),
    setSize: vi.fn(),
    setFog: vi.fn(),
    render: vi.fn(),
    dispose: vi.fn(),
    applyCameraPose: vi.fn(),
    target: new THREE.Vector3(),
    camera: new THREE.PerspectiveCamera(),
    domElement: document.createElement('canvas'),
  };
}

vi.mock('@/features/finance-city/presentation/CityCanvas', () => ({
  CityCanvas: (props: {
    onFrame?: (camera: THREE.PerspectiveCamera) => void;
    controlsApiRef?: MutableRefObject<CityControlsApi | null>;
    sceneRef?: MutableRefObject<CitySceneHandle | null>;
  }) => {
    capturedOnFrame = props.onFrame;
    capturedControlsApiRef = props.controlsApiRef;
    useEffect(() => {
      stubControlsApi = makeControlsApiStub();
      if (props.controlsApiRef) props.controlsApiRef.current = stubControlsApi;
      if (props.sceneRef) props.sceneRef.current = makeSceneStub();
      return () => {
        if (props.controlsApiRef) props.controlsApiRef.current = null;
        if (props.sceneRef) props.sceneRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return <div data-testid="city-canvas-stub" />;
  },
}));

// WP-D1: `declutter`-Prop abgreifen, die `CityPage` an `CityLabels` reicht
// (Stadt-Ebene = false, ab Distrikt-Ebene = true) — dafür die ECHTE
// `CityLabels`-Implementierung durchreichen (`vi.importActual`, Präzedenzfall
// `createCityScene`-Mock in `CityCanvas.test.tsx`), nur eine dünne
// `forwardRef`-Hülle davor, die die Prop abgreift. Damit bleibt der bereits
// bestehende onFrame-Test (echte `city-label`-Elemente nach `reproject()`)
// unverändert gültig — ein reiner Stub ohne echtes Rendering hätte diesen
// kaputt gemacht bzw. ihn selbst neu implementieren müssen.
let capturedDeclutter: boolean | undefined;
vi.mock('@/features/finance-city/presentation/CityLabels', async () => {
  const actual =
    await vi.importActual<typeof import('@/features/finance-city/presentation/CityLabels')>(
      '@/features/finance-city/presentation/CityLabels',
    );
  const CapturingCityLabels = forwardRef<CityLabelsHandle, CityLabelsProps>((props, ref) => {
    capturedDeclutter = props.declutter;
    return <actual.CityLabels {...props} ref={ref} />;
  });
  return { ...actual, CityLabels: CapturingCityLabels };
});

// WP-C8: CityPage lädt jetzt echte Daten über `useCityModel` (TanStack Query)
// statt der `cityDemoModel`-Fixture — die drei zugrunde liegenden Services
// werden gemockt, damit die Seite ein deterministisches Modell (1 Distrikt
// "Freizeit" mit Unterkategorie "Streaming" + aktiven Verträgen Netflix/HBO)
// baut. Das hält alle bestehenden Verhaltens-Assertions (Listen-Toggle,
// aria-current, Sheet-Prozent, onFrame-Verdrahtung, Stadt→…→Streaming) am
// Leben, nur über den echten Daten-Pfad statt der Fixture.
vi.mock('@/services/transaction-service', () => ({
  getTransactions: vi.fn(),
  getCategories: vi.fn(),
}));
vi.mock('@/services/contract-decision-service', () => ({
  getContractDecisionMap: vi.fn(),
}));

import { getTransactions, getCategories } from '@/services/transaction-service';
import { getContractDecisionMap } from '@/services/contract-decision-service';

/** Deterministischer Fake-Kamera-Stub (Präzedenzfall CityLabels.test.tsx): Identitätsmatrizen -> NDC === anchor; `position` für die Welt-Distanz des Label-Fadings (nah -> volle Opazität). */
function identityCamera(): THREE.PerspectiveCamera {
  return {
    position: new THREE.Vector3(0, 0, 5),
    matrixWorldInverse: new THREE.Matrix4(),
    projectionMatrix: new THREE.Matrix4(),
  } as unknown as THREE.PerspectiveCamera;
}

const CAT_LEISURE = 'cat-leisure';
const CAT_STREAMING = 'cat-streaming';

const FIXTURE_CATEGORIES: Category[] = [
  { id: CAT_LEISURE, name: 'Freizeit', filters: [] },
  { id: CAT_STREAMING, name: 'Streaming', filters: [], parent_id: CAT_LEISURE },
];

/** Tagesoffset relativ zu "jetzt" statt fixer Daten — bleibt unabhängig vom tatsächlichen Testlauf-Datum gültig (Stale-Erkennung in `computeContracts` vergleicht gegen `new Date()`). */
function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

const FIXTURE_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-netflix',
    date: daysAgoISO(5),
    amount: -17.99,
    payee: 'Netflix',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: true,
    category_id: CAT_STREAMING,
  },
  {
    id: 'tx-hbo',
    date: daysAgoISO(8),
    amount: -9.99,
    payee: 'HBO',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: true,
    category_id: CAT_STREAMING,
  },
];

/**
 * Ein `cycle_override: 'monthly'` je Fingerprint macht die Verträge auch bei
 * nur EINER Buchung je Händler "active" (Entscheidung schlägt die sonst
 * nötige Mindestanzahl/Zyklus-Erkennung, siehe `computeContracts`) — hält die
 * Fixture minimal, ohne die Vertragslogik selbst zu duplizieren.
 */
function buildContractDecisions(transactions: Transaction[]): Map<string, ContractDecision> {
  const decisions = new Map<string, ContractDecision>();
  for (const tx of transactions) {
    const fingerprint = merchantFingerprint(tx);
    decisions.set(fingerprint, {
      id: `decision-${tx.id}`,
      user_id: 'local',
      fingerprint,
      status: 'active',
      cycle_override: 'monthly',
    });
  }
  return decisions;
}

beforeEach(() => {
  vi.clearAllMocks();
  // WP-D3: Erst-Besuch-Hinweis persistiert seine Abweisung in localStorage —
  // zwischen Tests zurücksetzen, sonst hängt die Sichtbarkeit von der
  // Testreihenfolge ab.
  window.localStorage.clear();
  vi.mocked(getTransactions).mockResolvedValue(FIXTURE_TRANSACTIONS);
  vi.mocked(getCategories).mockResolvedValue(FIXTURE_CATEGORIES);
  vi.mocked(getContractDecisionMap).mockResolvedValue(buildContractDecisions(FIXTURE_TRANSACTIONS));

  // jsdom liefert für `getBoundingClientRect()` ohne echtes Layout immer
  // 0x0 — `CityPage` misst darüber aber die reale Canvas-Fläche
  // (`canvasSize` für die Label-Reprojektion). Fester Stub macht die Größe
  // in Tests deterministisch verfügbar, ohne ein echtes Layout zu brauchen.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 800,
    height: 600,
    top: 0,
    left: 0,
    right: 800,
    bottom: 600,
    x: 0,
    y: 0,
    toJSON() {
      return {};
    },
  } as DOMRect);
});

afterEach(() => {
  vi.restoreAllMocks();
  capturedOnFrame = undefined;
  capturedDeclutter = undefined;
});

describe.each(['de', 'en'] as const)('CityPage (%s)', (locale) => {
  it('sollte den Listen-Toggle aktivieren und zwischen Canvas- und Listenansicht umschalten (aria-pressed spiegelt den Zustand)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CityPage />, { query: true, locale });
    await screen.findByTestId('city-canvas-stub');

    const toggle = screen.getByRole('button', { name: /list|liste/i });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByTestId('city-accessible-list')).not.toBeInTheDocument();

    await user.click(toggle);

    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('city-accessible-list')).toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByTestId('city-accessible-list')).not.toBeInTheDocument();
  });

  it('sollte den aktuellen (letzten) Breadcrumb-Eintrag mit aria-current="page" markieren', async () => {
    renderWithProviders(<CityPage />, { query: true, locale });
    await screen.findByTestId('city-canvas-stub');

    const nav = screen.getByRole('navigation', { name: locale === 'de' ? 'Stadt-Navigation' : 'City navigation' });
    const current = nav.querySelector('[aria-current="page"]');
    expect(current).not.toBeNull();
    expect(current?.textContent).toMatch(locale === 'de' ? /Stadt/ : /City/);
  });

  it('sollte im Vertrags-Sheet den prozentualen Anteil des Vertrags an seiner Unterkategorie anzeigen', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CityPage />, { query: true, locale });
    await screen.findByTestId('city-canvas-stub');

    // Über die Listenansicht navigieren (teilt denselben nav-State wie der
    // Canvas) bis zu einem Vertrag mit `contracts` (Streaming in "Freizeit").
    // Scoped auf die Liste: der Breadcrumb im Header zeigt nach dem ersten
    // Fokus-Tap ebenfalls einen "Freizeit"-Eintrag (eigener Button) — ohne
    // Scoping wäre die Query mehrdeutig.
    await user.click(screen.getByRole('button', { name: /list|liste/i }));
    const list = () => within(screen.getByTestId('city-accessible-list'));
    await user.click(list().getByRole('button', { name: /Freizeit/ })); // 1. Tap: Fokus
    await user.click(list().getByRole('button', { name: /Freizeit/ })); // 2. Tap: Eintauchen
    await user.click(list().getByRole('button', { name: /Streaming/ }));
    await user.click(list().getByRole('button', { name: /Netflix/ }));

    // Sheet ist offen -> Prozentanteil sichtbar (Netflix-Anteil an Streaming-Summe).
    const percentText = locale === 'de' ? /von Streaming/ : /of Streaming/;
    expect(await screen.findByText(percentText)).toBeInTheDocument();
  });

  it('sollte onFrame von CityCanvas an die Label-Reprojektion weiterreichen (kein eigener Timer)', async () => {
    renderWithProviders(<CityPage />, { query: true, locale });
    await screen.findByTestId('city-canvas-stub');

    expect(capturedOnFrame).toBeInstanceOf(Function);
    // Direkter Aufruf simuliert exakt das, was `CityCanvas`s Render-on-Demand-
    // Loop pro tatsächlich gerendertem Frame tut (siehe CityCanvas.tsx `tick()`).
    capturedOnFrame?.(identityCamera());

    // Mindestens ein Distrikt-Label sollte nach der Reprojektion sichtbar sein.
    const labels = await screen.findAllByTestId('city-label');
    expect(labels.length).toBeGreaterThan(0);
  });

  it('sollte declutter=false auf Stadt-Ebene und declutter=true nach Eintauchen in einen Distrikt an CityLabels reichen (WP-D1)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CityPage />, { query: true, locale });
    await screen.findByTestId('city-canvas-stub');

    // Stadt-Ebene (Ausgangszustand): wenige Distrikte -> kein Culling.
    expect(capturedDeclutter).toBe(false);

    // Über die Listenansicht (teilt denselben nav-State wie der Canvas) in
    // "Freizeit" eintauchen: 1. Tap = Fokus, 2. Tap = Eintauchen (district-Ebene).
    await user.click(screen.getByRole('button', { name: /list|liste/i }));
    const list = () => within(screen.getByTestId('city-accessible-list'));
    await user.click(list().getByRole('button', { name: /Freizeit/ }));
    await user.click(list().getByRole('button', { name: /Freizeit/ }));

    expect(capturedDeclutter).toBe(true);
  });

  it('sollte auf Stadt-Ebene den Kontext-Chip mit der Gesamtausgabe zeigen (WP-D3)', async () => {
    renderWithProviders(<CityPage />, { query: true, locale });
    await screen.findByTestId('city-canvas-stub');

    const chip = await screen.findByTestId('city-context-chip');
    const totalLabel = locale === 'de' ? /Gesamtausgaben/ : /Total spending/;
    expect(chip.textContent).toMatch(totalLabel);
    expect(chip.textContent).toMatch(/€/);
  });

  it('sollte nach dem Eintauchen in einen Distrikt den Kontext-Chip mit Name, Gebäudezahl und Anteil zeigen (WP-D3)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CityPage />, { query: true, locale });
    await screen.findByTestId('city-canvas-stub');

    await user.click(screen.getByRole('button', { name: /list|liste/i }));
    const list = () => within(screen.getByTestId('city-accessible-list'));
    await user.click(list().getByRole('button', { name: /Freizeit/ })); // Fokus
    await user.click(list().getByRole('button', { name: /Freizeit/ })); // Eintauchen

    const chip = await screen.findByTestId('city-context-chip');
    expect(chip.textContent).toMatch(/Freizeit/);
    const buildingText = locale === 'de' ? /Gebäude/ : /buildings/;
    expect(chip.textContent).toMatch(buildingText);
    expect(chip.textContent).toMatch(/%/);
  });

  it('sollte den Erst-Besuch-Hinweis auf Stadt-Ebene zeigen und nach dem ersten Drill-down dauerhaft ausblenden (WP-D3)', async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithProviders(<CityPage />, { query: true, locale });
    await screen.findByTestId('city-canvas-stub');

    expect(await screen.findByTestId('city-tap-hint')).toBeInTheDocument();

    // Drill-down über die Listenansicht (teilt denselben nav-State).
    await user.click(screen.getByRole('button', { name: /list|liste/i }));
    const list = () => within(screen.getByTestId('city-accessible-list'));
    await user.click(list().getByRole('button', { name: /Freizeit/ }));
    await user.click(list().getByRole('button', { name: /Freizeit/ }));

    expect(screen.queryByTestId('city-tap-hint')).not.toBeInTheDocument();

    // Dauerhaft: ein NEUER Mount (z. B. nächster Besuch) zeigt den Hinweis
    // nicht mehr — die Abweisung ist persistiert.
    unmount();
    renderWithProviders(<CityPage />, { query: true, locale });
    await screen.findByTestId('city-canvas-stub');
    expect(screen.queryByTestId('city-tap-hint')).not.toBeInTheDocument();
  });

  it('[REGRESSION] sollte bei leeren Transaktionen den Empty-State statt eines Demo-Fallbacks zeigen (kein Canvas gemountet)', async () => {
    vi.mocked(getTransactions).mockResolvedValue([]);
    renderWithProviders(<CityPage />, { query: true, locale });

    const emptyText = locale === 'de' ? /Noch keine Ausgabendaten/ : /No spending data yet/;
    expect(await screen.findByText(emptyText)).toBeInTheDocument();
    expect(screen.queryByTestId('city-canvas-stub')).not.toBeInTheDocument();
  });

  it('[REGRESSION] sollte Kamera-Controller-Callbacks LIVE über die Refs auflösen — invalidate() erreicht nach einem Canvas-Remount die NEUE Loop-Instanz', async () => {
    // Nachgestellter Dev-Befund (StrictMode-Doppelmount): CityCanvas remountet
    // und setzt `controlsApiRef` auf eine NEUE Loop-Instanz; die alte Closure
    // ist tot (ihr rafHandle bleibt auf einem gecancelten Callback stehen,
    // invalidate() dort ist für immer ein No-op). Captured der Controller die
    // API einmalig statt live über die Refs, weckt KEIN Kamera-Intent mehr den
    // Render-Loop — Flüge starten nie, die Szene friert auf dem alten Bild ein.
    const user = userEvent.setup();
    renderWithProviders(<CityPage />, { query: true, locale });
    await screen.findByTestId('city-canvas-stub');
    expect(capturedControlsApiRef?.current).not.toBeNull();

    // Simulierter Remount: Refs zeigen jetzt auf die neue (lebende) Instanz B.
    const apiB = makeControlsApiStub();
    const apiA = stubControlsApi!;
    capturedControlsApiRef!.current = apiB;
    const apiACallsBefore = apiA.invalidate.mock.calls.length;

    // Kamera-Intent über die Listenansicht auslösen (Fokus-Flug auf "Freizeit").
    await user.click(screen.getByRole('button', { name: /list|liste/i }));
    const list = within(screen.getByTestId('city-accessible-list'));
    await user.click(list.getByRole('button', { name: /Freizeit/ }));

    // Der Flug muss den LEBENDEN Loop wecken — nicht die tote Erst-Instanz.
    expect(apiB.invalidate).toHaveBeenCalled();
    expect(apiA.invalidate.mock.calls.length).toBe(apiACallsBefore);
  });
});
