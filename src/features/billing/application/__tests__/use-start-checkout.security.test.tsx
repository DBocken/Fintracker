/**
 * Sicherheit der Kauf-Weiterleitung (WP 6.3, AGENTS.md §10 Regel 5).
 *
 * Die Checkout-URL kommt aus einer **API-Antwort** und ist damit laut
 * `docs/security-boundaries.md` nicht vertrauenswürdig — auch wenn der Dienst
 * unserer ist. Ohne Prüfung wäre `window.location.href = url` ein offener
 * Weiterleitungspunkt: Ein kompromittierter oder fehlkonfigurierter Dienst
 * könnte den Nutzer auf eine beliebige Seite schicken, und zwar genau in dem
 * Moment, in dem er mit einer Zahlung rechnet und deshalb besonders bereit
 * ist, Zugangsdaten einzugeben.
 *
 * Dieselbe Prüfung schützt den GoCardless-Redirect in `BankCallbackPage`.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createHookWrapper } from '@/test-utils/render';

const serviceMock = vi.hoisted(() => ({ startCheckout: vi.fn() }));

vi.mock('@/services/entitlement-service', () => ({
  startCheckout: serviceMock.startCheckout,
  fetchSubscription: vi.fn(),
}));

import { useStartCheckout } from '../use-start-checkout';

beforeEach(() => serviceMock.startCheckout.mockReset());

async function kaufVersuch(url: string) {
  serviceMock.startCheckout.mockResolvedValue(url);
  const navigate = vi.fn();
  const { wrapper } = createHookWrapper();
  const { result } = renderHook(() => useStartCheckout({ navigate }), { wrapper });

  result.current.mutate('premium_monthly');
  await waitFor(() => expect(result.current.isPending).toBe(false));
  return { navigate, result };
}

describe('[SECURITY] Kauf-Weiterleitung', () => {
  it('sollte zu einer echten Mollie-URL weiterleiten', async () => {
    const { navigate } = await kaufVersuch('https://www.mollie.com/checkout/select-method/abc');
    expect(navigate).toHaveBeenCalledWith('https://www.mollie.com/checkout/select-method/abc');
  });

  it('sollte einen FREMDEN Host blockieren', async () => {
    const { navigate, result } = await kaufVersuch('https://boese.example/phishing');
    expect(navigate).not.toHaveBeenCalled();
    expect(result.current.isError).toBe(true);
  });

  it('sollte einen Host blockieren, der nur so AUSSIEHT wie Mollie', async () => {
    // `endsWith('.' + suffix)` statt `includes` — sonst kaeme
    // "mollie.com.boese.tld" durch, und genau das ist die uebliche Bauform.
    const { navigate } = await kaufVersuch('https://mollie.com.boese.tld/checkout');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('sollte "evilmollie.com" blockieren', async () => {
    const { navigate } = await kaufVersuch('https://evilmollie.com/checkout');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('sollte eine javascript:-URL blockieren', async () => {
    const { navigate } = await kaufVersuch('javascript:alert(1)');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('sollte http:// blockieren — nur https ist zulaessig', async () => {
    const { navigate } = await kaufVersuch('http://www.mollie.com/checkout');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('sollte eine URL mit eingebetteter Userinfo blockieren', async () => {
    // "https://boese@www.mollie.com" wuerde sonst als Mollie-Host durchgehen.
    const { navigate } = await kaufVersuch('https://boese@www.mollie.com/checkout');
    expect(navigate).not.toHaveBeenCalled();
  });
});
