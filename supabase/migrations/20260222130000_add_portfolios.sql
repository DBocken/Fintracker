-- Create portfolios table
CREATE TABLE IF NOT EXISTS public.portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'manual' CHECK (type IN ('etoro', 'manual', 'demo')),
  provider_config JSONB DEFAULT '{}'::jsonb,
  currency TEXT DEFAULT 'EUR',
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create portfolio_positions table
CREATE TABLE IF NOT EXISTS public.portfolio_positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID REFERENCES public.portfolios(id) ON DELETE CASCADE NOT NULL,
  symbol TEXT NOT NULL,
  name TEXT,
  quantity DECIMAL(18, 8) NOT NULL,
  entry_price DECIMAL(18, 8) NOT NULL,
  currency TEXT DEFAULT 'EUR',
  exchange TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  last_price DECIMAL(18, 8),
  last_price_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on portfolios (REQUIRED for security)
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;

-- Create secure policies for portfolios
CREATE POLICY "portfolios_select_policy" ON public.portfolios
FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "portfolios_insert_policy" ON public.portfolios
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "portfolios_update_policy" ON public.portfolios
FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "portfolios_delete_policy" ON public.portfolios
FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Enable RLS on portfolio_positions (REQUIRED for security)
ALTER TABLE public.portfolio_positions ENABLE ROW LEVEL SECURITY;

-- Create secure policies for portfolio_positions
CREATE POLICY "portfolio_positions_select_policy" ON public.portfolio_positions
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.portfolios
    WHERE portfolios.id = portfolio_positions.portfolio_id
    AND portfolios.user_id = auth.uid()
  )
);

CREATE POLICY "portfolio_positions_insert_policy" ON public.portfolio_positions
FOR INSERT TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.portfolios
    WHERE portfolios.id = portfolio_positions.portfolio_id
    AND portfolios.user_id = auth.uid()
  )
);

CREATE POLICY "portfolio_positions_update_policy" ON public.portfolio_positions
FOR UPDATE TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.portfolios
    WHERE portfolios.id = portfolio_positions.portfolio_id
    AND portfolios.user_id = auth.uid()
  )
);

CREATE POLICY "portfolio_positions_delete_policy" ON public.portfolio_positions
FOR DELETE TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.portfolios
    WHERE portfolios.id = portfolio_positions.portfolio_id
    AND portfolios.user_id = auth.uid()
  )
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_portfolios_user_id ON public.portfolios(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolios_is_active ON public.portfolios(is_active);
CREATE INDEX IF NOT EXISTS idx_portfolio_positions_portfolio_id ON public.portfolio_positions(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_positions_symbol ON public.portfolio_positions(symbol);

-- Create updated_at trigger for portfolios
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_portfolios_updated_at
  BEFORE UPDATE ON public.portfolios
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_portfolio_positions_updated_at
  BEFORE UPDATE ON public.portfolio_positions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
