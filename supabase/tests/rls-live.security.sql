-- ============================================================================
-- RLS-Live-Harness (dokumentierter Folgepunkt aus docs/qualitaet-2026-08/
-- plan.md, WP 3.4 - Issue #298): Zwei-Nutzer-Integrationstest gegen eine
-- ECHTE Instanz mit eingespielten Migrationen.
--
-- Der statische Waechter (src/security/supabase-rls.security.test.ts) liest
-- nur den Quelltext der Migrationen. Dieser Harness beweist dagegen auf der
-- laufenden Datenbank, dass Nutzer B die Daten von Nutzer A auf keinem Pfad
-- erreicht: lesend, schreibend (UPDATE/DELETE), ueber Fremdschluessel-Insert,
-- ueber den Join-Pfad (portfolio_positions -> portfolios), anonym und per RPC.
--
-- Selbstbeweis (Akzeptanzkriterium 3): der Harness legt zusaetzlich eine
-- absichtlich permissive Tabelle (`rls_harness_evil`, USING (true)) an und
-- verifiziert, dass er sie als Verletzung ERKENNT. Faellt der Beweis aus,
-- ist der Harness blind, nicht die Policies gut.
--
-- Aufruf gegen die lokale Supabase-Stack-Instanz (supabase start):
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
--        -v ON_ERROR_STOP=1 -f supabase/tests/rls-live.security.sql
--
-- Eigenschaften:
--   * Reines SQL, keine pgTAP-Abhaengigkeit (auth.uid() wird ueber
--     request.jwt.claims gesetzt, genau wie PostgREST es tut).
--   * Alles in EINER Transaktion, endet mit ROLLBACK: die Instanz bleibt
--     unveraendert zurueck, auch bei Fehler.
--   * Defensive Skips (Muster wie 20260711160000): Legacy-Tabellen ohne
--     versionierte DDL (accounts, bank_connections) und Tabellen mit
--     Abhaengigkeiten ausserhalb der Migrationen (user_merchant_rules ->
--     categories) werden UEBERSPRUNGEN und im Ergebnis ausgewiesen, nicht
--     stillschweigend als gruen gewertet.
-- ============================================================================

BEGIN;

CREATE TEMP TABLE rls_results (
  check_name text PRIMARY KEY,
  status     text NOT NULL CHECK (status IN ('PASS', 'FAIL', 'SKIP')),
  detail     text
);

CREATE TEMP TABLE rls_state (k text PRIMARY KEY, v text);
INSERT INTO rls_state VALUES
  ('uid_a', gen_random_uuid()::text),
  ('uid_b', gen_random_uuid()::text),
  ('token_hash_a', 'harness-token-hash-a-do-not-match'),
  ('evil_row_note', 'permissive-by-design');

CREATE TEMP TABLE rls_targets (
  tname       text PRIMARY KEY,
  owner_col   text NOT NULL DEFAULT 'user_id',
  seed_sql    text,   -- INSERT als Nutzer A (erwartet: erfolgreich)
  binsert_sql text,   -- INSERT als Nutzer B mit A's user_id (erwartet: 42501)
  seeded      boolean NOT NULL DEFAULT false,
  skip_reason text
);

INSERT INTO rls_targets (tname, seed_sql, binsert_sql) VALUES
 ('portfolios',
  $$INSERT INTO public.portfolios (user_id, name) VALUES ('{UID_A}', 'rls-harness')$$,
  $$INSERT INTO public.portfolios (user_id, name) VALUES ('{UID_A}', 'from-b')$$),
 ('balance_refresh_limits',
  $$INSERT INTO public.balance_refresh_limits (user_id) VALUES ('{UID_A}')$$,
  $$INSERT INTO public.balance_refresh_limits (user_id) VALUES ('{UID_A}')$$),
 ('mcp_aggregate_snapshots',
  $$INSERT INTO public.mcp_aggregate_snapshots (user_id, token_hash, payload) VALUES ('{UID_A}', '{HASH_A}', '{"schema_version":1,"harness":true}'::jsonb)$$,
  $$INSERT INTO public.mcp_aggregate_snapshots (user_id, token_hash, payload) VALUES ('{UID_A}', 'b-hash', '{}'::jsonb)$$),
 ('user_contract_decisions',
  $$INSERT INTO public.user_contract_decisions (user_id, fingerprint) VALUES ('{UID_A}', 'harness-fp')$$,
  $$INSERT INTO public.user_contract_decisions (user_id, fingerprint) VALUES ('{UID_A}', 'b-fp')$$),
 ('user_merchant_rules',
  NULL, -- seed erst nach Dep-Pruefung (categories), unten
  $$INSERT INTO public.user_merchant_rules (user_id, merchant_pattern, category_id) VALUES ('{UID_A}', 'harness%', '00000000-0000-0000-0000-000000000000')$$);

-- ----------------------------------------------------------------------------
-- Hilfsroutine: Ergebnis aufzeichnen
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION pg_temp.h_record(p_name text, p_status text, p_detail text DEFAULT NULL)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO rls_results (check_name, status, detail)
  VALUES (p_name, p_status, left(coalesce(p_detail, ''), 500))
  ON CONFLICT (check_name) DO UPDATE SET status = EXCLUDED.status, detail = EXCLUDED.detail;
$$;

-- Als Nutzer handeln (identisch zu PostgREST: Rolle + JWT-Claims)
CREATE OR REPLACE FUNCTION pg_temp.h_act_as(p_key text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_sub text;
BEGIN
  -- anon bekommt kein sub: auth.uid() liefert dann NULL, wie bei echten
  -- anonymen PostgREST-Requests.
  IF p_key <> 'anon' THEN
    SELECT s.v INTO v_sub FROM rls_state s WHERE s.k = p_key;
  END IF;
  PERFORM set_config(
    'request.jwt.claims',
    CASE
      WHEN v_sub IS NULL THEN '{"role":"anon"}'::jsonb
      ELSE json_build_object('sub', v_sub, 'role', 'authenticated')
    END::text,
    true
  );
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.h_uid(p_key text) RETURNS uuid LANGUAGE sql AS $$
  SELECT v::uuid FROM rls_state WHERE k = p_key;
$$;

-- ----------------------------------------------------------------------------
-- Phase 0: zwei Test-Nutzer in auth.users anlegen (defensiv gegen
-- GoTrue-Schema-Drift: schlaegt das fehl, werden alle Tabellen-Checks SKIPped,
-- statt den Lauf falsch rot oder falsch gruen zu machen).
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  INSERT INTO auth.users
    (instance_id, id, aud, role, email, encrypted_password,
     email_confirmed_at, created_at, updated_at,
     confirmation_token, recovery_token, email_change_token_new, email_change)
  SELECT '00000000-0000-0000-0000-000000000000', s.v::uuid,
         'authenticated', 'authenticated',
         CASE s.k WHEN 'uid_a' THEN 'rls-harness-a@local' ELSE 'rls-harness-b@local' END,
         '', now(), now(), now(), '', '', '', ''
  FROM rls_state s WHERE s.k IN ('uid_a', 'uid_b');
  PERFORM pg_temp.h_record('setup: auth.users seedbar', 'PASS');
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_temp.h_record('setup: auth.users seedbar', 'FAIL', SQLERRM);
END $$;

-- ----------------------------------------------------------------------------
-- Phase 1: Eigentuemer A legt seine Zeilen an - JEDER Seed-Lauf ist selbst
-- ein Test: ein 42501 hier heisst "Eigentuemer darf eigene Zeile nicht
-- schreiben" (FAIL). Fehlende Legacy-Tabelle/Deps => SKIP mit Grund.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  r record; v_t text; v_sql text;
BEGIN
  FOR r IN SELECT * FROM rls_targets LOOP
    v_t := r.tname;
    IF to_regclass(format('public.%I', v_t)) IS NULL THEN
      PERFORM pg_temp.h_record(v_t || ': Tabelle vorhanden', 'SKIP', 'Legacy-DDL nicht versioniert (to_regclass null)');
      CONTINUE;
    END IF;
    PERFORM pg_temp.h_record(v_t || ': Tabelle vorhanden', 'PASS');

    IF v_t = 'user_merchant_rules' THEN
      IF to_regclass('public.categories') IS NULL THEN
        UPDATE rls_targets SET skip_reason = 'FK-Ziel categories gehoert zum Legacy-Schema (fehlt)' WHERE tname = v_t;
        PERFORM pg_temp.h_record(v_t || ': Seed als A', 'SKIP', 'categories fehlt');
        CONTINUE;
      END IF;
      v_sql := replace(r.binsert_sql, '{UID_A}', pg_temp.h_uid('uid_a')::text); -- nutzt festen Dummy-FK, FK-Fehler => SKIP
    ELSE
      v_sql := r.seed_sql;
    END IF;
    v_sql := replace(v_sql, '{UID_A}', pg_temp.h_uid('uid_a')::text);
    v_sql := replace(v_sql, '{HASH_A}', (SELECT v FROM rls_state WHERE k = 'token_hash_a'));

    SET LOCAL ROLE authenticated;
    PERFORM pg_temp.h_act_as('uid_a');
    BEGIN
      EXECUTE v_sql;
      UPDATE rls_targets SET seeded = true WHERE tname = v_t;
      PERFORM pg_temp.h_record(v_t || ': Seed als A', 'PASS');
    EXCEPTION
      WHEN insufficient_privilege THEN
        PERFORM pg_temp.h_record(v_t || ': Seed als A', 'FAIL', '42501: Eigentuemer darf eigene Zeile nicht schreiben');
      WHEN foreign_key_violation THEN
        UPDATE rls_targets SET skip_reason = 'FK-Ziel nicht seedbar' WHERE tname = v_t;
        PERFORM pg_temp.h_record(v_t || ': Seed als A', 'SKIP', 'foreign_key_violation');
      WHEN undefined_table OR undefined_column THEN
        UPDATE rls_targets SET skip_reason = 'Schema-Drift' WHERE tname = v_t;
        PERFORM pg_temp.h_record(v_t || ': Seed als A', 'SKIP', SQLERRM);
    END;
    RESET ROLE;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- Phase 2: Nutzer B greift auf A's Zeilen zu - JEDER Pfad muss leer/sperrend
-- sein. Pro Tabelle: SELECT-COUNT, Self-Update, Delete, Cross-User-Insert.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  r record; n int;
BEGIN
  FOR r IN SELECT * FROM rls_targets WHERE seeded LOOP
    SET LOCAL ROLE authenticated;
    PERFORM pg_temp.h_act_as('uid_b');

    -- 1) Lesen
    EXECUTE format(
      'SELECT count(*) FROM public.%I WHERE %I = $1', r.tname, r.owner_col)
      INTO n USING pg_temp.h_uid('uid_a');
    IF n = 0 THEN PERFORM pg_temp.h_record(r.tname || ': B sieht A nicht (SELECT)', 'PASS');
    ELSE PERFORM pg_temp.h_record(r.tname || ': B sieht A nicht (SELECT)', 'FAIL', format('B sah %s fremde Zeilen', n)); END IF;

    -- 2) Update (Self-Assignment: falls RLS loechrig waere, bliebe der Inhalt trotzdem unveraendert)
    BEGIN
      EXECUTE format(
        'UPDATE public.%I SET %I = %I WHERE %I = $1', r.tname, r.owner_col, r.owner_col, r.owner_col)
        USING pg_temp.h_uid('uid_a');
      GET DIAGNOSTICS n = ROW_COUNT;
      IF n = 0 THEN PERFORM pg_temp.h_record(r.tname || ': B kann A nicht updaten', 'PASS');
      ELSE PERFORM pg_temp.h_record(r.tname || ': B kann A nicht updaten', 'FAIL', format('UPDATE traf %s fremde Zeilen', n)); END IF;
    EXCEPTION WHEN insufficient_privilege THEN
      PERFORM pg_temp.h_record(r.tname || ': B kann A nicht updaten', 'PASS', 'durch Policy abgelehnt');
    END;

    -- 3) Loeschen
    BEGIN
      EXECUTE format('DELETE FROM public.%I WHERE %I = $1', r.tname, r.owner_col)
        USING pg_temp.h_uid('uid_a');
      GET DIAGNOSTICS n = ROW_COUNT;
      IF n = 0 THEN PERFORM pg_temp.h_record(r.tname || ': B kann A nicht loeschen', 'PASS');
      ELSE PERFORM pg_temp.h_record(r.tname || ': B kann A nicht loeschen', 'FAIL', format('DELETE traf %s fremde Zeilen', n)); END IF;
    EXCEPTION WHEN insufficient_privilege THEN
      PERFORM pg_temp.h_record(r.tname || ': B kann A nicht loeschen', 'PASS', 'durch Policy abgelehnt');
    END;

    -- 4) Insert unter A''s Identitaet (WITH CHECK muss zuschlagen).
    --    unique_violation ist hier BEWEIS fuer durchgelassenen Insert: bei
    --    user_id-PK (balance_refresh_limits, mcp_aggregate_snapshots) kollidiert
    --    B's Zeile erst mit A's PK, wenn WITH CHECK sie nicht gestoppt hat.
    BEGIN
      EXECUTE replace(r.binsert_sql, '{UID_A}', pg_temp.h_uid('uid_a')::text);
      PERFORM pg_temp.h_record(r.tname || ': B kann nicht als A inserten', 'FAIL', 'INSERT lief durch');
    EXCEPTION
      WHEN insufficient_privilege THEN
        PERFORM pg_temp.h_record(r.tname || ': B kann nicht als A inserten', 'PASS');
      WHEN unique_violation THEN
        PERFORM pg_temp.h_record(r.tname || ': B kann nicht als A inserten', 'FAIL', 'nur am PK gescheitert: WITH CHECK liess fremde user_id durch');
      WHEN foreign_key_violation THEN
        PERFORM pg_temp.h_record(r.tname || ': B kann nicht als A inserten', 'SKIP', 'an FK gescheitert, Aussage kraftlos');
    END;

    RESET ROLE;
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- Phase 3: Join-Pfad portfolio_positions -> portfolios (EXISTS-Subquery-Policy)
-- ----------------------------------------------------------------------------
DO $$
DECLARE v_pid uuid; n int;
BEGIN
  SELECT id INTO v_pid FROM public.portfolios WHERE user_id = pg_temp.h_uid('uid_a') LIMIT 1;
  IF v_pid IS NULL THEN
    PERFORM pg_temp.h_record('join: portfolio_positions', 'SKIP', 'kein Portfolio von A vorhanden');
    RETURN;
  END IF;

  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.h_act_as('uid_b');

  SELECT count(*) INTO n
  FROM public.portfolio_positions pp
  JOIN public.portfolios f ON f.id = pp.portfolio_id
  WHERE f.user_id = pg_temp.h_uid('uid_a');
  IF n = 0 THEN PERFORM pg_temp.h_record('join: B sieht A''s Positionen nicht', 'PASS');
  ELSE PERFORM pg_temp.h_record('join: B sieht A''s Positionen nicht', 'FAIL', n::text || ' Positionen sichtbar'); END IF;

  BEGIN
    INSERT INTO public.portfolio_positions (portfolio_id, symbol, quantity, entry_price)
    VALUES (v_pid, 'HACK', 1, 1);
    PERFORM pg_temp.h_record('join: B kann nicht in A''s Portfolio inserten', 'FAIL', 'INSERT lief durch');
  EXCEPTION WHEN insufficient_privilege THEN
    PERFORM pg_temp.h_record('join: B kann nicht in A''s Portfolio inserten', 'PASS');
  END;
  RESET ROLE;
