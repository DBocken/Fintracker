import { gocardlessService } from './gocardless-service'
import { bankConnectionService } from './bank-connection-service'
import { t } from '../i18n/serviceT'
import type { Account } from '@/types'

export type LiveBalance = {
  amount: number;
  balanceType?: "interimAvailable" | "interimBooked" | "closingBooked";
  currency?: string;
  /**
   * Der Tag, auf den sich der Saldo bezieht (`referenceDate` der Bank).
   *
   * Ohne ihn ist ein Saldo keine verwertbare Auskunft, sondern nur eine Zahl:
   * Erst der Stichtag sagt, welche Buchungen bereits in ihm stecken und welche
   * noch draufkommen. Genau daran hing der Fehler, dass ein einmal gesetzter
   * Kontostand nie wieder mitwuchs.
   */
  referenceDate?: string;
}

type GoCardlessBalance = {
  balanceAmount: { amount: string; currency: string }
  balanceType: "interimAvailable" | "interimBooked" | "closingBooked"
  referenceDate?: string
  lastChangeDateTime?: string
}

type GoCardlessAccountWithBalances = {
  id: string
  currency: string
  balances?: GoCardlessBalance[]
}

function normalizeBalanceType(t: string | undefined): string {
  return (t || '').trim()
}

export function pickPreferredBankBalance(balances: GoCardlessBalance[] | undefined): GoCardlessBalance | null {
  if (!balances || balances.length === 0) return null

  const byType = (type: string) => balances.find((b) => normalizeBalanceType(b.balanceType) === type)

  // Per requirement: closingBooked is the real value shown in the bank app.
  return (
    byType('closingBooked') ||
    byType('interimAvailable') ||
    byType('interimBooked') ||
    byType('expected') ||
    balances[0]
  )
}

async function getRequisitionIdByBankConnectionId(): Promise<Record<string, string>> {
  const connections = await bankConnectionService.getBankConnections()
  const map: Record<string, string> = {}
  for (const c of connections) {
    if (c?.id && c?.requisition_id) map[c.id] = c.requisition_id
  }
  return map
}

/**
 * Fetch latest bank balances (not persisted) for the provided accounts.
 * Returns map: localAccountId -> preferred balance (closingBooked first).
 */
export async function getLiveBalancesForAccounts(accounts: Account[]): Promise<Record<string, LiveBalance>> {
  const hasAnyBank = accounts.some((a) => a.gocardless_account_id)
  if (!hasAnyBank) return {}

  // Some older accounts may miss gocardless_requisition_id; derive it from bank_connection_id.
  const reqByBankConnectionId = await getRequisitionIdByBankConnectionId()

  const withBank = accounts
    .map((a) => {
      const requisitionId =
        (a.gocardless_requisition_id as string | null | undefined) ||
        (a.bank_connection_id ? reqByBankConnectionId[a.bank_connection_id] : undefined)

      return {
        account: a,
        requisitionId,
      }
    })
    .filter((x) => !!x.account.gocardless_account_id && !!x.requisitionId)

  if (withBank.length === 0) return {}

  const byReq = new Map<string, Account[]>()
  for (const { account, requisitionId } of withBank) {
    byReq.set(requisitionId as string, [...(byReq.get(requisitionId as string) || []), account])
  }

  // Fetch accounts (incl. balances) per requisition.
  const reqIds = Array.from(byReq.keys())
  const fetched = await Promise.all(
    reqIds.map(async (reqId) => {
      const res = await gocardlessService.getAccounts(reqId)
      return { reqId, accounts: (res.accounts || []) as GoCardlessAccountWithBalances[] }
    }),
  )

  const balancesByGoCardlessAccountId = new Map<string, LiveBalance>()
  for (const block of fetched) {
    for (const acct of block.accounts) {
      const preferred = pickPreferredBankBalance(acct.balances)
      if (!preferred) continue

      const amount = parseFloat(preferred.balanceAmount.amount)
      if (!Number.isFinite(amount)) continue

      balancesByGoCardlessAccountId.set(acct.id, {
        amount,
        currency: preferred.balanceAmount.currency || acct.currency || 'EUR',
        balanceType: preferred.balanceType,
        referenceDate: preferred.referenceDate || preferred.lastChangeDateTime,
      })
    }
  }

  const out: Record<string, LiveBalance> = {}
  for (const { account } of withBank) {
    const gcId = account.gocardless_account_id as string
    const live = balancesByGoCardlessAccountId.get(gcId)
    if (live) out[account.id] = live
  }

  return out
}

/**
 * Bank-Saldo EINES Kontos — die Einzelfall-Fassung von
 * `getLiveBalancesForAccounts`, damit der Transaktions-Sync den echten
 * Kontostand mitnehmen kann, ohne die Auswahl-Logik ein zweites Mal zu bauen.
 */
export async function getBankBalanceForAccount(account: Account): Promise<LiveBalance | null> {
  const balances = await getLiveBalancesForAccounts([account])
  return balances[account.id] ?? null
}

export type RefreshMode = "automatic" | "manual";

export interface RefreshBalancesResponse {
  success: boolean;
  message: string;
  remaining_today?: number;
  mode?: RefreshMode;
  error?: string;
}

/**
 * Call refresh-balances Edge Function to update live balances.
 * Automatic mode: once per day (manual updates allowed up to 4x/day).
 * Manual mode: up to 4x per day.
 */
export async function refreshBalances(
  mode: RefreshMode = "manual"
): Promise<RefreshBalancesResponse> {
  const { getAccessToken } = await import("./auth-service");

  const token = await getAccessToken();

  if (!token) {
    return {
      success: false,
      message: t("liveBalance.notAuthenticated"),
      error: "unauthenticated",
    };
  }
  const url = "https://pbopyawkxxrluhofjtub.supabase.co/functions/v1/refresh-balances";

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mode }),
    });

    const data = await res.json() as RefreshBalancesResponse;

    if (res.status === 409 && data.error === "automatic_already_done") {
      return {
        success: true,
        message: t("liveBalance.automaticAlreadyDone"),
        mode: "automatic",
        error: "automatic_already_done",
      };
    }

    if (res.status === 429) {

      return {
        success: false,
        message: data.message || t("liveBalance.rateLimitExceeded"),
        error: "rate_limit_exceeded",
        remaining_today: data.remaining_today ?? 0,
        mode,
      };
    }

    if (!res.ok) {
      return {
        success: false,
        message: data.message || t("liveBalance.refreshFailed"),
        error: data.error || "unknown",
        mode,
      };
    }

    return {
      success: true,
      message: data.message || t("liveBalance.refreshSuccess"),
      remaining_today: data.remaining_today,
      mode: data.mode || mode,
    };
  } catch (err) {
    console.error("Error calling refresh-balances function:", err);
    return {
      success: false,
      message: t("liveBalance.networkError"),
      error: "network_error",
      mode,
    };
  }
}