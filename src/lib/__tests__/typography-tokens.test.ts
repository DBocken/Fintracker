import { describe, it, expect } from 'vitest';
import { TYPOGRAPHY_TOKENS } from '../typography-tokens';

describe('TYPOGRAPHY_TOKENS', () => {
  it('sollte alle erforderlichen Token-Namen definieren', () => {
    const keys = Object.keys(TYPOGRAPHY_TOKENS).sort();
    expect(keys).toEqual(
      expect.arrayContaining([
        'heroDesktop',
        'heroMobile',
        'display',
        'headline',
        'body',
        'caption',
        'weightDisplay',
        'weightValue',
        'weightLabel',
        'weightBody',
      ]),
    );
  });

  it('sollte heroDesktop als rem-Wert mit ≥ 3rem liefern', () => {
    expect(TYPOGRAPHY_TOKENS.heroDesktop).toMatch(/^\d/);
    const rem = parseFloat(TYPOGRAPHY_TOKENS.heroDesktop);
    expect(rem).toBeGreaterThanOrEqual(3);
  });

  it('sollte heroMobile kleiner als heroDesktop aber ≥ 2rem liefern', () => {
    const mobile = parseFloat(TYPOGRAPHY_TOKENS.heroMobile);
    const desktop = parseFloat(TYPOGRAPHY_TOKENS.heroDesktop);
    expect(mobile).toBeGreaterThanOrEqual(2);
    expect(mobile).toBeLessThan(desktop);
  });

  it('[VB-1] sollte caption mindestens 0.75rem (12px) sein', () => {
    const caption = parseFloat(TYPOGRAPHY_TOKENS.caption);
    expect(caption).toBeGreaterThanOrEqual(0.75);
  });

  it('sollte body zwischen 0.875rem und 1rem liegen', () => {
    const body = parseFloat(TYPOGRAPHY_TOKENS.body);
    expect(body).toBeGreaterThanOrEqual(0.875);
    expect(body).toBeLessThanOrEqual(1);
  });

  it('sollte weightValue 700 sein (für Helden-Kennzahlen)', () => {
    expect(TYPOGRAPHY_TOKENS.weightValue).toBe('700');
  });

  it('sollte weightBody 400 sein', () => {
    expect(TYPOGRAPHY_TOKENS.weightBody).toBe('400');
  });

  it('sollte CSS-Var-Mapping alle Token als --font-size-* / --font-weight-* verfügbar machen', () => {
    const cssVars = TYPOGRAPHY_TOKENS.toCSSVars();
    expect(cssVars['--font-size-hero']).toBeDefined();
    expect(cssVars['--font-size-hero-mobile']).toBeDefined();
    expect(cssVars['--font-size-display']).toBeDefined();
    expect(cssVars['--font-size-headline']).toBeDefined();
    expect(cssVars['--font-size-body']).toBeDefined();
    expect(cssVars['--font-size-caption']).toBeDefined();
    expect(cssVars['--font-weight-display']).toBeDefined();
    expect(cssVars['--font-weight-value']).toBeDefined();
    expect(cssVars['--font-weight-label']).toBeDefined();
    expect(cssVars['--font-weight-body']).toBeDefined();
  });
});
