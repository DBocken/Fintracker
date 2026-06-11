import { supabase } from '@/integrations/supabase/client';
import { requireUserId } from './auth-service';

export type AnalyticsConsent = {
  user_id: string;
  opted_in: boolean;
  consent_version: string;
  allowed_data_classes: string[];
  updated_at?: string;
  withdrawn_at?: string | null;
};

const DEFAULT_ALLOWED_CLASSES = ['period', 'category_group', 'measures'];

export async function getAnalyticsConsent(): Promise<AnalyticsConsent> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('analytics_consent')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (!data) {
    return {
      user_id: userId,
      opted_in: false,
      consent_version: 'analytics-v1',
      allowed_data_classes: DEFAULT_ALLOWED_CLASSES,
      withdrawn_at: null,
    };
  }

  return {
    ...(data as any),
    allowed_data_classes: Array.isArray((data as any).allowed_data_classes)
      ? (data as any).allowed_data_classes
      : DEFAULT_ALLOWED_CLASSES,
  } as AnalyticsConsent;
}

export async function setAnalyticsConsent(optedIn: boolean, allowedDataClasses = DEFAULT_ALLOWED_CLASSES): Promise<AnalyticsConsent> {
  const userId = await requireUserId();
  const payload = {
    user_id: userId,
    opted_in: optedIn,
    consent_version: 'analytics-v1',
    allowed_data_classes: allowedDataClasses,
    updated_at: new Date().toISOString(),
    withdrawn_at: optedIn ? null : new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('analytics_consent')
    .upsert(payload, { onConflict: 'user_id' })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as AnalyticsConsent;
}
