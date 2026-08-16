import { Pool } from "pg";
import type { Entitlement, EntitlementSource } from "../domain/entitlement.js";
import type { EntitlementRepository, ProcessedEventStore } from "../ports.js";

/** Einziger Ort, an dem die Verbindungszeichenfolge gelesen wird. */
export function createPool(connectionString: string): Pool {
  return new Pool({ connectionString, max: 10 });
}

export function postgresEntitlementRepository(pool: Pool): EntitlementRepository {
  return {
    async find(userId) {
      const { rows } = await pool.query(
        `SELECT user_id, product, valid_until, source, mollie_customer_id, mollie_subscription_id
           FROM entitlements
          WHERE user_id = $1
          ORDER BY valid_until DESC
          LIMIT 1`,
        [userId],
      );
      const zeile = rows[0];
      if (!zeile) return null;
      return {
        userId: zeile.user_id as string,
        product: zeile.product as string,
        validUntil: new Date(zeile.valid_until as string),
        source: zeile.source as EntitlementSource,
        mollieCustomerId: (zeile.mollie_customer_id as string | null) ?? undefined,
        mollieSubscriptionId: (zeile.mollie_subscription_id as string | null) ?? undefined,
      } satisfies Entitlement;
    },

    async upsert(entitlement) {
      await pool.query(
        `INSERT INTO entitlements
           (user_id, product, valid_until, source, mollie_customer_id, mollie_subscription_id, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, now())
         ON CONFLICT (user_id, product) DO UPDATE
           SET valid_until            = EXCLUDED.valid_until,
               source                 = EXCLUDED.source,
               mollie_customer_id     = COALESCE(EXCLUDED.mollie_customer_id, entitlements.mollie_customer_id),
               mollie_subscription_id = COALESCE(EXCLUDED.mollie_subscription_id, entitlements.mollie_subscription_id),
               updated_at             = now()`,
        [
          entitlement.userId,
          entitlement.product,
          entitlement.validUntil.toISOString(),
          entitlement.source,
          entitlement.mollieCustomerId ?? null,
          entitlement.mollieSubscriptionId ?? null,
        ],
      );
    },
  };
}

export function postgresProcessedEvents(pool: Pool): ProcessedEventStore {
  return {
    async seen(paymentId, status) {
      const { rowCount } = await pool.query(
        `SELECT 1 FROM processed_events WHERE payment_id = $1 AND status = $2`,
        [paymentId, status],
      );
      return (rowCount ?? 0) > 0;
    },

    async remember(paymentId, status) {
      // ON CONFLICT DO NOTHING statt einer Vorab-Pruefung: Zwei gleichzeitige
      // Zustellungen derselben Zahlung wuerden sonst beide an der Pruefung
      // vorbeikommen. Der Primaerschluessel entscheidet, nicht die Reihenfolge.
      await pool.query(
        `INSERT INTO processed_events (payment_id, status)
         VALUES ($1, $2)
         ON CONFLICT (payment_id, status) DO NOTHING`,
        [paymentId, status],
      );
    },
  };
}
