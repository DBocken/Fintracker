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
    const el = container.querySelector('[data-testid="signature-moment"]');
    expect(el).toBeInTheDocument();
    // Geprueft wird der Endzustand, nicht die Abwesenheit eines style-Attributs:
    // Framer Motion schreibt auch im statischen Fall den aufgeloesten Stil
    // ('opacity: 1; transform: none;'). Genau das IST der statische Zustand —
    // kein Rest-Transform, volle Deckkraft.
    const style = el?.getAttribute('style') ?? '';
    expect(style).toMatch(/transform:\s*none/);
    expect(style).not.toMatch(/scale/);
  });

  it('sollte ohne reduced-motion mit einem Skalierungs-Transform starten', () => {
    // Gegenprobe zum Test darueber: ohne Reduced Motion ist der Startzustand
    // `scale: 0.95` — ohne diese Probe wuerde der Test oben auch dann bestehen,
    // wenn die Bewegung generell fehlte.
    const { container } = render(
      <SignatureMoment title="Test" icon="🎯" />,
    );
    const el = container.querySelector('[data-testid="signature-moment"]');
    expect(el?.getAttribute('style') ?? '').toMatch(/scale|matrix/);
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
