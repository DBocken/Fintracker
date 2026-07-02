// DSGVO Art. 17 – Konto- und Datenlöschung (Issue #31).
//
// Löscht serverseitig in dieser Reihenfolge:
//   1. GoCardless-Requisitionen des Nutzers beenden (Bank-Zugriffe widerrufen)
//   2. alle Zeilen in den Cloud-Tabellen mit dieser user_id
//   3. den Supabase-Auth-User selbst (Service-Role nötig)
//
// Der Client kann den Auth-User nicht selbst löschen – daher diese Edge Function
// mit Service-Role-Key.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const GOCARDLESS_SECRET_ID = Deno.env.get("GOCARDLESS_SECRET_ID") || "";
const GOCARDLESS_SECRET_KEY = Deno.env.get("GOCARDLESS_SECRET_KEY") || "";
const GOCARDLESS_BASE_URL = "https://bankaccountdata.gocardless.com/api/v2";

const DEFAULT_ALLOWED_ORIGIN_SUFFIXES = ["vercel.app"];

// Alle nutzerbezogenen Tabellen. Reihenfolge: Kind- vor Eltern-Tabellen.
// Nicht existierende Tabellen werden in tableErrors gesammelt (nicht fatal),
// sodass die Liste gefahrlos vollständig gehalten werden kann (DSGVO-Löschung).
const USER_SCOPED_TABLES = [
  "portfolio_positions",
  "portfolios",
  "balance_refresh_limits",
  "encrypted_analytics_blobs",
  "analytics_consent",
  "sync_metadata",
  "user_category_priorities",
  "user_merchant_rules",
  "user_contract_decisions",
  "mcp_aggregate_snapshots",
  "categories",
  "accounts",
  "bank_connections",
  "milestones",
  "user_settings",
];

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true;
  try {
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    if (url.protocol === "http:" && (host === "localhost" || host === "127.0.0.1")) return true;
    return (
      url.protocol === "https:" &&
      DEFAULT_ALLOWED_ORIGIN_SUFFIXES.some((s) => host === s || host.endsWith(`.${s}`))
    );
  } catch {
    return false;
  }
}

function corsHeaders(origin: string | null): HeadersInit {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (origin && isAllowedOrigin(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function jsonResponse(origin: string | null, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

async function getGoCardlessToken(): Promise<string | null> {
  if (!GOCARDLESS_SECRET_ID || !GOCARDLESS_SECRET_KEY) return null;
  try {
    const res = await fetch(`${GOCARDLESS_BASE_URL}/token/new/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret_id: GOCARDLESS_SECRET_ID, secret_key: GOCARDLESS_SECRET_KEY }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.access ?? null;
  } catch {
    return null;
  }
}

async function endRequisitions(requisitionIds: string[], token: string): Promise<void> {
  for (const id of requisitionIds) {
    try {
      await fetch(`${GOCARDLESS_BASE_URL}/requisitions/${encodeURIComponent(id)}/`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      });
    } catch {
      // Best-effort: Löschung der Daten darf an einer GoCardless-Störung nicht scheitern.
    }
  }
}

serve(async (req) => {
  const origin = req.headers.get("Origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders(origin) });
  }
  if (origin && !isAllowedOrigin(origin)) {
    return jsonResponse(origin, 403, { error: "forbidden_origin" });
  }
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse(origin, 500, { error: "setup_required", details: "SUPABASE_SERVICE_ROLE_KEY fehlt" });
  }

  try {
    // 1. Aufrufer authentifizieren (anon-Client mit dem Bearer-Token des Nutzers).
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") || "" } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return jsonResponse(origin, 401, { error: "unauthorized" });
    }

    const uid = user.id;
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 2. GoCardless-Requisitionen beenden (vor dem Löschen der bank_connections).
    const { data: connections } = await admin
      .from("bank_connections")
      .select("requisition_id")
      .eq("user_id", uid);

    const requisitionIds = (connections ?? [])
      .map((c: { requisition_id?: string | null }) => c.requisition_id)
      .filter((id): id is string => !!id);

    if (requisitionIds.length > 0) {
      const token = await getGoCardlessToken();
      if (token) await endRequisitions(requisitionIds, token);
    }

    // 3. Alle nutzerbezogenen Tabellenzeilen löschen.
    const tableErrors: Record<string, string> = {};
    for (const table of USER_SCOPED_TABLES) {
      const { error } = await admin.from(table).delete().eq("user_id", uid);
      if (error) tableErrors[table] = error.message;
    }

    // 4. Auth-User löschen.
    const { error: deleteUserError } = await admin.auth.admin.deleteUser(uid);
    if (deleteUserError) {
      return jsonResponse(origin, 500, {
        error: "auth_delete_failed",
        details: deleteUserError.message,
        tableErrors,
      });
    }

    return jsonResponse(origin, 200, { success: true, tableErrors });
  } catch (error) {
    return jsonResponse(origin, 500, {
      error: "delete_failed",
      details: error instanceof Error ? error.message : "unbekannter Fehler",
    });
  }
});
