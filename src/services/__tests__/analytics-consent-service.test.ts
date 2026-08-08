import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearLocalKvStore } from '../idb-kv';
import { localEncryption } from '../local-crypto';
import { writeLocalFinanceList } from '../local-finance-store';
import { getAnalyticsConsent, setAnalyticsConsent } from '../analytics-consent-service';

/**
 * GOV-1 / WP 2.2: `getAnalyticsConsent()` las den gespeicherten Datensatz
 * bisher per `as unknown as Record<string, unknown>` — ein Cast ohne
 * Laufzeitprüfung. Diese Tests belegen die zod-Grenze: ein gültiger
 * Datensatz geht unverändert durch, ein strukturell kaputter/manipulierter
 * fällt auf den sicheren Ausgangszustand zurück statt Felder ungeprüft
 * durchzureichen.
 */
describe('analytics-consent-service', () => {
  beforeEach(async () => {
    await clearLocalKvStore();
    localStorage.clear();
    localStorage.setItem('ausgabentracker_locale_v1', 'de');
    localEncryption.lock();
  });

  afterEach(async () => {
    await clearLocalKvStore();
    localStorage.clear();
    localEncryption.lock();
  });

  it('sollte ohne gespeicherten Datensatz den Ausgangszustand (kein Opt-in) liefern', async () => {
    await expect(getAnalyticsConsent()).resolves.toMatchObject({
      opted_in: false,
      allowed_data_classes: ['period', 'category_group', 'measures'],
    });
  });

  it('sollte einen gültigen gespeicherten Datensatz unverändert liefern', async () => {
    await setAnalyticsConsent(true, ['period']);

    await expect(getAnalyticsConsent()).resolves.toMatchObject({
      opted_in: true,
      allowed_data_classes: ['period'],
    });
  });

  it('[REGRESSION] sollte einen strukturell ungültigen Datensatz nicht durchreichen, sondern auf den sicheren Ausgangszustand zurückfallen', async () => {
    // `opted_in` als String statt boolean — genau die Art Fund, die der
    // frühere Cast unbemerkt durchgereicht hätte.
    await writeLocalFinanceList('analyticsConsent', [
      { user_id: 'local', opted_in: 'ja-klar', consent_version: 'analytics-v1', allowed_data_classes: ['period'] } as never,
    ]);

    await expect(getAnalyticsConsent()).resolves.toEqual({
      user_id: 'local',
      opted_in: false,
      consent_version: 'analytics-v1',
      allowed_data_classes: ['period', 'category_group', 'measures'],
      withdrawn_at: null,
    });
  });
});
