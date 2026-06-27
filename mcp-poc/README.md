# Fintracker MCP POC server

Remote **MCP server** (Streamable HTTP) that exposes Fintracker's financial
**aggregates** read-only, so you can ask about them by voice/chat from Claude or
ChatGPT. This is a **proof of concept**, not production software.

> ⚠️ **This intentionally breaks Fintracker's local-only guarantee.** Aggregates
> leave the device (to Supabase, and then to the LLM provider when you query
> them). See [`../docs/mcp-poc.md`](../docs/mcp-poc.md). Only enable it
> knowingly, via the double-confirmation flow in the app's settings.

## What it exposes (all read-only)

| Tool | Answers |
|---|---|
| `get_monthly_spending` | spending per (sub)category, optional `month` (YYYY-MM) |
| `get_budget_status` | per-budget spent / remaining / ratio / health |
| `get_cashflow_forecast` | expected income / expenses / savings / end balance |
| `explain_unusual_expenses` | category months far above their own median |

Raw transactions, IBANs, payees and free text are **never** uploaded, so they
are not available here by design.

## Run locally

```bash
cd mcp-poc
cp .env.example .env      # fill SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
npm install
npm run dev               # POST http://localhost:8080/mcp/<token>
```

Apply the DB migration first (from the repo root, with the Supabase CLI):

```bash
supabase db push          # creates table mcp_aggregate_snapshots (+ RLS)
```

In the Fintracker app: **Settings → Sprach-/KI-Zugriff (MCP)** → enable the
cloud sync (double confirmation). The app shows a one-time **connector URL** and
**token**. Set `VITE_MCP_POC_URL` in the web app's env to this server's public
base URL so the generated URL is correct.

## Connect a client

- **MCP Inspector** (easiest to verify): point it at `http://localhost:8080/mcp/<token>`.
- **Claude / ChatGPT connector:** the server must be reachable over **public
  HTTPS** — deploy it, or tunnel it (`ngrok http 8080` / Cloudflare Tunnel).
  Add the resulting `https://…/mcp/<token>` as a custom MCP connector
  ("No Authentication"; the token sits in the path).

## Auth & security (read this)

- **POC auth = a static bearer token** carried in the URL path or
  `Authorization: Bearer <token>`. The server hashes it (SHA-256) and looks up
  the matching per-user snapshot. **A token in a URL can end up in logs** —
  acceptable only for a POC.
- The server reads Supabase with the **service-role key**; keep it server-side.
- Production would need **OAuth 2.1** (per the MCP auth spec), per-user scopes,
  Origin validation, and rate limiting. None of that is implemented here.
- **Voice caveat:** as of mid-2026, neither ChatGPT Advanced Voice nor Claude
  voice chat invoke MCP tools — only **text** chat does. "Speak on your phone"
  means dictating into the text box, not hands-free voice. Verify in your client.
