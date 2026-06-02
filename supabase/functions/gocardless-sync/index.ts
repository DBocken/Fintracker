import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// GoCardless API configuration
const GOCARDLESS_SECRET_ID = Deno.env.get("GOCARDLESS_SECRET_ID") || "";
const GOCARDLESS_SECRET_KEY = Deno.env.get("GOCARDLESS_SECRET_KEY") || "";
const GOCARDLESS_BASE_URL = "https://bankaccountdata.gocardless.com/api/v2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "")
  .split(",")
  .map((s) => normalizeOrigin(s))
  .filter(Boolean) as string[];

const DEFAULT_ALLOWED_ORIGINS = ["https://fintracker-phi.vercel.app"];
const DEFAULT_ALLOWED_ORIGIN_SUFFIXES = ["vercel.app"];
const DEFAULT_ALLOWED_REDIRECT_HOSTS = ["fintracker-phi.vercel.app"];

const ALLOWED_REDIRECT_HOSTS = (Deno.env.get("ALLOWED_REDIRECT_HOSTS") || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const RATE_LIMIT_BURST = Number(Deno.env.get("RATE_LIMIT_BURST") || 20);

const RATE_LIMIT_PER_MIN = Number(Deno.env.get("RATE_LIMIT_PER_MIN") || 60);

function normalizeOrigin(value: string): string {
  const raw = value.trim();
  if (!raw) return "";

  try {
    return new URL(raw).origin;
  } catch {
    return raw;
  }
}

function isDefaultAllowedOrigin(origin: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();

  if (parsed.protocol === "http:" && (hostname === "localhost" || hostname === "127.0.0.1")) {
    return true;
  }

  return (
    parsed.protocol === "https:" &&
    DEFAULT_ALLOWED_ORIGIN_SUFFIXES.some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`))
  );
}

function resolveAllowedOrigin(origin: string | null): string | null {
  if (!origin) {
    return ALLOWED_ORIGINS[0] || DEFAULT_ALLOWED_ORIGINS[0] || null;
  }

  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) return null;

  if (
    ALLOWED_ORIGINS.includes(normalizedOrigin) ||
    DEFAULT_ALLOWED_ORIGINS.includes(normalizedOrigin) ||
    isDefaultAllowedOrigin(normalizedOrigin)
  ) {
    return normalizedOrigin;
  }

  return null;
}

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) {
    return true;
  }

  return resolveAllowedOrigin(origin) !== null;
}

function corsHeaders(origin: string | null): HeadersInit {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };

  const allowedOrigin = resolveAllowedOrigin(origin);
  if (allowedOrigin) {
    headers["Access-Control-Allow-Origin"] = allowedOrigin;
  }

  return headers;
}

function jsonResponse(origin: string | null, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

function checkSecrets(): { valid: boolean; message?: string } {
  if (!GOCARDLESS_SECRET_ID) {
    return {
      valid: false,
      message:
        "GOCARDLESS_SECRET_ID nicht konfiguriert. Bitte in Supabase Dashboard unter Project Settings > Edge Functions hinzufügen.",
    };
  }
  if (!GOCARDLESS_SECRET_KEY) {
    return {
      valid: false,
      message:
        "GOCARDLESS_SECRET_KEY nicht konfiguriert. Bitte in Supabase Dashboard unter Project Settings > Edge Functions hinzufügen.",
    };
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return {
      valid: false,
      message: "SUPABASE_URL / SUPABASE_ANON_KEY nicht konfiguriert.",
    };
  }
  return { valid: true };
}

function validateRedirectUrl(input: string): string {
  const raw = (input || "").trim();
  if (!raw) {
    const err = new Error("redirect_url required") as any;
    err.status = 400;
    throw err;
  }

  if (/[\s\)\[\]]/.test(raw)) {
    const err = new Error(
      `Invalid redirect_url: enthält ungültige Zeichen (Leerzeichen oder Klammern). Bitte nur eine saubere HTTPS-URL ohne Sonderzeichen verwenden: ${raw}`,
    ) as any;
    err.status = 400;
    throw err;
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    const err = new Error(`Invalid redirect_url: keine gültige URL: ${raw}`) as any;
    err.status = 400;
    throw err;
  }

  if (url.protocol !== "https:") {
    const err = new Error(`Invalid redirect_url: muss https:// sein: ${raw}`) as any;
    err.status = 400;
    throw err;
  }

  const hostOk = /^[a-zA-Z0-9.-]+(:\d+)?$/.test(url.host) && !url.hostname.endsWith(".");
  if (!hostOk) {
    const err = new Error(`Invalid redirect_url: ungültiger Host: ${url.host}`) as any;
    err.status = 400;
    throw err;
  }

  const redirectHostAllowed =
    DEFAULT_ALLOWED_REDIRECT_HOSTS.includes(url.host) ||
    ALLOWED_REDIRECT_HOSTS.length === 0 ||
    ALLOWED_REDIRECT_HOSTS.includes(url.host);

  if (!redirectHostAllowed) {
    const allowedHosts = [...DEFAULT_ALLOWED_REDIRECT_HOSTS, ...ALLOWED_REDIRECT_HOSTS];
    const err = new Error(
      `Invalid redirect_url: Host nicht erlaubt. Bitte einen erlaubten Host verwenden (${allowedHosts.join(", ")}): ${url.host}`,
    ) as any;
    err.status = 400;
    throw err;
  }

  const normalizedPath = url.pathname.replace(/\/+$/g, "") || "/";

  const normalized = `${url.origin}${normalizedPath}${url.search}`;

  if (/[\)\[\]]/.test(normalized)) {
    const err = new Error(`Invalid redirect_url: enthält ungültige Zeichen: ${normalized}`) as any;
    err.status = 400;
    throw err;
  }

  return normalized;
}

