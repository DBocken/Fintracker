import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = (origin: string | null): HeadersInit => {
  const allowed = (Deno.env.get("ALLOWED_ORIGINS") || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const defaultAllowed = ["https://fintracker-phi.vercel.app"];

  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };

  if (!origin) {
    headers["Access-Control-Allow-Origin"] = allowed[0] || defaultAllowed[0];
    return headers;
  }

  const hostname = new URL(origin).hostname.toLowerCase();
  if (allowed.includes(origin) || defaultAllowed.includes(origin) || hostname.endsWith(".vercel.app")) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
};

function log(message: string, data?: unknown) {
  if (data === undefined) {
    console.log(`[refresh-balances] ${message}`);
  } else {
    console.log(`[refresh-balances] ${message}`, data);
  }
}

function logError(message: string, data?: unknown) {
  if (data === undefined) {
    console.error(`[refresh-balances] ${message}`);
  } else {
    console.error(`[refresh-balances] ${message}`, data);
  }
}

interface BalanceRefreshLimit {
  user_id: string;
  last_refresh_date: string;
  daily_count: number;
  updated_at: string;
}

interface AccountRow {
  id: string;
  user_id: string;
  gocardless_account_id: string | null;
  gocardless_requisition_id: string | null;
  bank_connection_id: string | null;
  sync_enabled: boolean | null;
}

interface BankConnectionRow {
  id: string;
  requisition_id: string | null;
}

interface GoCardlessBalance {
  balanceAmount: {
    amount: string;
    currency: string;
  };
  balanceType: string;
}

interface GoCardlessAccount {
  id: string;
  currency?: string;
  balances?: GoCardlessBalance[];
}

interface GoCardlessAccountsResponse {
  accounts?: GoCardlessAccount[];
  error?: string;
}

const MAX_DAILY_REFRESHES = 1;

type RefreshMode = "automatic" | "manual";

