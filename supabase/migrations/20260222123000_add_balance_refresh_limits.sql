-- Limit automatic balance refreshes per user per day to 4
CREATE TABLE IF NOT EXISTS public.balance_refresh_limits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_refresh_date DATE NOT NULL DEFAULT CURRENT_DATE,
  daily_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.balance_refresh_limits ENABLE ROW LEVEL SECURITY;

-- User can only read/write their own limit row
CREATE POLICY "balance_refresh_limits_select_policy" ON public.balance_refresh_limits
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "balance_refresh_limits_insert_policy" ON public.balance_refresh_limits
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "balance_refresh_limits_update_policy" ON public.balance_refresh_limits
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "balance_refresh_limits_upsert_policy" ON public.balance_refresh_limits
FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_balance_refresh_limits_user_date ON public.balance_refresh_limits(user_id, last_refresh_date);
