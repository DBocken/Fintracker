// ⚠️ Proof of Concept — siehe docs/mcp-poc.md.
//
// Vercel Serverless Function: stellt Fintrackers Finanz-AGGREGATE als REMOTE
// MCP-Server (Streamable HTTP, JSON-RPC) read-only bereit, damit Claude/ChatGPT
// sie per Connector lesen koennen. Laeuft auf derselben Domain wie die App – es
// ist KEIN separater Server und KEIN extra Secret noetig: gelesen wird ueber die
// SECURITY-DEFINER-Funktion get_mcp_snapshot mit dem oeffentlichen anon-Key,
// token-gegatet. Auth = statisches Token im Pfad (POC, kein OAuth).

import { createHash } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'https://pbopyawkxxrluhofjtub.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBib3B5YXdreHhybHVob2ZqdHViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwMTAyNjUsImV4cCI6MjA3OTU4NjI2NX0.ilTTqmu5CQUDeYxRWUmXcKUIolnFdgUGOtyrzg5sqNM';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const PROTOCOL_VERSION = '2025-06-18';
const MONTH_SCHEMA = { type: 'string', pattern: '^\\d{4}-\\d{2}$' } as const;

type Snapshot = {
  base_currency?: string;
  monthly_spending?: { month: string }[];
  budget_status?: unknown[];
  cashflow?: unknown;
  unusual_expenses?: { month: string }[];
};

type ToolDef = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  run: (snap: Snapshot, args: Record<string, unknown>) => unknown;
};

const TOOLS: ToolDef[] = [
  {
    name: 'get_monthly_spending',
    title: 'Monatsausgaben pro Kategorie',
    description:
      'Aggregierte Ausgaben je (Unter-)Kategorie. Optional auf einen Monat (YYYY-MM) eingeschränkt. Transfers ausgeschlossen.',
    inputSchema: { type: 'object', properties: { month: MONTH_SCHEMA }, additionalProperties: false },
    run: (snap, args) => {
      const month = typeof args.month === 'string' ? args.month : undefined;
      const all = snap.monthly_spending ?? [];
      return { base_currency: snap.base_currency, months: month ? all.filter((m) => m.month === month) : all };
    },
  },
  {
    name: 'get_budget_status',
    title: 'Budget-Status',
    description: 'Budget-Auslastung des aktuellen Monats: spent, remaining, ratio, health (ok/warn/over).',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: (snap) => ({ base_currency: snap.base_currency, budgets: snap.budget_status ?? [] }),
  },
  {
    name: 'get_cashflow_forecast',
    title: 'Cashflow-Prognose',
    description: 'Erwartetes Einkommen, Ausgaben, Sparen und prognostizierter Überschuss bis Monatsende.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: (snap) => ({ base_currency: snap.base_currency, cashflow: snap.cashflow ?? null }),
  },
  {
    name: 'explain_unusual_expenses',
    title: 'Ungewöhnlich hohe Ausgaben',
    description:
      'Kategorie-Monatssummen deutlich über dem eigenen Median. Optional auf einen Monat (YYYY-MM) eingeschränkt.',
    inputSchema: { type: 'object', properties: { month: MONTH_SCHEMA }, additionalProperties: false },
    run: (snap, args) => {
      const month = typeof args.month === 'string' ? args.month : undefined;
      const all = snap.unusual_expenses ?? [];
      return { base_currency: snap.base_currency, unusual: month ? all.filter((u) => u.month === month) : all };
    },
  },
];

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function loadSnapshot(token: string): Promise<Snapshot | null> {
  const { data, error } = await supabase.rpc('get_mcp_snapshot', { p_token_hash: sha256Hex(token) });
  if (error) throw new Error(error.message);
  return (data as Snapshot) ?? null;
}

// ── JSON-RPC handling (mirrors the MCP SDK wire format) ─────────────────────
type RpcRequest = { jsonrpc: '2.0'; id?: string | number | null; method: string; params?: Record<string, unknown> };

function result(id: RpcRequest['id'], value: unknown) {
  return { jsonrpc: '2.0' as const, id, result: value };
}
function rpcError(id: RpcRequest['id'], code: number, message: string) {
  return { jsonrpc: '2.0' as const, id, error: { code, message } };
}

async function dispatch(msg: RpcRequest, token: string): Promise<object | null> {
  switch (msg.method) {
    case 'initialize':
      return result(msg.id ?? null, {
        protocolVersion:
          typeof msg.params?.protocolVersion === 'string' ? msg.params.protocolVersion : PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'fintracker-mcp', version: '0.1.0' },
      });
    case 'ping':
      return result(msg.id ?? null, {});
    case 'tools/list':
      return result(msg.id ?? null, {
        tools: TOOLS.map((t) => ({
          name: t.name,
          title: t.title,
          description: t.description,
          inputSchema: t.inputSchema,
          annotations: { readOnlyHint: true, openWorldHint: false },
        })),
      });
    case 'tools/call': {
      const name = msg.params?.name;
      const tool = TOOLS.find((t) => t.name === name);
      if (!tool) return rpcError(msg.id ?? null, -32602, `Unknown tool: ${String(name)}`);
      const snap = await loadSnapshot(token);
      if (!snap) {
        return result(msg.id ?? null, {
          content: [
            {
              type: 'text',
              text: 'Kein verknüpfter Fintracker-Snapshot für dieses Token. Bitte in der App den Cloud-Sync (MCP) aktivieren/synchronisieren.',
            },
          ],
          isError: true,
        });
      }
      const args = (msg.params?.arguments as Record<string, unknown> | undefined) ?? {};
      const value = tool.run(snap, args);
      return result(msg.id ?? null, {
        content: [{ type: 'text', text: JSON.stringify(value, null, 2) }],
        structuredContent: value as Record<string, unknown>,
      });
    }
    default:
      // Notifications (e.g. notifications/initialized) have no id → no response.
      if (msg.id === undefined || msg.id === null) return null;
      return rpcError(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}

// ── HTTP entrypoint (Vercel Node function) ──────────────────────────────────
type VercelReq = IncomingMessage & { body?: unknown; query?: Record<string, string | string[]> };

async function readBody(req: VercelReq): Promise<unknown> {
  if (req.body !== undefined && req.body !== null && req.body !== '') {
    return typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : undefined;
}

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

export default async function handler(req: VercelReq, res: ServerResponse): Promise<void> {
  const tokenParam = req.query?.token;
  const token = Array.isArray(tokenParam) ? tokenParam[0] : tokenParam;
  if (!token) {
    sendJson(res, 401, { error: 'missing access token in path (/api/mcp/<token>)' });
    return;
  }
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed (POST only).' });
    return;
  }

  let body: unknown;
  try {
    body = await readBody(req);
  } catch {
    sendJson(res, 400, rpcError(null, -32700, 'Parse error'));
    return;
  }

  try {
    if (Array.isArray(body)) {
      const responses = (await Promise.all((body as RpcRequest[]).map((m) => dispatch(m, token)))).filter(
        (r): r is object => r !== null,
      );
      if (responses.length === 0) {
        res.statusCode = 202;
        res.end();
        return;
      }
      sendJson(res, 200, responses);
      return;
    }

    const single = await dispatch(body as RpcRequest, token);
    if (single === null) {
      res.statusCode = 202;
      res.end();
      return;
    }
    sendJson(res, 200, single);
  } catch (err) {
    const id = (body as RpcRequest | undefined)?.id ?? null;
    sendJson(res, 200, rpcError(id, -32603, err instanceof Error ? err.message : 'Internal error'));
  }
}
