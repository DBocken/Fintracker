-- Backfill: RLS für accounts & bank_connections im Repo versionieren.
--
-- Beide Tabellen stammen aus der Zeit VOR den in-repo-Migrationen (out-of-repo
-- angelegt, genutzt von den Edge Functions refresh-balances / gocardless-sync /
-- delete-account). Diese Migration kodifiziert den Soll-Zustand, damit das Repo
-- die Source of Truth für die Policies ist — der Wächter-Test
-- src/security/supabase-rls.security.test.ts erzwingt das für alle
-- Laufzeit-Tabellen.
--
-- Idempotent & defensiv: to_regclass-Guards überspringen Datenbanken, in denen
-- die Legacy-Tabellen (noch) nicht existieren (frische Preview-/Test-DBs).
-- Postgres kennt kein CREATE POLICY IF NOT EXISTS, daher DROP POLICY IF EXISTS
-- vor jedem CREATE POLICY. Policy-Stil wie "own mcp snapshot"
-- (20260627120000): Zeilen gehören ausschließlich ihrem Besitzer.

DO $$
BEGIN
  IF to_regclass('public.accounts') IS NOT NULL THEN
    ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "own accounts" ON public.accounts;
    CREATE POLICY "own accounts" ON public.accounts
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.bank_connections') IS NOT NULL THEN
    ALTER TABLE public.bank_connections ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "own bank connections" ON public.bank_connections;
    CREATE POLICY "own bank connections" ON public.bank_connections
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
