// Fintracker MCP POC — remote (Streamable HTTP) MCP server.
//
// ⚠️ Proof of Concept. Exposes READ-ONLY financial AGGREGATES that the Fintracker
// web app uploaded (per user, after double opt-in confirmation). Auth is a static
// bearer token (in the URL path OR the Authorization header) — NOT production
// OAuth 2.1. Run it next to nothing sensitive and treat the token as a secret.

import express, { type Request, type Response } from 'express';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

const PORT = Number(process.env.PORT ?? 8080);
const SUPABASE_URL = requireEnv('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

// ── Snapshot loading (the only data source) ─────────────────────────────────
type Snapshot = {
  schema_version: number;
  generated_at: string;
  base_currency: string;
  monthly_spending: { month: string; total: number; by_category: unknown[] }[];
  budget_status: unknown[];
  cashflow: unknown | null;
  unusual_expenses: { month: string }[];
};

async function loadSnapshot(token: string): Promise<Snapshot | null> {
  const { data, error } = await supabase
    .from('mcp_aggregate_snapshots')
    .select('payload')
    .eq('token_hash', sha256Hex(token))
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.payload as Snapshot) ?? null;
}

function jsonResult(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
    structuredContent: value as Record<string, unknown>,
  };
}

function notLinked() {
  return {
    content: [
      {
        type: 'text' as const,
        text: 'Kein verknüpfter Fintracker-Snapshot für dieses Token. Bitte in der App den Cloud-Sync (MCP) aktivieren bzw. synchronisieren.',
      },
    ],
    isError: true,
  };
}

// ── Build a per-request server bound to the caller's token ──────────────────
function buildServer(token: string): McpServer {
  const server = new McpServer({ name: 'fintracker-mcp-poc', version: '0.1.0' });
  const ro = { readOnlyHint: true, openWorldHint: false } as const;

  server.registerTool(
    'get_monthly_spending',
    {
      title: 'Monatsausgaben pro Kategorie',
      description:
        'Aggregierte Ausgaben je (Unter-)Kategorie. Optional auf einen Monat (YYYY-MM) eingeschränkt. Transfers sind ausgeschlossen.',
      inputSchema: { month: z.string().regex(/^\d{4}-\d{2}$/).optional() },
      annotations: ro,
    },
    async ({ month }) => {
      const snap = await loadSnapshot(token);
      if (!snap) return notLinked();
      const rows = month ? snap.monthly_spending.filter((m) => m.month === month) : snap.monthly_spending;
      return jsonResult({ base_currency: snap.base_currency, months: rows });
    },
  );

  server.registerTool(
    'get_budget_status',
    {
      title: 'Budget-Status',
      description: 'Budget-Auslastung des aktuellen Monats: spent, remaining, ratio, health (ok/warn/over).',
      inputSchema: {},
      annotations: ro,
    },
    async () => {
      const snap = await loadSnapshot(token);
      if (!snap) return notLinked();
      return jsonResult({ base_currency: snap.base_currency, budgets: snap.budget_status });
    },
  );

  server.registerTool(
    'get_cashflow_forecast',
    {
      title: 'Cashflow-Prognose',
      description: 'Erwartetes Einkommen, Ausgaben, Sparen und prognostizierter Überschuss bis Monatsende.',
      inputSchema: {},
      annotations: ro,
    },
    async () => {
      const snap = await loadSnapshot(token);
      if (!snap) return notLinked();
      return jsonResult({ base_currency: snap.base_currency, cashflow: snap.cashflow });
    },
  );

  server.registerTool(
    'explain_unusual_expenses',
    {
      title: 'Ungewöhnlich hohe Ausgaben',
      description:
        'Kategorie-Monatssummen, die deutlich über dem eigenen Median liegen. Optional auf einen Monat (YYYY-MM) eingeschränkt.',
      inputSchema: { month: z.string().regex(/^\d{4}-\d{2}$/).optional() },
      annotations: ro,
    },
    async ({ month }) => {
      const snap = await loadSnapshot(token);
      if (!snap) return notLinked();
      const rows = month ? snap.unusual_expenses.filter((u) => u.month === month) : snap.unusual_expenses;
      return jsonResult({ base_currency: snap.base_currency, unusual: rows });
    },
  );

  return server;
}

// ── HTTP wiring (stateless Streamable HTTP) ─────────────────────────────────
function resolveToken(req: Request): string | null {
  const fromPath = typeof req.params.token === 'string' ? req.params.token : null;
  const auth = req.header('authorization');
  const fromHeader = auth?.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : null;
  return fromPath || fromHeader || null;
}

async function handleMcpPost(req: Request, res: Response) {
  const token = resolveToken(req);
  if (!token) {
    res.status(401).json({ error: 'missing access token (use /mcp/<token> or Bearer header)' });
    return;
  }
  // Stateless: fresh server + transport per request.
  const server = buildServer(token);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  res.on('close', () => {
    transport.close();
    server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/mcp/:token', handleMcpPost);
app.post('/mcp', handleMcpPost);

// Stateless mode has no server->client SSE stream and no session to delete.
const methodNotAllowed = (_req: Request, res: Response) =>
  res.status(405).json({ error: 'Method not allowed (stateless server, POST only).' });
app.get(['/mcp', '/mcp/:token'], methodNotAllowed);
app.delete(['/mcp', '/mcp/:token'], methodNotAllowed);

app.listen(PORT, () => {
  console.log(`fintracker-mcp-poc listening on :${PORT} (POST /mcp/<token>)`);
});
