-- Speichert vom Nutzer gelernte Zuordnungen (Haendler -> Kategorie),
-- die zukuenftige automatische Kategorisierung mit hoechster Prioritaet steuern.

CREATE TABLE IF NOT EXISTS user_merchant_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  merchant_pattern text NOT NULL,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, merchant_pattern)
);

ALTER TABLE user_merchant_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own merchant rules" ON user_merchant_rules
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_merchant_rules_user_id ON user_merchant_rules(user_id);
