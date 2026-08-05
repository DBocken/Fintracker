import { describe, it, expect } from 'vitest';
import { MATERIAL_TOKENS } from '../material-tokens';

describe('MATERIAL_TOKENS (WP-3.5)', () => {
  it('sollte Shadow-Tokens definieren', () => {
    expect(MATERIAL_TOKENS.shadowAmbient).toBeDefined();
    expect(MATERIAL_TOKENS.shadowKey).toBeDefined();
    expect(MATERIAL_TOKENS.shadowContact).toBeDefined();
  });

  it('sollte Shadow-Tokens als CSS box-shadow-Strings liefern', () => {
    for (const key of ['shadowAmbient', 'shadowKey', 'shadowContact'] as const) {
      expect(MATERIAL_TOKENS[key]).toContain('0');
      expect(MATERIAL_TOKENS[key].length).toBeGreaterThan(10);
    }
  });

  it('sollte Surface-Tokens für Interaktionszustände definieren', () => {
    expect(MATERIAL_TOKENS.surfaceHover).toBeDefined();
    expect(MATERIAL_TOKENS.surfacePress).toBeDefined();
    expect(MATERIAL_TOKENS.surfaceFocus).toBeDefined();
  });

  it('sollte CSS-Var-Mapping bereitstellen', () => {
    const vars = MATERIAL_TOKENS.toCSSVars();
    expect(vars['--shadow-ambient']).toBeDefined();
    expect(vars['--shadow-key']).toBeDefined();
    expect(vars['--shadow-contact']).toBeDefined();
    expect(vars['--surface-hover']).toBeDefined();
    expect(vars['--surface-press']).toBeDefined();
    expect(vars['--surface-focus']).toBeDefined();
  });

  it('sollte Hover eine positive Opazitäts-Veränderung liefern', () => {
    expect(MATERIAL_TOKENS.surfaceHover).toMatch(/rgba|hsla|0\./);
  });

  it('sollte Press eine stärkere Veränderung als Hover liefern', () => {
    // Press should be more intense than hover
    const hoverOpacity = parseFloat(MATERIAL_TOKENS.surfaceHover.match(/[\d.]+(?=\))/)?.[0] ?? '0');
    const pressOpacity = parseFloat(MATERIAL_TOKENS.surfacePress.match(/[\d.]+(?=\))/)?.[0] ?? '0');
    expect(pressOpacity).toBeGreaterThanOrEqual(hoverOpacity);
  });
});
