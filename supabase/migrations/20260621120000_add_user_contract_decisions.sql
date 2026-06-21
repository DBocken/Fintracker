-- Dauerhafte Vertrags-Entscheidungen des Nutzers, gekeyt auf einen
-- normalisierten Haendler-Fingerprint. Verträge selbst werden aus den
-- Transaktionen abgeleitet; diese Tabelle haelt nur die Nutzerentscheidung
-- (aktiv / beendet / abgelehnt / pausiert / archiviert) fest, damit alte oder
-- abgelehnte Verträge die aktuellen Fixkosten und Prognosen nicht mehr
-- verfaelschen.

CREATE TABLE IF NOT EXISTS user_contract_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fingerprint text NOT NULL,
  status text NOT NULL DEFAULT 'candidate',
  cycle_override text,
  ended_at date,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, fingerprint)
);

ALTER TABLE user_contract_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own contract decisions" ON user_contract_decisions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_contract_decisions_user_id ON user_contract_decisions(user_id);
