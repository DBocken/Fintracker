-- Dashboard KPI preferences per user
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS kpi_prefs jsonb DEFAULT '{"order": ["net_cashflow", "savings_rate", "transactions_count"], "active": ["net_cashflow", "savings_rate", "transactions_count"]}'::jsonb;
