import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { AtmosphereLayer } from '../AtmosphereLayer';
import type { AtmosphereState } from '@/hooks/useAtmosphereState';

describe('AtmosphereLayer', () => {
  it('sollte ein fixiertes, klick-durchlässiges Element rendern', () => {
    const state: AtmosphereState = { temperature: 'warm', intensity: 0.5, pulse: 'steady' };
    const { container } = render(<AtmosphereLayer state={state} />);
    const layer = container.querySelector('[data-testid="atmosphere-layer"]');
    expect(layer).toBeInTheDocument();
  });

  it('[VB-1] sollte pointer-events:none haben', () => {
    const state: AtmosphereState = { temperature: 'warm', intensity: 0.5, pulse: 'steady' };
    const { container } = render(<AtmosphereLayer state={state} />);
    const layer = container.querySelector('[data-testid="atmosphere-layer"]') as HTMLElement;
    expect(layer.style.pointerEvents).toBe('none');
  });

  it('sollte bei neutraler Atmosphäre transparent oder minimal sein', () => {
    const state: AtmosphereState = { temperature: 'neutral', intensity: 0, pulse: 'steady' };
    const { container } = render(<AtmosphereLayer state={state} />);
    const layer = container.querySelector('[data-testid="atmosphere-layer"]') as HTMLElement;
    // Opazität sollte sehr niedrig sein bei intensity=0
    const opacity = parseFloat(layer.style.opacity || '1');
    expect(opacity).toBeLessThanOrEqual(0.05);
  });

  it('[VB-2] sollte Opazität 0.1 niemals überschreiten', () => {
    const state: AtmosphereState = { temperature: 'warm', intensity: 1, pulse: 'celebrate' };
    const { container } = render(<AtmosphereLayer state={state} />);
    const layer = container.querySelector('[data-testid="atmosphere-layer"]') as HTMLElement;
    const opacity = parseFloat(layer.style.opacity || '1');
    expect(opacity).toBeLessThanOrEqual(0.1);
  });

  it('sollte bei warm-Temperatur warme Farben verwenden', () => {
    const state: AtmosphereState = { temperature: 'warm', intensity: 0.5, pulse: 'steady' };
    const { container } = render(<AtmosphereLayer state={state} />);
    const layer = container.querySelector('[data-testid="atmosphere-layer"]') as HTMLElement;
    expect(layer.dataset.temperature).toBe('warm');
  });

  it('sollte bei cool-Temperatur kühle Farben verwenden', () => {
    const state: AtmosphereState = { temperature: 'cool', intensity: 0.7, pulse: 'alert' };
    const { container } = render(<AtmosphereLayer state={state} />);
    const layer = container.querySelector('[data-testid="atmosphere-layer"]') as HTMLElement;
    expect(layer.dataset.temperature).toBe('cool');
  });

  it('[VB-3] sollte kein Canvas oder WebGL verwenden', () => {
    const state: AtmosphereState = { temperature: 'warm', intensity: 0.5, pulse: 'steady' };
    const { container } = render(<AtmosphereLayer state={state} />);
    expect(container.querySelector('canvas')).toBeNull();
  });

  it('[VB-4] sollte bei intensity=0 nicht crashen', () => {
    const state: AtmosphereState = { temperature: 'neutral', intensity: 0, pulse: 'steady' };
    expect(() => render(<AtmosphereLayer state={state} />)).not.toThrow();
  });
});
