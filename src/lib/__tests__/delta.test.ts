import { describe, it, expect } from 'vitest';
import { deltaSeverity, deltaTextClass, DELTA_THRESHOLD_PERCENT } from '../delta';

describe('deltaSeverity', () => {
  it('bleibt neutral unterhalb des Schwellenwerts (+5 % ist kein Alarm)', () => {
    expect(deltaSeverity(5)).toBe('neutral');
    expect(deltaSeverity(-5)).toBe('neutral');
    expect(deltaSeverity(9.99)).toBe('neutral');
    expect(deltaSeverity(0)).toBe('neutral');
  });

  it('färbt ab dem Schwellenwert', () => {
    expect(deltaSeverity(DELTA_THRESHOLD_PERCENT)).toBe('positive');
    expect(deltaSeverity(15)).toBe('positive');
    expect(deltaSeverity(-15)).toBe('warning');
  });

  it('berücksichtigt increaseIsGood für Ausgaben/Schulden', () => {
    expect(deltaSeverity(20, { increaseIsGood: false })).toBe('warning');
    expect(deltaSeverity(-20, { increaseIsGood: false })).toBe('positive');
  });

  it('unterstützt eigene Schwellenwerte', () => {
    expect(deltaSeverity(5, { thresholdPercent: 3 })).toBe('positive');
    expect(deltaSeverity(2, { thresholdPercent: 3 })).toBe('neutral');
  });

  it('behandelt ungültige Werte als neutral', () => {
    expect(deltaSeverity(NaN)).toBe('neutral');
    expect(deltaSeverity(Infinity)).toBe('neutral');
  });
});

describe('deltaTextClass', () => {
  it('mappt Severity auf Theme-Tokens', () => {
    expect(deltaTextClass('positive')).toBe('text-positive');
    expect(deltaTextClass('warning')).toBe('text-warning');
    expect(deltaTextClass('neutral')).toBe('text-muted-foreground');
  });
});
