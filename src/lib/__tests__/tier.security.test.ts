import { beforeEach, describe, expect, it } from 'vitest';
import { NAV_GROUPS, ROUTE_GUARDS } from '@/components/layout/nav-config';
import { deriveTier, FEATURES, getTierOverride, hasFeatureAccess, TIER_OVERRIDE_KEY } from '../tier';

beforeEach(() => localStorage.clear());

describe('[SECURITY] premium route authorization', () => {
  it('jede Premium-Navigation besitzt einen gleichwertigen Route-Guard', () => {
    const premiumItems = NAV_GROUPS.flatMap((group) => group.items).filter((item) => item.requiredTier === 'premium');
    expect(premiumItems.length).toBeGreaterThan(0);
    for (const item of premiumItems) {
      const feature = ROUTE_GUARDS[item.path];
      expect(feature, `${item.path} fehlt in ROUTE_GUARDS`).toBeDefined();
      expect(FEATURES[feature]).toBe('premium');
    }
  });

  it('direkter Routenzugriff ändert die Feature-Berechtigung eines Free-Nutzers nicht', () => {
    for (const feature of Object.values(ROUTE_GUARDS)) {
      if (FEATURES[feature] === 'premium') expect(hasFeatureAccess('free', feature)).toBe(false);
    }
  });

  it('manipulierte lokale Tierwerte werden von der zentralen Ableitung ignoriert', () => {
    localStorage.setItem('tier', 'premium');
    localStorage.setItem('premium', 'true');
    localStorage.setItem('alpha_code', 'alphatester');
    expect(deriveTier('authenticated')).toBe('free');
    expect(hasFeatureAccess(deriveTier('authenticated'), 'premiumAnalytics')).toBe(false);
  });

  it('der WIRKSAME Override-Schlüssel überstimmt ein serverseitiges "free" nicht', () => {
    // Der Test darüber setzt `tier`, `premium` und `alpha_code` — Schlüssel,
    // die die Ableitung noch nie gelesen hat. Er bestand also, ohne den
    // einzigen zu prüfen, der wirklich wirkt: TIER_OVERRIDE_KEY.
    //
    // Genau hier lag der Bypass: Solange Premium unverkäuflich war, war das
    // dokumentierte Absicht. Mit dem Kauf wird derselbe Code zur offenen Tür.
    localStorage.setItem(TIER_OVERRIDE_KEY, 'premium');
    const override = getTierOverride();
    expect(override).toBe('premium'); // der Schlüssel wirkt tatsächlich …

    // … aber nicht gegen ein Serverurteil.
    expect(deriveTier('authenticated', override, false, 'free')).toBe('free');
    expect(
      hasFeatureAccess(deriveTier('authenticated', override, false, 'free'), 'premiumAnalytics'),
    ).toBe(false);
  });

  it('während Auth-Laden gilt weiterhin das restriktivste Tier', () => {
    expect(deriveTier('loading')).toBe('anonymous');
  });
});
