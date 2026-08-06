import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMotionQuality } from '../useMotionQuality';
import { resetDeviceProfileCache } from '../useDeviceProfile';
import { MOTION_DURATIONS } from '@/lib/motion-tokens';

/**
 * Reduced-Motion wird über den Hook gemockt, nicht über `matchMedia`:
 * Framer Motion liest die Media Query beim Modul-Import einmal aus, ein
 * späterer `matchMedia`-Mock erreicht sie nicht mehr. Das ist der Repo-Standard
 * (siehe `components/common/__tests__/SignatureMoment.test.tsx`).
 */
const reduceMock = vi.fn(() => false);
vi.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => reduceMock(),
}));

/**
 * WP-7.7 — der React-Zugang zur Bewegungsstufe.
 *
 * Geprüft wird hier nur, was der Hook zusätzlich zur reinen Ableitung tut:
 * Gerätesignale auslesen, `prefers-reduced-motion` verbinden und Dauern
 * auflösen. Die Ableitungslogik selbst hat ihre eigenen Tests in
 * `src/lib/__tests__/motion-quality.test.ts`.
 */

type NavigatorOverrides = {
  hardwareConcurrency?: number;
  deviceMemory?: number;
  saveData?: boolean;
};

const originalDescriptors = {
  hardwareConcurrency: Object.getOwnPropertyDescriptor(
    window.navigator,
    'hardwareConcurrency'
  ),
  devicePixelRatio: Object.getOwnPropertyDescriptor(window, 'devicePixelRatio'),
  matchMedia: window.matchMedia,
};

function mockDevice({
  hardwareConcurrency = 12,
  deviceMemory = 16,
  coarsePointer = false,
  reducedMotion = false,
  devicePixelRatio = 1,
  innerWidth = 1440,
}: NavigatorOverrides & {
  coarsePointer?: boolean;
  reducedMotion?: boolean;
  devicePixelRatio?: number;
  innerWidth?: number;
} = {}) {
  Object.defineProperty(window.navigator, 'hardwareConcurrency', {
    value: hardwareConcurrency,
    configurable: true,
  });
  Object.defineProperty(window.navigator, 'deviceMemory', {
    value: deviceMemory,
    configurable: true,
  });
  Object.defineProperty(window, 'devicePixelRatio', {
    value: devicePixelRatio,
    configurable: true,
  });
  Object.defineProperty(window, 'innerWidth', { value: innerWidth, configurable: true });

  reduceMock.mockReturnValue(reducedMotion);

  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('pointer: coarse') ? coarsePointer : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;

  resetDeviceProfileCache();
}

beforeEach(() => {
  resetDeviceProfileCache();
});

afterEach(() => {
  if (originalDescriptors.hardwareConcurrency) {
    Object.defineProperty(
      window.navigator,
      'hardwareConcurrency',
      originalDescriptors.hardwareConcurrency
    );
  }
  if (originalDescriptors.devicePixelRatio) {
    Object.defineProperty(window, 'devicePixelRatio', originalDescriptors.devicePixelRatio);
  }
  window.matchMedia = originalDescriptors.matchMedia;
  reduceMock.mockReturnValue(false);
  resetDeviceProfileCache();
});

describe('useMotionQuality', () => {
  it('sollte auf einem kräftigen Desktop die volle Stufe liefern', () => {
    mockDevice();
    const { result } = renderHook(() => useMotionQuality());
    expect(result.current.tier).toBe('full');
    expect(result.current.duration(MOTION_DURATIONS.default)).toBe(MOTION_DURATIONS.default);
  });

  it('sollte ein schwaches Gerät auf die sparsamste Stufe setzen', () => {
    mockDevice({ hardwareConcurrency: 2, deviceMemory: 2, coarsePointer: true, innerWidth: 360 });
    const { result } = renderHook(() => useMotionQuality());
    expect(result.current.tier).toBe('minimal');
  });

  it('sollte prefers-reduced-motion über die Geräteeinstufung stellen', () => {
    mockDevice({ reducedMotion: true });
    const { result } = renderHook(() => useMotionQuality());
    expect(result.current.tier).toBe('minimal');
    expect(result.current.duration(MOTION_DURATIONS.signature)).toBe(0);
    expect(result.current.seconds(MOTION_DURATIONS.signature)).toBe(0);
  });

  it('sollte Sekunden als die von Framer Motion erwartete Einheit liefern', () => {
    mockDevice();
    const { result } = renderHook(() => useMotionQuality());
    expect(result.current.seconds(MOTION_DURATIONS.default)).toBeCloseTo(
      MOTION_DURATIONS.default / 1000
    );
  });

  it('sollte über Renders hinweg dieselbe Instanz liefern', () => {
    // Sonst entwertet jeder Render jedes `useMemo`, das die Stufe als
    // Abhängigkeit führt — genau der Grund, warum das Profil gemerkt wird.
    mockDevice();
    const { result, rerender } = renderHook(() => useMotionQuality());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });

  it('sollte fehlende navigator-Angaben nicht als schwaches Gerät werten', () => {
    // Safari und Firefox liefern `deviceMemory` gar nicht.
    mockDevice({ deviceMemory: undefined });
    const { result } = renderHook(() => useMotionQuality());
    expect(result.current.tier).toBe('full');
  });
});
