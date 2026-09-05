import { useRef } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DissolveTransition from '../DissolveTransition';
import type { DissolvePoint } from '@/lib/dissolve-particles';

const reduceMock = vi.fn(() => false);
vi.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => reduceMock(),
  useMotionSafe: (props: unknown) => props,
}));

// Die Abtastung braucht ein echtes Canvas; jsdom hat keines. Geprüft wird
// hier der ABLAUF (was wann verschwindet, wann abgeschlossen wird), nicht das
// Bild — die Rechnung dahinter prüft `dissolve-particles.test.ts`.
const samplePoints = vi.fn<(el: HTMLElement) => DissolvePoint[]>(() => []);
vi.mock('../dissolve-raster', async () => {
  const echt = await vi.importActual<typeof import('../dissolve-raster')>('../dissolve-raster');
  return { ...echt, samplePoints: (el: HTMLElement) => samplePoints(el) };
});

function punkt(x: number): DissolvePoint {
  return { x, y: 10, color: 'rgba(255,0,0,1)', vonRechts: 0.5 };
}

function Probe({ active, onComplete }: { active: boolean; onComplete: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <>
      <div ref={ref} data-testid="kachel">
        Auswahl
      </div>
      <DissolveTransition active={active} targets={[ref]} onComplete={onComplete} />
    </>
  );
}

describe('DissolveTransition', () => {
  beforeEach(() => {
    reduceMock.mockReturnValue(false);
    // `restoreAllMocks` nimmt nur Spione zurueck; die Aufrufliste dieser
    // Modul-Attrappe muss eigens geleert werden, sonst zaehlt der naechste
    // Test die Aufrufe des vorigen mit.
    samplePoints.mockReset();
    samplePoints.mockReturnValue([punkt(1), punkt(2), punkt(3)]);
    // jsdom kennt weder rAF-Timing noch Canvas-Kontext — beide werden
    // ersetzt, damit der Ablauf prüfbar ist.
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(performance.now() + 10_000);
      return 1;
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sollte ohne laufende Auflösung kein Canvas erzeugen', () => {
    render(<Probe active={false} onComplete={vi.fn()} />);
    expect(screen.queryByTestId('dissolve-canvas')).toBeNull();
  });

  it('sollte während der Auflösung ein Canvas über die Fläche legen', () => {
    render(<Probe active onComplete={vi.fn()} />);
    expect(screen.getByTestId('dissolve-canvas')).toBeInTheDocument();
  });

  it('sollte die Fläche abtasten, BEVOR sie verschwindet', () => {
    // Umgekehrte Reihenfolge hätte nichts mehr zu lesen — der Zerfall wäre
    // leer und die Fläche einfach weg.
    samplePoints.mockImplementation((el) => {
      expect(el.style.visibility).not.toBe('hidden');
      return [punkt(1)];
    });
    render(<Probe active onComplete={vi.fn()} />);
    expect(samplePoints).toHaveBeenCalled();
  });

  it('sollte das Element sofort verstecken, sobald die Partikel sein Bild tragen', () => {
    // Kein Ausblenden: Die Partikel SIND das Bild. Ein gleichzeitig
    // verblassendes Element wäre ein zweites, halb durchsichtiges Abbild.
    render(<Probe active onComplete={vi.fn()} />);
    const kachel = screen.getByTestId('kachel');
    expect(kachel.style.visibility).toBe('hidden');
    expect(kachel.style.pointerEvents).toBe('none');
  });

  it('sollte ohne abgetastete Bildpunkte auf ein Ausblenden zurückfallen', () => {
    // Kein Canvas-Kontext, keine Punkte: Dann darf die Fläche nicht
    // schlagartig verschwinden, denn es käme nichts an ihre Stelle.
    samplePoints.mockReturnValue([]);
    render(<Probe active onComplete={vi.fn()} />);
    const kachel = screen.getByTestId('kachel');
    expect(kachel.style.visibility).not.toBe('hidden');
    expect(kachel.style.opacity).toBe('0');
  });

  it('sollte nach Ablauf abschließen', async () => {
    const fertig = vi.fn();
    render(<Probe active onComplete={fertig} />);
    await waitFor(() => expect(fertig).toHaveBeenCalled());
  });

  it('sollte bei reduzierter Bewegung kein Canvas erzeugen, nicht abtasten und trotzdem abschließen', async () => {
    reduceMock.mockReturnValue(true);
    const fertig = vi.fn();
    render(<Probe active onComplete={fertig} />);
    expect(screen.queryByTestId('dissolve-canvas')).toBeNull();
    expect(samplePoints).not.toHaveBeenCalled();
    await waitFor(() => expect(fertig).toHaveBeenCalled());
  });
});
