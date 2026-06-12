import { describe, it, expect } from 'vitest';
import { accountLimitForTier, evaluateAccountCreation } from '../account-limits';
import { ANONYMOUS_ACCOUNT_LIMIT, FREE_ACCOUNT_LIMIT } from '../constants';

describe('accountLimitForTier', () => {
  it('gibt 1 für anonymous zurück', () => {
    expect(accountLimitForTier('anonymous')).toBe(ANONYMOUS_ACCOUNT_LIMIT);
    expect(accountLimitForTier('anonymous')).toBe(1);
  });

  it('gibt 3 für free zurück', () => {
    expect(accountLimitForTier('free')).toBe(FREE_ACCOUNT_LIMIT);
    expect(accountLimitForTier('free')).toBe(3);
  });

  it('gibt Infinity für premium zurück', () => {
    expect(accountLimitForTier('premium')).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('evaluateAccountCreation', () => {
  it('erlaubt Konto-Anlage unter dem Limit', () => {
    const result = evaluateAccountCreation('free', 0);
    expect(result.allowed).toBe(true);
    expect(result.current).toBe(0);
    expect(result.limit).toBe(3);
    expect(result.message).toBeUndefined();
  });

  it('erlaubt Konto-Anlage am Limit-Rand (free: 2 von 3)', () => {
    const result = evaluateAccountCreation('free', 2);
    expect(result.allowed).toBe(true);
    expect(result.current).toBe(2);
    expect(result.limit).toBe(3);
  });

  it('blockt Konto-Anlage am Limit (free: 3 von 3)', () => {
    const result = evaluateAccountCreation('free', 3);
    expect(result.allowed).toBe(false);
    expect(result.current).toBe(3);
    expect(result.limit).toBe(3);
    expect(result.message).toContain('Maximum');
  });

  it('zeigt anonym-spezifische Nachricht bei Limit', () => {
    const result = evaluateAccountCreation('anonymous', 1);
    expect(result.allowed).toBe(false);
    expect(result.message).toContain('Mehrere Konten gibt es mit dem kostenlosen Login');
    expect(result.message).toContain('Deine Daten bleiben trotzdem auf deinem Gerät');
  });

  it('erlaubt unbegrenzte Konten für premium', () => {
    const result = evaluateAccountCreation('premium', 1000);
    expect(result.allowed).toBe(true);
    expect(result.current).toBe(1000);
    expect(result.limit).toBe(Number.POSITIVE_INFINITY);
  });
});