END $$;

-- ----------------------------------------------------------------------------
-- Phase 4: Anonym & RPC
--   * anon hat KEINE Policy auf den Nutzertabellen -> default deny
--   * get_mcp_snapshot(p_token_hash) ist token-gegatet: falscher Hash -> leer
-- ----------------------------------------------------------------------------
DO $$
DECLARE n int; v_payload jsonb;
BEGIN
  SET LOCAL ROLE anon;
  PERFORM pg_temp.h_act_as('anon');

  SELECT count(*) INTO n FROM public.mcp_aggregate_snapshots;
  IF n = 0 THEN PERFORM pg_temp.h_record('anon: mcp_aggregate_snapshots leer', 'PASS');
  ELSE PERFORM pg_temp.h_record('anon: mcp_aggregate_snapshots leer', 'FAIL', 'anon las Zeilen ohne Policy'); END IF;

  BEGIN
    SELECT public.get_mcp_snapshot((SELECT v FROM rls_state WHERE k = 'token_hash_a')) INTO v_payload;
    IF v_payload IS NULL THEN PERFORM pg_temp.h_record('rpc: get_mcp_snapshot ohne Token leer', 'PASS');
    ELSE PERFORM pg_temp.h_record('rpc: get_mcp_snapshot ohne Token leer', 'FAIL', 'Snapshot ohne gueltiges Token geliefert'); END IF;
  EXCEPTION WHEN undefined_table OR undefined_function OR insufficient_privilege THEN
    PERFORM pg_temp.h_record('rpc: get_mcp_snapshot ohne Token leer', 'SKIP', 'RPC nicht erreichbar: ' || SQLERRM);
  END;

  RESET ROLE;