function jsonResponse(origin: string | null, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

function pickPreferredBalance(balances: GoCardlessBalance[] | undefined): GoCardlessBalance | null {
  if (!balances || balances.length === 0) return null;

  const byType = (type: string) => balances.find((entry) => (entry.balanceType || "").trim() === type);

  return (
    byType("closingBooked") ||
    byType("interimAvailable") ||
    byType("interimBooked") ||
    byType("expected") ||
    balances[0]
  );
}

serve(async (req) => {
  const origin = req.headers.get("Origin");
  const authHeader = req.headers.get("Authorization");
  const refreshMode = ((await req.json().catch(() => ({})))?.mode || "manual") as RefreshMode;

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(origin) });
  }

  if (!authHeader) {
    return jsonResponse(origin, 401, {
      success: false,
      error: "unauthenticated",
      message: "Nicht angemeldet.",
    });
  }

  const token = authHeader.replace("Bearer ", "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const {
    data: { user },
    error: userError,
  } = await supabaseClient.auth.getUser();

  if (userError || !user) {
    logError("Auth error", userError);
    return jsonResponse(origin, 401, {
      success: false,
      error: "invalid_token",
      message: "Sitzung ungültig.",
    });
  }

  const userId = user.id;
  const today = new Date().toISOString().split("T")[0];

  const { data: limitRow, error: limitError } = await supabaseClient
    .from("balance_refresh_limits")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (limitError && limitError.code !== "PGRST116") {
    logError("Error fetching limit row", limitError);
    return jsonResponse(origin, 500, {
      success: false,
      error: "db_error",
      message: "Datenbankfehler.",
    });
  }

  const currentCount = limitRow && (limitRow as BalanceRefreshLimit).last_refresh_date === today
    ? (limitRow as BalanceRefreshLimit).daily_count || 0
    : 0;

  if (currentCount >= MAX_DAILY_REFRESHES) {
    return jsonResponse(origin, 429, {
      success: false,
      error: "rate_limit_exceeded",
      mode: refreshMode,
      remaining_today: 0,
      message: "Kontostände wurden heute bereits aktualisiert. Bitte morgen erneut versuchen.",
    });
  }

  const { data: accountsData, error: accountsError } = await supabaseClient
    .from("accounts")
    .select("id, user_id, gocardless_account_id, gocardless_requisition_id, bank_connection_id, sync_enabled")
    .eq("user_id", userId)
    .not("gocardless_account_id", "is", null);

  if (accountsError) {
    logError("Error loading accounts", accountsError);
    return jsonResponse(origin, 500, {
      success: false,
      error: "db_error",
      message: "Konten konnten nicht geladen werden.",
    });
  }

  const accounts = (accountsData || []) as AccountRow[];
  if (accounts.length === 0) {
    return jsonResponse(origin, 200, {
      success: true,
      mode: refreshMode,
      remaining_today: MAX_DAILY_REFRESHES - currentCount,
      updated_accounts: 0,
      message: "Keine verbundenen Bankkonten gefunden.",
    });
  }

  const { data: connectionsData, error: connectionsError } = await supabaseClient
    .from("bank_connections")
    .select("id, requisition_id")
    .eq("user_id", userId);

  if (connectionsError) {
    logError("Error loading bank connections", connectionsError);
    return jsonResponse(origin, 500, {
      success: false,
      error: "db_error",
      message: "Bankverbindungen konnten nicht geladen werden.",
    });
  }

  const requisitionByConnectionId = new Map<string, string>();
  for (const connection of (connectionsData || []) as BankConnectionRow[]) {
    if (connection.id && connection.requisition_id) {
      requisitionByConnectionId.set(connection.id, connection.requisition_id);
    }
  }

  const groupedByRequisition = new Map<string, AccountRow[]>();
  for (const account of accounts) {
    if (account.sync_enabled === false) continue;

    const requisitionId =
      account.gocardless_requisition_id ||
      (account.bank_connection_id ? requisitionByConnectionId.get(account.bank_connection_id) : undefined);

    if (!requisitionId) continue;

    groupedByRequisition.set(requisitionId, [...(groupedByRequisition.get(requisitionId) || []), account]);
  }

  if (groupedByRequisition.size === 0) {
    return jsonResponse(origin, 200, {
      success: true,
      mode: refreshMode,
      remaining_today: MAX_DAILY_REFRESHES - currentCount,
      updated_accounts: 0,
      message: "Keine aktiv synchronisierten Bankkonten gefunden.",
    });
  }

  const syncUrl = `${supabaseUrl}/functions/v1/gocardless-sync`;
  const fetchedBalances = new Map<string, { amount: number; currency: string; balanceType: string }>();
  const errors: string[] = [];

  for (const requisitionId of groupedByRequisition.keys()) {
    try {
      const syncResponse = await fetch(syncUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "get-accounts",
          requisition_id: requisitionId,
        }),
      });

      const payload = await syncResponse.json().catch(() => ({})) as GoCardlessAccountsResponse;

      if (!syncResponse.ok) {
        const message = payload?.error || `HTTP ${syncResponse.status}`;
        errors.push(`${requisitionId}: ${message}`);
        logError("GoCardless get-accounts failed", { requisitionId, status: syncResponse.status, message });
        continue;
      }

      for (const account of payload.accounts || []) {
        const preferred = pickPreferredBalance(account.balances);
        if (!preferred) continue;

        const amount = Number(preferred.balanceAmount.amount);
        if (!Number.isFinite(amount)) continue;

        fetchedBalances.set(account.id, {
          amount,
          currency: preferred.balanceAmount.currency || account.currency || "EUR",
          balanceType: preferred.balanceType || "closingBooked",
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error";
      errors.push(`${requisitionId}: ${message}`);
      logError("Unhandled GoCardless fetch error", { requisitionId, error: message });
    }
  }

  let updatedAccounts = 0;
  const nowIso = new Date().toISOString();

  for (const account of accounts) {
    if (!account.gocardless_account_id) continue;

    const liveBalance = fetchedBalances.get(account.gocardless_account_id);
    if (!liveBalance) continue;

    const { error: updateError } = await supabaseClient
      .from("accounts")
      .update({
        live_balance_amount: liveBalance.amount,
        live_balance_currency: liveBalance.currency,
        live_balance_type: liveBalance.balanceType,
        live_balance_updated_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", account.id)
      .eq("user_id", userId);

    if (updateError) {
      errors.push(`${account.id}: ${updateError.message}`);
      logError("Failed to persist account balance", { accountId: account.id, error: updateError.message });
      continue;
    }

    updatedAccounts += 1;
  }

  const nextCount = currentCount + 1;
  let limitWriteError = null;

  if (!limitRow) {
    const { error } = await supabaseClient.from("balance_refresh_limits").insert({
      user_id: userId,
      last_refresh_date: today,
      daily_count: nextCount,
    });
    limitWriteError = error;
  } else {
    const { error } = await supabaseClient
      .from("balance_refresh_limits")
      .update({
        last_refresh_date: today,
        daily_count: nextCount,
        updated_at: nowIso,
      })
      .eq("user_id", userId);
    limitWriteError = error;
  }

  if (limitWriteError) {
    logError("Failed to store refresh limit", limitWriteError);
    return jsonResponse(origin, 500, {
      success: false,
      error: "db_error",
      message: "Aktualisierung wurde durchgeführt, aber das Tageslimit konnte nicht gespeichert werden.",
    });
  }

  const remaining = Math.max(0, MAX_DAILY_REFRESHES - nextCount);
  const message = updatedAccounts > 0
    ? `Kontostände aktualisiert (${updatedAccounts} Konto${updatedAccounts === 1 ? "" : "en"}).`
    : errors.length > 0
      ? "Es konnten heute keine Kontostände aktualisiert werden."
      : "Keine neuen Kontostände verfügbar.";

  log("Refresh finished", { userId, updatedAccounts, errorsCount: errors.length, refreshMode });

  return jsonResponse(origin, 200, {
    success: updatedAccounts > 0 || errors.length === 0,
    message,
    mode: refreshMode,
    updated_accounts: updatedAccounts,
    remaining_today: remaining,
    errors,
  });
});
