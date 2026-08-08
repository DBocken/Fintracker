import type { z } from 'zod';
import { transactionSchema } from './transaction.schema';
import { accountSchema } from './account.schema';
import { debtSchema } from './debt.schema';
import { receivableSchema } from './receivable.schema';
import { budgetSchema } from './budget.schema';

/**
 * Schema-Registry für die lokalen Finanz-Collections (WP 1.2, RES-2/DOM-2).
 * `readLocalFinanceList` (`src/services/local-finance-store.ts`) schlägt hier
 * je Collection nach: **Schema vorhanden ⇒ jedes Item wird validiert, kaputte
 * werden übersprungen und gezählt (`src/services/data-integrity-report.ts`);
 * kein Schema ⇒ die Collection läuft unverändert durch** (Ratsche statt
 * Alles-oder-nichts — 30 Collections auf einmal wäre ein Paket, das nie
 * fertig wird).
 *
 * **Schichtgrenze:** `src/lib/` darf laut `pnpm check:layers`
 * (Regel `lib-rein`) nichts aus `src/services/` importieren — der eigentliche
 * Schlüssel-Typ `LocalFinanceKey` lebt aber in
 * `src/services/local-storage-keys.ts`. Deshalb definiert diese Datei einen
 * EIGENEN, unabhängigen Literal-Union-Typ `CollectionSchemaKey` statt ihn von
 * dort zu importieren. Die Kopplung (die Strings müssen mit den Werten aus
 * `LOCAL_FINANCE_KEYS` übereinstimmen) ist nicht über den Compiler, sondern
 * über `src/lib/schemas/__tests__/collection-schemas.test.ts` abgesichert,
 * das beide Listen gegeneinander prüft.
 *
 * Der Aufrufer in `src/services/` (eine Schicht über `lib`, darf `lib`
 * benutzen) verengt beim Nachschlagen `LocalFinanceKey` (30 Werte) auf
 * `CollectionSchemaKey` (die hier abgedeckte Teilmenge) — das ist eine
 * zulässige Sub-Set-Type-Assertion, keine Layer-Verletzung.
 *
 * **Ratsche:** die Zahl der abgedeckten Collections darf nur STEIGEN (Test
 * `collection-schemas.test.ts`), analog zu `view-data-budget.json`.
 * Startwert dieses Pakets: 5 (`transactions`, `accounts`, `debts`,
 * `receivables`, `budgets` — die sieben aus dem Audit minus `categories`
 * und `settings`, die nicht ohne Umbau von `local-settings-service.ts`
 * gehen, siehe dortige Begründung im WP-Bericht).
 */
export type CollectionSchemaKey = 'transactions' | 'accounts' | 'debts' | 'receivables' | 'budgets';

export const COLLECTION_SCHEMAS: Partial<Record<CollectionSchemaKey, z.ZodType>> = {
  transactions: transactionSchema,
  accounts: accountSchema,
  debts: debtSchema,
  receivables: receivableSchema,
  budgets: budgetSchema,
};

/** Anzahl der aktuell abgedeckten Collections — Basis der Ratsche. */
export const COVERED_COLLECTION_COUNT = Object.keys(COLLECTION_SCHEMAS).length;
