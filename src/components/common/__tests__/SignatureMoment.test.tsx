import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { SignatureMoment } from '../SignatureMoment';

const reduceMock = vi.fn(() => false);
vi.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => reduceMock(),
}));

afterEach(() => reduceMock.mockReturnValue(false));

describe('SignatureMoment (WP-6.5)', () => {
  it('sollte einen vollständigen Feier-Moment mit data-testid rendern', () => {
    const { container } = render(
      <SignatureMoment title="Notgroschen erreicht" icon="🛡️" />,
    );
    const el = container.querySelector('[data-testid="signature-moment"]');
    expect(el).toBeInTheDocument();
  });

  it('sollte den Titel anzeigen', () => {
    const { container } = render(
      <SignatureMoment title="Notgroschen erreicht" icon="🛡️" />,
    );
    expect(container.textContent).toContain('Notgroschen erreicht');
  });

  it('sollte das Icon anzeigen', () => {
    const { container } = render(
      <SignatureMoment title="Test" icon="🎯" />,
    );
    expect(container.textContent).toContain('🎯');
  });

  it('sollte CelebrationBurst rendern', () => {
    const { container } = render(
      <SignatureMoment title="Test" icon="🎯" />,
    );
    const burst = container.querySelector('svg');
    expect(burst).toBeInTheDocument();
  });

  it('sollte mit variant="large" größeren Burst rendern', () => {
    const { container } = render(
      <SignatureMoment title="Test" icon="🎯" variant="large" />,
    );
    const burst = container.querySelector('svg');
    expect(burst).toBeInTheDocument();
    // Large variant should have larger burst size
    expect(burst?.getAttribute('width')).toBe('48');
  });

  it('sollte mit variant="small" kleineren Burst rendern', () => {
    const { container } = render(
      <SignatureMoment title="Test" icon="🎯" variant="small" />,
    );
    const burst = container.querySelector('svg');
    expect(burst?.getAttribute('width')).toBe('24');
  });

  it('sollte bei reduced-motion statisch sein', () => {
    reduceMock.mockReturnValue(true);
    const { container } = render(
      <SignatureMoment title="Test" icon="🎯" />,
    );
    const el = container.querySelector('[data-testid="signature-moment"]') as HTMLElement;
    expect(el).toBeInTheDocument();
    // Framer Motion schreibt das `style`-Attribut auch im Ruhezustand — sein
    // bloßes Vorhandensein belegt deshalb keine Bewegung. Der Nachweis ist der
    // Zustand selbst: sofort am Ziel, also keine Transformation und volle
    // Deckkraft ab dem ersten Frame.
    expect(['', 'none']).toContain(el.style.transform);
    expect(['', '1']).toContain(el.style.opacity);
  });

  it('[REGRESSION] sollte ohne reduced-motion NICHT sofort im Endzustand starten', () => {
    // Gegenprobe zum Test darüber: ohne sie wäre „statisch" nicht von „animiert"
    // zu unterscheiden und der Reduced-Motion-Nachweis wertlos.
    reduceMock.mockReturnValue(false);
    const { container } = render(
      <SignatureMoment title="Test" icon="🎯" />,
    );
    const el = container.querySelector('[data-testid="signature-moment"]') as HTMLElement;
    expect(el.style.opacity).toBe('0');
    expect(el.style.transform).toContain('scale');
  });

  it('sollte einen dezenten Glow-Effekt haben', () => {
    const { container } = render(
      <SignatureMoment title="Test" icon="🎯" />,
    );
    const el = container.querySelector('[data-testid="signature-moment"]');
    expect(el?.className).toContain('border-positive');
  });

  it('sollte den Titel mit scale-Animation versehen', () => {
    const { container } = render(
      <SignatureMoment title="Test" icon="🎯" />,
    );
    const titleEl = container.querySelector('[data-testid="signature-title"]');
    expect(titleEl).toBeInTheDocument();
  });

  it('sollte optional einen Subtitle anzeigen', () => {
    const { container } = render(
      <SignatureMoment title="Test" icon="🎯" subtitle="1.000 € gespart" />,
    );
    expect(container.textContent).toContain('1.000 € gespart');
  });
});
