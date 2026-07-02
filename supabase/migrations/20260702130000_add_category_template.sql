-- Globales Kategorien-Template (Weg B): erlaubt, neue Kategorien/Filterwörter
-- ohne App-Release an bestehende Nutzer auszurollen. Der Client wendet die
-- höchste Version additiv lokal an (respektiert Nutzer-Overrides) und merkt
-- sich die zuletzt angewandte Version.
--
-- Read-only für alle (anon + authenticated); Schreibzugriff NUR serverseitig
-- (Dashboard/CI via service_role, umgeht RLS). So kannst du neue Versionen
-- einspielen, ohne dass Clients die Vorlage verändern können.

CREATE TABLE IF NOT EXISTS public.category_template (
  version integer PRIMARY KEY,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.category_template ENABLE ROW LEVEL SECURITY;

-- Nur Lesen erlaubt; kein INSERT/UPDATE/DELETE für Clients.
CREATE POLICY "category_template_read" ON public.category_template
  FOR SELECT TO anon, authenticated USING (true);

COMMENT ON TABLE public.category_template IS
  'Globale, additive Kategorien-Vorlage (Weg B). payload = { "categories": Category[] } im Schema von DEFAULT_LOCAL_CATEGORIES; version monoton steigend.';
