/**
 * ScenarioPayload ⇄ URL-Parameter (WP-H).
 *
 * Der Chat beantwortet ein Szenario kompakt und verlinkt für die volle
 * Analyse auf `/liquidity?szenario=…` — DIESES Modul ist die eine Stelle,
 * die kodiert und dekodiert, damit beide Seiten dasselbe Format meinen.
 *
 * Dekodiert wird an einer DATENGRENZE (jeder kann eine URL tippen): zod
 * validiert die Struktur vollständig; ein unlesbarer oder unpassender
 * Parameter ergibt `null`, nie einen halb geparsten Payload
 * (`docs/coding-guide.md`, dieselbe Linie wie `parseAtBoundary`).
 *
 * Die URL bleibt lokal im Browser (BrowserRouter, kein Server liest sie) —
 * es verlassen keine Finanzdaten das Gerät.
 */
import { z } from 'zod';
import type { ScenarioPayload } from './scenario-payload-types';

const flowSelectorSchema = z.union([
  z.object({ kind: z.literal('ids'), ids: z.array(z.string().min(1)).min(1) }),
  z.object({ kind: z.literal('largestIncome') }),
  z.object({ kind: z.literal('largestExpense') }),
  z.object({
    kind: z.literal('keyword'),
    keyword: z.string().min(1),
    direction: z.enum(['income', 'expense']).optional(),
  }),
]);

const eventSchema = z.object({
  eventType: z.enum([
    'expense',
    'income',
    'income_reduction',
    'baseline_multiplier',
    'flow_change',
    'recurring_flow',
  ]),
  amount: z.number().finite(),
  dayIndex: z.number().int().min(0).optional(),
  startDayIndex: z.number().int().min(0).optional(),
  endDayIndex: z.number().int().min(0).optional(),
  probability: z.number().min(0).max(1).optional(),
  description: z.string().max(200).optional(),
  flowSelector: flowSelectorSchema.optional(),
  factor: z.number().min(0).optional(),
  direction: z.enum(['income', 'expense']).optional(),
});

const payloadSchema = z.object({
  scenarioId: z.string().min(1),
  scenarioType: z.enum([
    'base_check',
    'large_purchase',
    'income_loss',
    'higher_cost_of_living',
    'shock_recovery',
    'stress_capacity',
    'custom_combination',
  ]),
  timeHorizonDays: z.number().int().min(1).max(730),
  probability: z.number().min(0).max(1).optional(),
  thresholdAmount: z.number().min(0).optional(),
  events: z.array(eventSchema).max(50).optional(),
  baselineMultiplier: z.number().min(0.1).max(5).optional(),
  notes: z.string().max(500).optional(),
});

/** base64url ohne Padding — URL-sicher ohne weiteres Encoding. */
function toBase64Url(text: string): string {
  return btoa(unescape(encodeURIComponent(text)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fromBase64Url(text: string): string | null {
  try {
    const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
    return decodeURIComponent(escape(atob(b64)));
  } catch {
    return null;
  }
}

export function encodeScenarioParam(payload: ScenarioPayload): string {
  return toBase64Url(JSON.stringify(payload));
}

export function decodeScenarioParam(param: string | null): ScenarioPayload | null {
  if (!param) return null;
  const json = fromBase64Url(param);
  if (json === null) return null;
  try {
    const geparst = payloadSchema.safeParse(JSON.parse(json));
    return geparst.success ? geparst.data : null;
  } catch {
    return null;
  }
}
