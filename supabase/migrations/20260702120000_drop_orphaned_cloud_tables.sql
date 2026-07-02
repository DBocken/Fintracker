-- Entfernt Cloud-Tabellen, die durch die Local-first-Umstellung verwaist sind.
--
-- Diese Daten liegen jetzt ausschließlich lokal (IndexedDB, local-finance-store);
-- kein Client- oder Edge-Function-Pfad liest oder schreibt sie noch in Supabase
-- (verifiziert: keine .from()-Aufrufe außer für die behaltenen Tabellen).
--
-- BEHALTEN (weiterhin zur Laufzeit genutzt):
--   accounts, bank_connections            -> Edge gocardless-sync / refresh-balances
--   balance_refresh_limits                -> Edge refresh-balances
--   mcp_aggregate_snapshots (+ RPC)       -> cloud-mcp-sync / api/mcp
--   categories                            -> globale Vorlage (user_id IS NULL),
--                                            wird auf Nutzer ausgerollt und lokal
--                                            überschrieben; NICHT löschen.
--
-- HINWEIS: DROP ist irreversibel. Falls in Produktion noch Altdaten (z. B.
-- Cloud-Portfolios aus der Zeit vor Local-first) in diesen Tabellen liegen,
-- vorher sichern. CASCADE entfernt zugehörige Policies/Indizes/Trigger/FKs.

-- Kind zuerst (FK auf portfolios), dann Eltern.
DROP TABLE IF EXISTS public.portfolio_positions CASCADE;
DROP TABLE IF EXISTS public.portfolios CASCADE;

DROP TABLE IF EXISTS public.user_merchant_rules CASCADE;
DROP TABLE IF EXISTS public.user_contract_decisions CASCADE;
DROP TABLE IF EXISTS public.user_settings CASCADE;

-- Der Trigger update_portfolios/positions_updated_at verschwindet mit den
-- Tabellen. Die Funktion update_updated_at_column() wurde ausschließlich von
-- diesen beiden Tabellen genutzt; sie bleibt bewusst erhalten, um ein
-- versehentliches Fehlschlagen der Migration zu vermeiden, falls in Produktion
-- doch eine out-of-repo-Tabelle daran hängt. Bei Bedarf separat entfernen:
--   DROP FUNCTION IF EXISTS public.update_updated_at_column();
