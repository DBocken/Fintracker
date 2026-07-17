// Ownership-Checks für gocardless-sync, bewusst ausgelagert (keine Deno-/
// Remote-URL-Imports) damit sie per Vitest direkt getestet werden können —
// siehe __tests__/ownership.test.ts. Diese Datei ist die EINZIGE Stelle, die
// prüft, ob eine requisition/ein account dem anfragenden Nutzer gehört.
// Grund für die Zentralisierung: get-balances hatte früher keinen eigenen
// Account-Check, während get-transactions einen hatte (Konsistenz-Bug, siehe
// Git-Historie) — Duplikation der Prüfung pro Action war die Ursache.

export interface RequisitionOwnership {
  id: string;
  reference?: string;
  accounts?: string[];
}

export interface SupabaseOwnershipQueryClient {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        or(filter: string): {
          limit(count: number): PromiseLike<{ data: unknown[] | null; error: unknown }>;
        };
      };
    };
  };
}

function forbidden(): Error & { status: number } {
  const err = new Error("Forbidden") as Error & { status: number };
  err.status = 403;
  return err;
}

// Fremde Requisition antwortet identisch zur nicht existierenden (404 statt
// 403): sonst könnte ein Angreifer über den Statuscode-Unterschied testen,
// welche geratenen requisition-IDs existieren (Existenz-Orakel).
function requisitionNotFound(): Error & { status: number } {
  const err = new Error("Requisition not found") as Error & { status: number };
  err.status = 404;
  return err;
}

export async function assertRequisitionBoundToUser(
  supabaseClient: SupabaseOwnershipQueryClient,
  requisition: RequisitionOwnership,
  userId: string,
  lookupKey?: string,
): Promise<void> {
  if (requisition.reference === userId || requisition.reference?.startsWith(`${userId}:`)) {
    return;
  }

  let query = supabaseClient
    .from("bank_connections")
    .select("id")
    .eq("user_id", userId)
    .or(`requisition_id.eq.${requisition.id},reference.eq.${requisition.id}`)
    .limit(1);

  if (lookupKey && lookupKey !== requisition.id) {
    query = supabaseClient
      .from("bank_connections")
      .select("id")
      .eq("user_id", userId)
      .or(`requisition_id.eq.${requisition.id},reference.eq.${requisition.id},requisition_id.eq.${lookupKey},reference.eq.${lookupKey}`)
      .limit(1);
  }

  const { data, error } = await query;
  if (error) throw error;
  if (data && data.length > 0) return;

  throw requisitionNotFound();
}

export function assertAccountBelongsToRequisition(
  requisition: Pick<RequisitionOwnership, "accounts">,
  accountId: string,
): void {
  const allowedAccounts = requisition.accounts || [];
  if (!allowedAccounts.includes(accountId)) {
    throw forbidden();
  }
}
