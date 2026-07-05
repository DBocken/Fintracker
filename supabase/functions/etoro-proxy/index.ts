import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// ---------------------------------------------------------------------------
// eToro-Proxy (zustandslos)
//
// Die eToro Public API erlaubt keine Browser-Direktaufrufe (CORS) und muss
// server-seitig aufgerufen werden. Diese Function reicht die vom Client pro
// Request mitgelieferten Keys (x-api-key / x-user-key) ausschließlich durch:
// sie werden hier weder gespeichert noch geloggt. Die dauerhafte Ablage der
// Keys bleibt lokal & verschlüsselt auf dem Gerät des Nutzers.
// ---------------------------------------------------------------------------

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

// Whitelist: nur lesende Portfolio-Endpoints — keine Order-/Trading-Aufrufe.
const ETORO_BASE = "https://public-api.etoro.com/api/v1";
const ENDPOINT_PATHS: Record<string, string[]> = {
  // Primär der dokumentierte v1-Pfad, als Fallback der ältere real-Pfad.
  "portfolio": ["/trading/info/portfolio", "/trading/info/real/portfolio"],
  "demo-portfolio": ["/trading/info/demo/portfolio"],
};

function jsonResponse(headers: HeadersInit, status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  const origin = req.headers.get("Origin");
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response("Unauthorized", { status: 401, headers });
  }

  const token = authHeader.replace("Bearer ", "");

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
    },
  );

  const {
    data: { user },
    error: userError,
  } = await supabaseClient.auth.getUser();

  if (userError || !user) {
    console.error("[etoro-proxy] Auth error");
    return new Response("Invalid token", { status: 401, headers });
  }

  let body: { endpoint?: string; apiKey?: string; userKey?: string; instrumentIds?: unknown } | null = null;
  try {
    body = await req.json();
  } catch {
    body = null;
  }

  const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
  const userKey = typeof body?.userKey === "string" ? body.userKey.trim() : "";
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "portfolio";

  if (!apiKey || !userKey) {
    return jsonResponse(headers, 400, { error: "missing_credentials" });
  }

  // Instrument-Metadaten (Symbol/Name) sind ein eigener, dynamisch parametrisierter
  // Endpoint — die Portfolio-Antwort selbst liefert nur instrumentID.
  if (endpoint === "instruments") {
    const ids = Array.isArray(body?.instrumentIds)
      ? body.instrumentIds.filter((id): id is number => typeof id === "number" && Number.isFinite(id)).slice(0, 200)
      : [];
    if (ids.length === 0) {
      return jsonResponse(headers, 400, { error: "missing_instrument_ids" });
    }

    const url = `${ETORO_BASE}/market-data/instruments?instrumentIds=${ids.join(",")}&fields=instrumentId,internalSymbolFull,displayname`;
    try {
      const resp = await fetch(url, {
        method: "GET",
        headers: {
          "x-api-key": apiKey,
          "x-user-key": userKey,
          "x-request-id": crypto.randomUUID(),
          "Accept": "application/json",
        },
      });
      if (!resp.ok) {
        const text = (await resp.text().catch(() => "")).slice(0, 300);
        console.error(`[etoro-proxy] eToro instruments -> ${resp.status}`);
        return jsonResponse(headers, resp.status === 401 || resp.status === 403 ? 401 : 502, {
          error: "etoro_request_failed",
          upstream_status: resp.status,
          details: text,
        });
      }
      const data = await resp.json();
      return jsonResponse(headers, 200, data);
    } catch (e) {
      console.error("[etoro-proxy] Fetch failed for instruments", String(e));
      return jsonResponse(headers, 502, { error: "etoro_request_failed" });
    }
  }

  const paths = ENDPOINT_PATHS[endpoint];
  if (!paths) {
    return jsonResponse(headers, 400, { error: "unsupported_endpoint" });
  }

  let lastStatus = 0;
  let lastBody = "";

  for (const path of paths) {
    try {
      const resp = await fetch(`${ETORO_BASE}${path}`, {
        method: "GET",
        headers: {
          "x-api-key": apiKey,
          "x-user-key": userKey,
          "x-request-id": crypto.randomUUID(),
          "Accept": "application/json",
        },
      });

      if (resp.ok) {
        const data = await resp.json();
        console.log(`[etoro-proxy] OK ${path} (${resp.status})`);
        return jsonResponse(headers, 200, data);
      }

      lastStatus = resp.status;
      // Fehlertext ohne Header/Keys — nur zur Diagnose, gekürzt.
      lastBody = (await resp.text().catch(() => "")).slice(0, 300);
      console.error(`[etoro-proxy] eToro ${path} -> ${resp.status}`);

      // Auth-Fehler nicht auf dem Fallback-Pfad wiederholen.
      if (resp.status === 401 || resp.status === 403) break;
    } catch (e) {
      lastStatus = 502;
      lastBody = String(e).slice(0, 300);
      console.error(`[etoro-proxy] Fetch failed for ${path}`);
    }
  }

  const status = lastStatus === 401 || lastStatus === 403 ? 401 : 502;
  return jsonResponse(headers, status, {
    error: "etoro_request_failed",
    upstream_status: lastStatus,
    details: lastBody,
  });
});
