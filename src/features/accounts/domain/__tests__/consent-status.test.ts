/**
 * Reine Ableitungen rund um die Bankfreigabe (WP 6.5a).
 *
 * Vor der Slice standen diese drei Entscheidungen als Ausdruck mitten im JSX
 * von `AccountManager` — „abgelaufen", „laeuft bald ab" und „welche Konten
 * betrifft es". Sie unterscheiden zwei Zustaende, die einander zum Verwechseln
 * aehnlich sehen, und waren genau deshalb nicht einzeln pruefbar.
 */

import { describe, it, expect } from 'vitest';
import type { Account } from '@/lib/account-types';
import {
  CONSENT_EXPIRY_WARNING_DAYS,
  isConsentExpiringSoon,
  selectExpiredConsentAccounts,
} from '../consent-status';

function konto(id: string): Account {
  return {
    id,
    user_id: 'u1',
    name: `Konto ${id}`,
    type: 'checking',
    currency: 'EUR',
    color: '#1d5c54',
    icon: '🏦',
    is_budget_pool_member: true,
    order_index: 0,
  } as Account;
}

describe('isConsentExpiringSoon', () => {
  it('sollte eine bald ablaufende Freigabe erkennen', () => {
    expect(isConsentExpiringSoon({ expired: false, daysRemaining: 3 })).toBe(true);
    expect(isConsentExpiringSoon({ expired: false, daysRemaining: CONSENT_EXPIRY_WARNING_DAYS })).toBe(true);
  });

  it('sollte eine noch lange gueltige Freigabe nicht als bald ablaufend melden', () => {
    expect(isConsentExpiringSoon({ expired: false, daysRemaining: CONSENT_EXPIRY_WARNING_DAYS + 1 })).toBe(false);
  });

  it('sollte eine BEREITS abgelaufene Freigabe nicht zusaetzlich als „bald" melden', () => {
    // Sonst stuenden beide Abzeichen nebeneinander und widersprächen sich.
    expect(isConsentExpiringSoon({ expired: true, daysRemaining: -2 })).toBe(false);
  });

  it('sollte ohne Restlaufzeit nichts behaupten', () => {
    expect(isConsentExpiringSoon(undefined)).toBe(false);
    expect(isConsentExpiringSoon({ expired: false })).toBe(false);
    expect(isConsentExpiringSoon({ expired: false, daysRemaining: null })).toBe(false);
  });

  it('sollte eine heute endende, noch nicht abgelaufene Freigabe als „bald" fuehren', () => {
    expect(isConsentExpiringSoon({ expired: false, daysRemaining: 0 })).toBe(true);
  });
});

describe('selectExpiredConsentAccounts', () => {
  it('sollte nur die Konten mit abgelaufener Freigabe liefern — in Listenreihenfolge', () => {
    const konten = [konto('a'), konto('b'), konto('c')];
    const stati = {
      a: { expired: true },
      c: { expired: true },
    };

    expect(selectExpiredConsentAccounts(konten, stati).map((k) => k.id)).toEqual(['a', 'c']);
  });

  it('sollte ohne Statusangaben kein Konto melden', () => {
    expect(selectExpiredConsentAccounts([konto('a')], {})).toEqual([]);
  });
});
