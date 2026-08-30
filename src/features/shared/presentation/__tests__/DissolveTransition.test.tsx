import { useRef } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DissolveTransition from '../DissolveTransition';

const reduceMock = vi.fn(() => false);
vi.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => reduceMock(),
  useMotionSafe: (props: unknown) => props,
}));

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
    // jsdom kennt weder rAF-Timing noch Canvas-Kontext — beide werden ersetzt,
    // damit der Ablauf (nicht das Bild) prüfbar ist.
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

  it('sollte das aufgelöste Element ausblenden und unbedienbar machen', () => {
    render(<Probe active onComplete={vi.fn()} />);
    const kachel = screen.getByTestId('kachel');
    expect(kachel.style.opacity).toBe('0');
    expect(kachel.style.pointerEvents).toBe('none');
  });

  it('sollte nach Ablauf abschließen', async () => {
    const fertig = vi.fn();
    render(<Probe active onComplete={fertig} />);
    await waitFor(() => expect(fertig).toHaveBeenCalled());
  });

  it('sollte bei reduzierter Bewegung kein Canvas erzeugen und trotzdem abschließen', async () => {
    reduceMock.mockReturnValue(true);
    const fertig = vi.fn();
    render(<Probe active onComplete={fertig} />);
    expect(screen.queryByTestId('dissolve-canvas')).toBeNull();
    await waitFor(() => expect(fertig).toHaveBeenCalled());
  });
});
