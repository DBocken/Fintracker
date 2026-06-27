-- ⚠️ Proof of Concept – BEWUSSTE Ausnahme vom Local-only-Designkonzept.
--
-- Diese Tabelle haelt PRO NUTZER einen einzigen, aggregierten Snapshot
-- (Monatsausgaben, Budget-Status, Cashflow, Ausreisser) bereit, damit ein
-- gehosteter MCP-Server ihn fuer Sprach-/Chat-Abfragen aus Claude/ChatGPT lesen
-- kann. Es werden NIE Rohtransaktionen, IBANs oder Freitexte gespeichert –
-- ausschliesslich die in cloud-mcp-sync-service.ts erzeugten Aggregate.
-- Schreibzugriff nur fuer den Eigentuemer (RLS). Der MCP-Server liest mit dem
-- Service-Role-Key und matcht das Bearer-Token ueber token_hash.

CREATE TABLE IF NOT EXISTS mcp_aggregate_snapshots (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  -- SHA-256-Hex des Zugriffstokens; Klartext-Token liegt NUR beim Nutzer.
  token_hash text NOT NULL,
  -- Aggregat-Snapshot (McpAggregateSnapshot, schema_version = 1).
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mcp_aggregate_snapshots ENABLE ROW LEVEL SECURITY;

-- Nutzer duerfen ausschliesslich ihren eigenen Snapshot verwalten.
CREATE POLICY "own mcp snapshot" ON mcp_aggregate_snapshots
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Schneller Lookup des MCP-Servers per Token-Hash.
CREATE UNIQUE INDEX IF NOT EXISTS idx_mcp_aggregate_snapshots_token_hash
  ON mcp_aggregate_snapshots(token_hash);

-- Token-gegateter Lesezugriff OHNE Service-Role-Key: Die Vercel-Function ruft
-- diese SECURITY-DEFINER-Funktion mit dem oeffentlichen anon-Key auf. Sie gibt
-- den Snapshot NUR fuer den passenden Token-Hash zurueck. Wer das Token nicht
-- kennt (256-Bit-Zufall), kann den Hash nicht erraten – damit ist kein extra
-- Secret noetig.
CREATE OR REPLACE FUNCTION public.get_mcp_snapshot(p_token_hash text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT payload FROM mcp_aggregate_snapshots WHERE token_hash = p_token_hash;
$$;

REVOKE ALL ON FUNCTION public.get_mcp_snapshot(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_mcp_snapshot(text) TO anon, authenticated;