// GoCardless API Types
interface Institution {
  id: string;
  name: string;
  bic: string;
  logo: string;
  countries: string[];
}

interface Requisition {
  id: string;
  redirect: string;
  status: string;
  accounts: string[];
  reference?: string;
  link?: string;
}

interface Balance {
  balanceAmount: {
    amount: string;
    currency: string;
  };
  balanceType: string;
  referenceDate?: string;
  lastChangeDateTime?: string;
}

interface GoCardlessTransaction {
  transactionId: string;
  bookingDate: string;
  valueDate?: string;
  transactionAmount: {
    amount: string;
    currency: string;
  };
  debtorName?: string;
  creditorName?: string;
  remittanceInformationUnstructured?: string;
  remittanceInformationStructured?: string;
  additionalInformation?: string;
}

interface AccountDetails {
  id: string;
  iban?: string;
  currency: string;
  ownerName?: string;
  name?: string;
  product?: string;
  status?: string;
}

// Token cache (in-memory, not persisted)
interface TokenCache {
  access: string;
  refresh: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.access;
  }

  if (tokenCache?.refresh) {
    try {
      const response = await fetch(`${GOCARDLESS_BASE_URL}/token/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: tokenCache.refresh }),
      });

      if (response.ok) {
        const data = await response.json();
        tokenCache = {
          access: data.access,
          refresh: tokenCache.refresh,
          expiresAt: Date.now() + data.access_expires * 1000 - 60_000,
        };
        return tokenCache.access;
      }
    } catch {
      // Fall through to full token fetch
    }
  }

  const response = await fetch(`${GOCARDLESS_BASE_URL}/token/new/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret_id: GOCARDLESS_SECRET_ID, secret_key: GOCARDLESS_SECRET_KEY }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Token fetch failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  tokenCache = {
    access: data.access,
    refresh: data.refresh,
    expiresAt: Date.now() + data.access_expires * 1000 - 60_000,
  };

  return tokenCache.access;
}

async function goCardlessFetch<T>(
  path: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Accept", "application/json");

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${GOCARDLESS_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = payload?.detail || payload?.summary || payload?.message || text || `HTTP ${response.status}`;
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  return payload as T;
}

async function getInstitutions(country: string, accessToken: string): Promise<Institution[]> {
  const params = new URLSearchParams({ country });
  const payload = await goCardlessFetch<Institution[] | { results?: Institution[] }>(
    `/institutions/?${params.toString()}`,
    accessToken,
  );

  if (Array.isArray(payload)) return payload;
  return payload.results || [];
}

async function createRequisition(
  institutionId: string,
  redirectUrl: string,
  userId: string,
  accessToken: string,
): Promise<Requisition> {
  const payload = await goCardlessFetch<Requisition>("/requisitions/", accessToken, {
    method: "POST",
    body: JSON.stringify({
      institution_id: institutionId,
      redirect: redirectUrl,
      reference: `${userId}:${crypto.randomUUID()}`,
      user_language: "DE",
    }),
  });

  return payload;
}

async function getRequisitionById(requisitionId: string, accessToken: string): Promise<Requisition> {
  return await goCardlessFetch<Requisition>(`/requisitions/${encodeURIComponent(requisitionId)}/`, accessToken);
}

async function findRequisitionByReference(reference: string, accessToken: string): Promise<Requisition | null> {
  let page = 0;

  while (page < 5) {
    const params = new URLSearchParams({ limit: "100", offset: String(page * 100) });
    const payload = await goCardlessFetch<Requisition[] | { results?: Requisition[] }>(
      `/requisitions/?${params.toString()}`,
      accessToken,
    );

    const items = Array.isArray(payload) ? payload : payload.results || [];
    const match = items.find((item) => item.id === reference || item.reference === reference);
    if (match) return match;
    if (items.length < 100) break;
    page += 1;
  }

  return null;
}

async function getRequisition(requisitionIdOrRef: string, accessToken: string): Promise<Requisition> {
  try {
    return await getRequisitionById(requisitionIdOrRef, accessToken);
  } catch (error) {
    if ((error as { status?: number })?.status !== 404) {
      throw error;
    }
  }

  const requisition = await findRequisitionByReference(requisitionIdOrRef, accessToken);
  if (requisition) return requisition;

  const error = new Error("Requisition not found") as Error & { status?: number };
  error.status = 404;
  throw error;
}

async function assertRequisitionBoundToUser(
  supabaseClient: ReturnType<typeof createClient>,
  requisition: Requisition,
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

  const err = new Error("Forbidden") as Error & { status?: number };
  err.status = 403;
  throw err;
}

async function getAccountDetails(accountId: string, accessToken: string): Promise<AccountDetails> {
  const payload = await goCardlessFetch<AccountDetails | { account?: AccountDetails }>(
    `/accounts/${encodeURIComponent(accountId)}/details/`,
    accessToken,
  );

  const details = "account" in payload && payload.account ? payload.account : payload;
  return { id: accountId, ...details };
}

async function getAccountBalances(accountId: string, accessToken: string): Promise<Balance[]> {
  const payload = await goCardlessFetch<{ balances?: Balance[] }>(
    `/accounts/${encodeURIComponent(accountId)}/balances/`,
    accessToken,
  );

  return payload.balances || [];
}

async function getTransactionsFromGoCardless(
  accountId: string,
  dateFrom: string,
  dateTo: string,
  accessToken: string,
): Promise<GoCardlessTransaction[]> {
  const params = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
  const payload = await goCardlessFetch<{
    transactions?: {
      booked?: GoCardlessTransaction[];
      pending?: GoCardlessTransaction[];
    };
  }>(`/accounts/${encodeURIComponent(accountId)}/transactions/?${params.toString()}`, accessToken);

  return payload.transactions?.booked || [];
}

serve(async (req) => {

  const origin = req.headers.get("Origin");
  const correlationId = crypto.randomUUID();

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(origin) });
  }

  if (origin && !isAllowedOrigin(origin)) {
    console.warn("[gocardless-sync] Rejected origin", { correlationId, origin });
    return jsonResponse(origin, 403, { error: "forbidden_origin" });
  }

  try {
    const secrets = checkSecrets();
    if (!secrets.valid) {
      return jsonResponse(origin, 500, { error: "setup_required", setup_required: true, details: secrets.message });
    }

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse(origin, 401, { error: "unauthorized" });
    }

    const body = await req.json();
    const action = body?.action as string | undefined;

    if (!action) {
      const err = new Error("action required") as any;
      err.status = 400;
      throw err;
    }

    const accessToken = await getAccessToken();

    switch (action) {
      case "get-institutions": {
        const country = (body?.country || "DE") as string;
        const institutions = await getInstitutions(country, accessToken);
        return jsonResponse(origin, 200, { institutions });
      }

      case "create-requisition": {
        const institutionId = body?.institution_id as string | undefined;
        const redirectUrl = body?.redirect_url as string | undefined;

        if (!institutionId || !redirectUrl) {
          const err = new Error("institution_id and redirect_url required") as any;
          err.status = 400;
          throw err;
        }

        const validatedRedirect = validateRedirectUrl(redirectUrl);
        const requisition = await createRequisition(institutionId, validatedRedirect, user.id, accessToken);
        return jsonResponse(origin, 200, { requisition });
      }

      case "get-accounts": {
        const requisitionIdOrRef = body?.requisition_id as string | undefined;
        if (!requisitionIdOrRef) {
          const err = new Error("requisition_id required") as any;
          err.status = 400;
          throw err;
        }

        const requisition = await getRequisition(requisitionIdOrRef, accessToken);
        await assertRequisitionBoundToUser(supabaseClient, requisition, user.id, requisitionIdOrRef);

        const accounts = await Promise.all(
          (requisition.accounts || []).map(async (accountId: string) => {
            try {
              const [details, balances] = await Promise.all([
                getAccountDetails(accountId, accessToken),
                getAccountBalances(accountId, accessToken),
              ]);

              // Note: details may include IBAN/ownerName. Never log it.
              return { ...details, balances };
            } catch (error) {
              console.error("[gocardless-sync] Failed to fetch account", {
                correlationId,
                accountId,
                error: String(error),
              });

              return { id: accountId, currency: "EUR", name: "Unknown Account", balances: [] };
            }
          }),
        );

        console.log("[gocardless-sync] Accounts fetched", {
          correlationId,
          requisitionId: requisition.id,
          accountsCount: accounts.length,
        });

        return jsonResponse(origin, 200, { requisition, accounts });
      }

      case "get-balances": {
        const accountId = body?.account_id as string | undefined;
        if (!accountId) {
          const err = new Error("account_id required") as any;
          err.status = 400;
          throw err;
        }

        const balances = await getAccountBalances(accountId, accessToken);
        return jsonResponse(origin, 200, { balances });
      }

      case "get-transactions": {
        const requisitionIdOrRef = body?.requisition_id as string | undefined;
        const accountId = body?.account_id as string | undefined;

        if (!requisitionIdOrRef) {
          const err = new Error("requisition_id required") as any;
          err.status = 400;
          throw err;
        }

        if (!accountId) {
          const err = new Error("account_id required") as any;
          err.status = 400;
          throw err;
        }

        const requisition = await getRequisition(requisitionIdOrRef, accessToken);
        await assertRequisitionBoundToUser(supabaseClient, requisition, user.id, requisitionIdOrRef);

        const allowedAccounts = requisition.accounts || [];
        if (!allowedAccounts.includes(accountId)) {
          const err = new Error("Forbidden") as any;
          err.status = 403;
          throw err;
        }

        const today = new Date();
        const fromDate =
          (body?.date_from as string | undefined) ||
          new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
        const toDate = (body?.date_to as string | undefined) || today.toISOString().split("T")[0];

        const transactions = await getTransactionsFromGoCardless(accountId, fromDate, toDate, accessToken);

        console.log("[gocardless-sync] Transactions fetched", {
          correlationId,
          requisitionId: requisition.id,
          accountId,
          count: transactions.length,
        });

        return jsonResponse(origin, 200, { transactions });
      }

      default: {
        const err = new Error(`Unknown action: ${action}`) as any;
        err.status = 400;
        throw err;
      }
    }
  } catch (error) {
    const status = typeof (error as { status?: unknown })?.status === "number"
      ? ((error as { status: number }).status)
      : 500;
    const message = error instanceof Error ? error.message : "Unexpected error";

    console.error("[gocardless-sync] Request failed", {
      correlationId,
      status,
      error: message,
    });

    return jsonResponse(origin, status, { error: message });
  }
});