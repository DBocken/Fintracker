import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Skeleton } from '../skeleton';

describe('Skeleton (WP-3.4 Enhanced Loading)', () => {
  it('sollte mit animate-pulse rendern (Baseline)', () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('animate-pulse');
  });

  it('sollte mit variant="shimmer" den Shimmer-Style verwenden', () => {
    const { container } = render(<Skeleton variant="shimmer" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('skeleton-shimmer');
  });

  it('sollte mit variant="shimmer" nicht animate-pulse verwenden', () => {
    const { container } = render(<Skeleton variant="shimmer" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).not.toContain('animate-pulse');
  });

  it('sollte mit default variant "pulse" weiterhin animate-pulse verwenden', () => {
    const { container } = render(<Skeleton variant="pulse" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('animate-pulse');
  });

  it('sollte data-variant Attribut für Tests setzen', () => {
    const { container } = render(<Skeleton variant="shimmer" />);
    const el = container.firstChild as HTMLElement;
    expect(el.getAttribute('data-variant')).toBe('shimmer');
  });
});
