-- WP 6.2 — Berechtigungen und Ereignis-Dedupe.
--
-- Was hier NICHT steht, ist Teil der Zusage: keine Kartendaten, kein Betrag,
-- keine Adresse, kein Zahlungsverlauf. Der Dienst haelt Statusfakten; die
-- Zahlungsdaten liegen bei Mollie und nur dort.

CREATE TABLE IF NOT EXISTS entitlements (
  -- Die INTERNE userId (WP 2.1), nicht das Subject des Identitaetsanbieters.
  -- Daran haengt die Zusage aus WP 7.2: Subject-Wechsel ohne userId-Wechsel.
  user_id                TEXT        NOT NULL,
  product                TEXT        NOT NULL,
  -- Ende der Berechtigung INKLUSIVE Kulanzfrist (siehe domain/entitlement.ts).
  valid_until            TIMESTAMPTZ NOT NULL,
  source                 TEXT        NOT NULL CHECK (source IN ('mollie', 'promo', 'admin')),
  mollie_customer_id     TEXT,
  mollie_subscription_id TEXT,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product)
);

-- Idempotenz des Webhooks. Der Schluessel ist (payment_id, status), nicht die
-- payment_id allein: Eine Zahlung durchlaeuft mehrere Zustaende, und jeder
-- loest einen eigenen Webhook aus. Nur die Wiederholung DERSELBEN Kombination
-- ist eine Dublette.
CREATE TABLE IF NOT EXISTS processed_events (
  payment_id   TEXT        NOT NULL,
  status       TEXT        NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (payment_id, status)
);
