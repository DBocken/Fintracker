import { readLocalFinanceList, writeLocalFinanceList } from './local-finance-store';
import { safeParseAtBoundary } from '@/lib/schemas/boundary';
import { analyticsConsentSchema, type AnalyticsConsent } from '@/lib/schemas/analytics-consent.schema';

export type { AnalyticsConsent };

const DEFAULT_ALLOWED_CLASSES = ['period', 'category_group', 'measures'];

function defaultConsent(): AnalyticsConsent {
  return {
    user_id: 'local',
    opted_in: false,
    consent_version: 'analytics-v1',
    allowed_data_classes: DEFAULT_ALLOWED_CLASSES,
    withdrawn_at: null,
  };
}

export async function getAnalyticsConsent(): Promise<AnalyticsConsent> {
  const [data] = await readLocalFinanceList<unknown>('analyticsConsent');
  if (!data) return defaultConsent();

  // Kein `as unknown as Record<...>`-Cast mehr (GOV-1): eine strukturell
  // ungültige/beschädigte Ablage fällt jetzt auf den sicheren Ausgangszustand
  // zurück, statt Felder ungeprüft durchzureichen.
  const result = safeParseAtBoundary(analyticsConsentSchema, data, 'analyticsConsent');
  return result.ok ? result.data : defaultConsent();
}

export async function setAnalyticsConsent(optedIn: boolean, allowedDataClasses = DEFAULT_ALLOWED_CLASSES): Promise<AnalyticsConsent> {
  const payload: AnalyticsConsent = {
    user_id: 'local',
    opted_in: optedIn,
    consent_version: 'analytics-v1',
    allowed_data_classes: allowedDataClasses,
    updated_at: new Date().toISOString(),
    withdrawn_at: optedIn ? null : new Date().toISOString(),
  };

  await writeLocalFinanceList('analyticsConsent', [payload]);
  return payload;
}
