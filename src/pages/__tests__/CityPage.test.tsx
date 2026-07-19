import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
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
let capturedOnTapBox: ((id: string | null) => void) | undefined;
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
    onTapBox?: (id: string | null) => void;
    controlsApiRef?: MutableRefObject<CityControlsApi | null>;
    sceneRef?: MutableRefObject<CitySceneHandle | null>;
  }) => {
    capturedOnFrame = props.onFrame;
    capturedOnTapBox = props.onTapBox;
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
// WP-D7: Ziele-Tab wertet Meilensteine aus — der echte Service zieht
// Financial-Health/Schulden nach und persistiert; hier deterministisch gemockt.
vi.mock('@/services/milestones-service', () => ({
  evaluateMilestones: vi.fn(),
}));

// WP-D9: Breakpoint kontrollierbar mocken (jsdom-matchMedia wäre immer
// "schmal") — Default Desktop, einzelne Tests schalten auf Mobile um.
const { useIsWideDesktopMock } = vi.hoisted(() => ({ useIsWideDesktopMock: vi.fn(() => true) }));
vi.mock('@/hooks/useIsWideDesktop', () => ({ useIsWideDesktop: useIsWideDesktopMock }));

import { getTransactions, getCategories } from '@/services/transaction-service';
import { evaluateMilestones, type MilestoneStatus } from '@/services/milestones-service';

/** WP-D7: zwei Ziele — eines zu 65 % in Arbeit, eines erreicht (Trophäe). */
const FIXTURE_MILESTONES: MilestoneStatus[] = [
  {
    definition: { key: 'notgroschen', title: 'Notgroschen 1 Monat', description: '', icon: '🌱', isAchieved: () => false },
    achieved: false,
    justAchieved: false,
    progress: { amount: 650, target: 1000, unit: 'euro' },
  },
  {
    definition: { key: 'vermoegen', title: 'Erstes Vermögen', description: '', icon: '💎', isAchieved: () => true },
    achieved: true,
    justAchieved: false,
    progress: { amount: 12000, target: 10000, unit: 'euro' },
  },
];
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
const CAT_EMPLOYMENT = 'cat-anstellung';

const FIXTURE_CATEGORIES: Category[] = [
  { id: CAT_LEISURE, name: 'Freizeit', filters: [] },
  { id: CAT_STREAMING, name: 'Streaming', filters: [], parent_id: CAT_LEISURE },
  // WP-D5 (Einnahmen-Tab): Einkommens-Hauptkategorie für die Gehalts-Fixture.
  { id: CAT_EMPLOYMENT, name: 'Anstellung', filters: [], attributes: { ausgabenklasse: 'einkommen' } },
];

/** Tagesoffset relativ zu "jetzt" statt fixer Daten — bleibt unabhängig vom tatsächlichen Testlauf-Datum gültig (Stale-Erkennung in `computeContracts` vergleicht gegen `new Date()`). */
function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

/** N Kalendermonate zurück, fixiert auf den 15. — garantiert verschiedene Monate, unabhängig vom Testlauf-Datum (WP-D5, Einnahmen-Fixture). */
function monthsAgoISO(months: number): string {
  const d = new Date();
  d.setDate(15);
  d.setMonth(d.getMonth() - months);
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
    // WP-D4: ältere, GÜNSTIGERE Netflix-Buchung — macht die Sheet-Buchungsliste
    // mehrzeilig und den Preis-Trend-Hinweis (+2,00 €) deterministisch testbar.
    id: 'tx-netflix-old',
    date: daysAgoISO(35),
    amount: -15.99,
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
  // WP-D5 (Einnahmen-Tab): DREI monatliche Gehaltseingänge -> ein
  // REGELMÄSSIGER Einnahmen-Strom "Muster GmbH" im Distrikt "Anstellung"
  // (deriveIncomeStreams braucht >= 3 aktive Monate für die Kadenz und damit
  // die nächste-Zahlung-Projektion). `monthsAgoISO` garantiert drei
  // verschiedene Kalendermonate (Tages-Offsets könnten am Monatsanfang
  // kollidieren). Positive Beträge sind für das Ausgaben-Modell
  // (Sunburst/Etagen) unsichtbar — bestehende Tests unberührt.
  // Monate 1..3 (nicht 0): der 15. des LAUFENDEN Monats läge in der ersten
  // Monatshälfte in der Zukunft und fiele aus dem Stream-Fenster.
  ...[1, 2, 3].map((monthsAgo) => ({
    id: `tx-gehalt-${monthsAgo}`,
    date: monthsAgoISO(monthsAgo),
    amount: 3000,
    payee: 'Muster GmbH',
    description: '',
    original_text: '',
    auto_mapped: false,
    confirmed: true,
    category_id: CAT_EMPLOYMENT,
  })),
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
  vi.mocked(evaluateMilestones).mockResolvedValue(FIXTURE_MILESTONES);
  useIsWideDesktopMock.mockReturnValue(true);

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
  capturedOnTapBox = undefined;
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

  it('sollte im Vertrags-Sheet die letzten Buchungen als Deep-Links, den "Alle Buchungen"-CTA und den Preis-Trend zeigen (WP-D4)', async () => {
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

    // Buchungsliste: beide Netflix-Buchungen, neueste zuerst, jede Zeile als
    // Deep-Link auf GENAU diese Buchung (`tx=`), gefiltert auf Kategorie+Händler.
    const bookingLinks = await screen.findAllByTestId('city-sheet-booking');
    expect(bookingLinks).toHaveLength(2);
    const firstHref = bookingLinks[0].getAttribute('href') ?? '';
    expect(firstHref).toContain('/transactions?');
    expect(firstHref).toContain('cat=cat-streaming');
    expect(firstHref).toContain('q=Netflix');
    expect(firstHref).toContain('tx=tx-netflix');
    expect(bookingLinks[1].getAttribute('href')).toContain('tx=tx-netflix-old');

    // CTA auf die gefilterte Buchungsseite (gleiches Muster wie Sunburst/Sankey).
    const cta = screen.getByTestId('city-sheet-all-bookings');
    const ctaHref = cta.getAttribute('href') ?? '';
    expect(ctaHref).toContain('/transactions?');
    expect(ctaHref).toContain('cat=cat-streaming');
    expect(ctaHref).not.toContain('tx=');
    expect(cta.textContent).toContain('(2)');

    // Preis-Trend: 17,99 € (neueste) > 15,99 € (vorletzte) -> +2,00 €.
    expect(screen.getByTestId('city-sheet-price-increase').textContent).toContain('2,00');
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

  it('sollte auf DESKTOP declutter=false auf Stadt-Ebene und declutter=true nach Eintauchen in einen Distrikt an CityLabels reichen (WP-D1)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CityPage />, { query: true, locale });
    await screen.findByTestId('city-canvas-stub');

    // Stadt-Ebene (Ausgangszustand, breiter Screen): wenige Distrikte -> kein Culling.
    expect(capturedDeclutter).toBe(false);

    // Über die Listenansicht (teilt denselben nav-State wie der Canvas) in
    // "Freizeit" eintauchen: 1. Tap = Fokus, 2. Tap = Eintauchen (district-Ebene).
    await user.click(screen.getByRole('button', { name: /list|liste/i }));
    const list = () => within(screen.getByTestId('city-accessible-list'));
    await user.click(list().getByRole('button', { name: /Freizeit/ }));
    await user.click(list().getByRole('button', { name: /Freizeit/ }));

    expect(capturedDeclutter).toBe(true);
  });

  it('[REGRESSION] sollte auf SCHMALEN Screens das Label-Culling auch auf Stadt-Ebene aktivieren (WP-D9, Mobile: Labels stapelten sich unlesbar)', async () => {
    useIsWideDesktopMock.mockReturnValue(false);
    renderWithProviders(<CityPage />, { query: true, locale });
    await screen.findByTestId('city-canvas-stub');

    expect(capturedDeclutter).toBe(true);
  });

  it('sollte die Steuerleiste rendern: Zurück (auf Stadt-Ebene deaktiviert) und Reset führen durch die Ebenen (WP-D9)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CityPage />, { query: true, locale });
    await screen.findByTestId('city-canvas-stub');

    // Stadt-Ebene: Zurück deaktiviert, Reset immer verfügbar.
    expect(screen.getByTestId('city-control-back')).toBeDisabled();
    expect(screen.getByTestId('city-control-reset')).toBeEnabled();
    // jsdom hat kein Element-Vollbild (fullscreenEnabled falsy) -> Button erscheint gar nicht erst.
    expect(screen.queryByTestId('city-control-fullscreen')).not.toBeInTheDocument();

    // Eintauchen über die Listenansicht -> Zurück wird aktiv.
    await user.click(screen.getByRole('button', { name: /list|liste/i }));
    const list = () => within(screen.getByTestId('city-accessible-list'));
    await user.click(list().getByRole('button', { name: /Freizeit/ }));
    await user.click(list().getByRole('button', { name: /Freizeit/ }));
    expect(screen.getByTestId('city-control-back')).toBeEnabled();

    // Zurück: eine Ebene raus (Distrikt -> Stadt) -> wieder deaktiviert.
    await user.click(screen.getByTestId('city-control-back'));
    expect(screen.getByTestId('city-control-back')).toBeDisabled();

    // Erneut eintauchen, dann Reset: direkt zurück auf die Stadt-Ebene.
    await user.click(list().getByRole('button', { name: /Freizeit/ }));
    await user.click(list().getByRole('button', { name: /Freizeit/ }));
    expect(screen.getByTestId('city-control-back')).toBeEnabled();
    await user.click(screen.getByTestId('city-control-reset'));
    expect(screen.getByTestId('city-control-back')).toBeDisabled();
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

  it('sollte auf den Einnahmen-Tab wechseln: Einnahmen-Welt mit eigenem Chip, Navigation resettet auf Stadt-Ebene (WP-D5)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CityPage />, { query: true, locale });
    await screen.findByTestId('city-canvas-stub');

    // Erst in der Ausgaben-Welt eintauchen (Distrikt-Ebene) …
    await user.click(screen.getByRole('button', { name: /list|liste/i }));
    const list = () => within(screen.getByTestId('city-accessible-list'));
    await user.click(list().getByRole('button', { name: /Freizeit/ }));
    await user.click(list().getByRole('button', { name: /Freizeit/ }));

    // … dann in die Einnahmen-Welt wechseln.
    const incomeTabName = locale === 'de' ? 'Einnahmen' : 'Income';
    await user.click(screen.getByRole('tab', { name: incomeTabName }));

    // Kontext-Chip zeigt die Gesamteinnahmen -> Navigation ist zurück auf
    // Stadt-Ebene (Weltwechsel resettet den Drill-down der Ausgaben-Welt).
    const chip = await screen.findByTestId('city-context-chip');
    const totalIncomeLabel = locale === 'de' ? /Gesamteinnahmen/ : /Total income/;
    expect(chip.textContent).toMatch(totalIncomeLabel);

    // Einnahmen-Distrikt (Einkommens-Hauptkategorie) in der Listenansicht.
    expect(list().getByRole('button', { name: /Anstellung/ })).toBeInTheDocument();
    // Die Ausgaben-Distrikte gehören NICHT zur Einnahmen-Welt.
    expect(list().queryByRole('button', { name: /Freizeit/ })).not.toBeInTheDocument();
  });

  it('sollte im Einnahmen-Sheet die nächste erwartete Zahlung zeigen und den Deep-Link über die Zahler-Suche bauen (WP-D5)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CityPage />, { query: true, locale });
    await screen.findByTestId('city-canvas-stub');

    const incomeTabName = locale === 'de' ? 'Einnahmen' : 'Income';
    await user.click(screen.getByRole('tab', { name: incomeTabName }));

    // Über die Listenansicht bis zur Monats-Etage des Gehalts-Stroms.
    await user.click(screen.getByRole('button', { name: /list|liste/i }));
    const list = () => within(screen.getByTestId('city-accessible-list'));
    await user.click(list().getByRole('button', { name: /Anstellung/ })); // Fokus
    await user.click(list().getByRole('button', { name: /Anstellung/ })); // Eintauchen
    await user.click(list().getByRole('button', { name: /Muster GmbH/ }));
    // Monats-Etagen (MM/yyyy) — die neueste anklicken.
    const floorButtons = list().getAllByRole('button', { name: /\d{2}\/\d{4}/ });
    await user.click(floorButtons[0]);

    // Nächste erwartete Zahlung (regelmäßiger Strom, 2 Monatszahlungen).
    expect(await screen.findByTestId('city-sheet-next-payment')).toBeInTheDocument();

    // Deep-Links: Zahler-Suche + ECHTE Einnahmen-Kategorie.
    const cta = screen.getByTestId('city-sheet-all-bookings');
    const ctaHref = cta.getAttribute('href') ?? '';
    expect(ctaHref).toContain('/transactions?');
    expect(ctaHref).toContain('q=Muster');
    expect(ctaHref).toContain('cat=cat-anstellung');

    // Buchungszeile der neuesten Monats-Etage verlinkt auf die exakte Buchung.
    const bookingLinks = screen.getAllByTestId('city-sheet-booking');
    expect(bookingLinks[0].getAttribute('href')).toContain('tx=tx-gehalt-1');
  });

  it('sollte auf den Ziele-Tab wechseln: Trophäen-Chip, Fortschritts-Prozente statt Euros (WP-D7)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CityPage />, { query: true, locale });
    await screen.findByTestId('city-canvas-stub');

    const goalsTabName = locale === 'de' ? 'Ziele' : 'Goals';
    await user.click(screen.getByRole('tab', { name: goalsTabName }));

    // Chip zählt Trophäen statt Beträge zu summieren.
    const chip = await screen.findByTestId('city-context-chip');
    const summary = locale === 'de' ? /1 von 2 Zielen erreicht/ : /1 of 2 goals achieved/;
    await waitFor(() => expect(chip.textContent).toMatch(summary));

    // Listenansicht: Bauprojekte mit Fortschritts-Prozent, KEINE Euro-Beträge.
    await user.click(screen.getByRole('button', { name: /list|liste/i }));
    const list = () => within(screen.getByTestId('city-accessible-list'));
    expect(list().getByRole('button', { name: /Notgroschen 1 Monat/ })).toBeInTheDocument();
    expect(list().getByText(/65\s?%/)).toBeInTheDocument();
    expect(list().queryByText(/€/)).not.toBeInTheDocument();
  });

  it('sollte im Übersicht-Tab beide Seiten + Spar-Turm bilanzieren (Chip: Einnahmen · Ausgaben · Sparrate) (WP-D8)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CityPage />, { query: true, locale });
    await screen.findByTestId('city-canvas-stub');

    const overviewTabName = locale === 'de' ? 'Übersicht' : 'Overview';
    await user.click(screen.getByRole('tab', { name: overviewTabName }));

    // Fixture: Einnahmen 3×3.000 = 9.000, Ausgaben 17,99+15,99+9,99 = 43,97
    // -> Überschuss (Sparrate) 8.956,03.
    const chip = await screen.findByTestId('city-context-chip');
    const surplusLabel = locale === 'de' ? /Sparrate/ : /Savings rate/;
    await waitFor(() => expect(chip.textContent).toMatch(surplusLabel));
    expect(chip.textContent).toContain('9.000,00');
    expect(chip.textContent).toContain('43,97');
    expect(chip.textContent).toContain('8.956,03');
  });

  it('sollte aus der Übersicht per Doppel-Tap in die Welt des Viertels springen und dort den Distrikt betreten (WP-D8)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CityPage />, { query: true, locale });
    await screen.findByTestId('city-canvas-stub');

    const overviewTabName = locale === 'de' ? 'Übersicht' : 'Overview';
    await user.click(screen.getByRole('tab', { name: overviewTabName }));
    await screen.findByTestId('city-context-chip');

    // Spar-Turm ist reines Readout: Tap ist ein No-op (Übersicht bleibt aktiv).
    act(() => capturedOnTapBox?.('overview:balance'));
    expect(screen.getByRole('tab', { name: overviewTabName })).toHaveAttribute('aria-selected', 'true');

    // Einnahmen-Viertel: 1. Tap = Fokus (Übersicht bleibt), 2. Tap = Welt-Sprung.
    act(() => capturedOnTapBox?.('income:cat-anstellung'));
    expect(screen.getByRole('tab', { name: overviewTabName })).toHaveAttribute('aria-selected', 'true');
    act(() => capturedOnTapBox?.('income:cat-anstellung'));

    const incomeTabName = locale === 'de' ? 'Einnahmen' : 'Income';
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: incomeTabName })).toHaveAttribute('aria-selected', 'true'),
    );
    // Direkt im Distrikt der Ziel-Welt gelandet (Chip zeigt den Distrikt, nicht die Stadt-Summe).
    const chip = await screen.findByTestId('city-context-chip');
    await waitFor(() => expect(chip.textContent).toMatch(/Anstellung/));
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