END $$;

-- ----------------------------------------------------------------------------
-- Phase 5: Selbstbeweis - permissive Tabelle WIRD erkannt (sonst ist der
-- Harness wertlos). Akzeptanzkriterium 3, bei jedem Lauf mitbewiesen.
-- ----------------------------------------------------------------------------
DO $$
DECLARE n int;
BEGIN
  CREATE TABLE public.rls_harness_evil (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    note text
  );
  ALTER TABLE public.rls_harness_evil ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "harness_evil_permissive" ON public.rls_harness_evil
    FOR ALL USING (true) WITH CHECK (true);

  SET LOCAL ROLE authenticated;
  PERFORM pg_temp.h_act_as('uid_a');
  INSERT INTO public.rls_harness_evil (user_id, note) VALUES (pg_temp.h_uid('uid_a'), 'permissive-by-design');
  PERFORM pg_temp.h_act_as('uid_b');
  SELECT count(*) INTO n FROM public.rls_harness_evil;
  RESET ROLE;

  IF n > 0 THEN
    PERFORM pg_temp.h_record('selbsttest: permissive Policy wird erkannt', 'PASS',
      'B sah die USING(true)-Zeile - Harness haette angeschlagen');
  ELSE
    PERFORM pg_temp.h_record('selbsttest: permissive Policy wird erkannt', 'FAIL',
      'Harness blind: USING(true)-Zeile fuer B unsichtbar');
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- Urteil: FAILs brechen psql (ON_ERROR_STOP + Exception) => CI rot. SKIPs
-- werden sichtbar ausgegeben, zaehlen aber NICHT als Gruen-Beleg.
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_fails int; v_skips int; v_line text;
BEGIN
  SELECT count(*) FILTER (WHERE status = 'FAIL'),
         count(*) FILTER (WHERE status = 'SKIP')
    INTO v_fails, v_skips FROM rls_results;

  FOR v_line IN SELECT check_name || ' [' || status || '] ' || coalesce(detail, '')
                 FROM rls_results WHERE status <> 'PASS' ORDER BY check_name LOOP
    RAISE NOTICE '%', v_line;
  END LOOP;

  RAISE NOTICE 'RLS-Live-Harness: % Checks, % FAIL, % SKIP',
    (SELECT count(*) FROM rls_results), v_fails, v_skips;

  IF v_fails > 0 THEN
    RAISE EXCEPTION 'RLS LIVE TEST GESCHEITERT: % Pruefpunkt(e) rot (siehe NOTICE-Liste)', v_fails
      USING HINT = 'Nutzer B erreichte Daten von Nutzer A - Policy-Luecke, siehe rls_results';
  END IF;
END $$;

ROLLBACK;
