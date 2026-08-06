-- F-SEC-3 (Audit 2026-07-02): Das Tageslimit für Kontostand-Aktualisierungen
-- war wirkungslos.
--
-- 20260222123000 gab dem Nutzer auf seine eigene Zeile in
-- balance_refresh_limits FOR INSERT, FOR UPDATE *und* FOR ALL. Der Zähler, der
-- ihn begrenzen soll, lag damit in seiner eigenen Reichweite: ein UPDATE mit
-- dem anon-Key (public by design) auf `daily_count = 0` — oder ein DELETE über
-- die FOR-ALL-Policy — stellte das Kontingent beliebig oft wieder her. Begrenzt
-- wird hier keine Datenbanklast, sondern die EXTERNE GoCardless-Quote; ein
-- selbst zurücksetzbares Limit schützt die gar nicht.
--
-- Der Audit schlug einen service_role-Client in der Edge Function vor. Das
-- verlegt die Schwachstelle nur: refresh-balances ist eine nutzergetriebene
-- Function, und der service_role-Key umgeht RLS für ALLE Tabellen, nicht nur
-- für diese eine Spalte. Stattdessen bleibt der Schreibweg hier — als
-- SECURITY-DEFINER-Funktion, die genau eine Operation kann und den Nutzer aus
-- auth.uid() nimmt, statt ihn sich sagen zu lassen. So bleibt auch die
-- Allowlist aus src/security/edge-functions-service-role.security.test.ts
-- unangetastet: keine Edge Function außer delete-account braucht service_role.
--
-- Zweiter, unabhängiger Fehler derselben Stelle: Prüfen (SELECT) und
-- Hochzählen (UPDATE) waren zwei Statements mit dem externen Abruf dazwischen.
-- Bei MAX = 1 pro Tag genügten zwei gleichzeitige Anfragen, um beide durch die
-- Prüfung zu bekommen. Das Kontingent wird deshalb jetzt in EINEM Statement
-- geprüft und verbraucht (ON CONFLICT DO UPDATE nimmt die Zeilensperre), und
-- zwar VOR dem Abruf — nicht danach.

-- Einzige Quelle für die Höhe des Limits. Vorher stand sie als
-- MAX_DAILY_REFRESHES in der Edge Function und war für die Datenbank, die sie
-- durchsetzen soll, unsichtbar.
CREATE OR REPLACE FUNCTION public.balance_refresh_daily_limit()
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT 1;
$$;

-- Prüft und verbraucht in einem Statement. Kein user_id-Parameter (sonst wäre
-- der Aufrufer wieder derjenige, der bestimmt, wessen Kontingent zählt) und
-- kein Limit-Parameter (sonst reicht der Aufrufer sein eigenes Limit nach).
CREATE OR REPLACE FUNCTION public.consume_balance_refresh()
RETURNS TABLE (allowed boolean, remaining integer, daily_limit integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_limit integer := public.balance_refresh_daily_limit();
  v_count integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'unauthenticated' USING ERRCODE = '28000';
  END IF;

  -- Trifft die WHERE-Bedingung nicht zu (Kontingent heute erschöpft), wird
  -- keine Zeile zurückgegeben und v_count bleibt NULL -> abgelehnt.
  INSERT INTO public.balance_refresh_limits AS l (user_id, last_refresh_date, daily_count, updated_at)
  VALUES (v_user, CURRENT_DATE, 1, NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET daily_count = CASE
          WHEN l.last_refresh_date = CURRENT_DATE THEN l.daily_count + 1
          ELSE 1
        END,
        last_refresh_date = CURRENT_DATE,
        updated_at = NOW()
    WHERE l.last_refresh_date < CURRENT_DATE OR l.daily_count < v_limit
  RETURNING l.daily_count INTO v_count;

  IF v_count IS NULL THEN
    RETURN QUERY SELECT false, 0, v_limit;
  ELSE
    RETURN QUERY SELECT true, GREATEST(v_limit - v_count, 0), v_limit;
  END IF;
END;
$$;

-- Lesen ohne zu verbrauchen — für die Antwortpfade, die gar nicht erst
-- abrufen (kein verbundenes Konto, keine aktive Synchronisierung). Diese
-- dürfen das Tageskontingent nicht aufzehren.
CREATE OR REPLACE FUNCTION public.balance_refresh_status()
RETURNS TABLE (used_today integer, remaining integer, daily_limit integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH today AS (
    SELECT COALESCE(
      (SELECT l.daily_count
         FROM public.balance_refresh_limits l
        WHERE l.user_id = auth.uid()
          AND l.last_refresh_date = CURRENT_DATE),
      0) AS used
  )
  SELECT
    today.used,
    GREATEST(public.balance_refresh_daily_limit() - today.used, 0),
    public.balance_refresh_daily_limit()
  FROM today;
$$;

REVOKE ALL ON FUNCTION public.balance_refresh_daily_limit() FROM public;
REVOKE ALL ON FUNCTION public.consume_balance_refresh() FROM public;
REVOKE ALL ON FUNCTION public.balance_refresh_status() FROM public;

GRANT EXECUTE ON FUNCTION public.balance_refresh_daily_limit() TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_balance_refresh() TO authenticated;
GRANT EXECUTE ON FUNCTION public.balance_refresh_status() TO authenticated;

-- Schreibrechte des Nutzers auf den Zähler zurücknehmen. Lesen bleibt: die
-- eigene Zahl verrät nichts, was der Nutzer nicht ohnehin weiß, und die
-- Tabelle behält damit die von src/security/supabase-rls.security.test.ts
-- geforderte Policy.
DO $$
BEGIN
  IF to_regclass('public.balance_refresh_limits') IS NOT NULL THEN
    ALTER TABLE public.balance_refresh_limits ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "balance_refresh_limits_insert_policy" ON public.balance_refresh_limits;
    DROP POLICY IF EXISTS "balance_refresh_limits_update_policy" ON public.balance_refresh_limits;
    DROP POLICY IF EXISTS "balance_refresh_limits_upsert_policy" ON public.balance_refresh_limits;

    DROP POLICY IF EXISTS "balance_refresh_limits_select_policy" ON public.balance_refresh_limits;
    CREATE POLICY "balance_refresh_limits_select_policy" ON public.balance_refresh_limits
      FOR SELECT TO authenticated USING (auth.uid() = user_id);
  END IF;
END $$;

-- Defense in Depth: RLS ohne passende Policy verbietet den Schreibzugriff
-- bereits, der entzogene Grant macht ihn zusätzlich auf Tabellenebene
-- unmöglich — auch dann, wenn jemand später eine zu breite Policy ergänzt.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.balance_refresh_limits FROM anon, authenticated;
