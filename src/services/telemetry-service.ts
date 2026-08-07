import { z } from 'zod';
import {
  TELEMETRY_SCHEMA_VERSION,
  containsForbiddenField,
  sanitizeEvents,
  type TelemetryEnvelope,
  type TelemetryEvent,
} from '@/lib/telemetry-events';
import { isFeatureEnabled, parseOverrides, type FeatureFlagOverrides } from '@/lib/feature-flags';

/**
 * Telemetrie-Versand (WP-11.2) — die einzige Stelle, an der Ereignisse das
 * Gerät verlassen können.
 *
 * **Vier Bedingungen, die alle gleichzeitig erfüllt sein müssen.** Fällt eine
 * weg, wird nichts gesendet, und zwar still:
 *
 * 1. Das Flag `telemetry` ist an (Voreinstellung: aus, `decision-log` F-1).
 * 2. Ein Endpunkt ist konfiguriert (`VITE_TELEMETRY_ENDPOINT`, **ohne**
 *    Rückfallwert — ohne Konfiguration gibt es kein Ziel und damit keinen
 *    Versand).
 * 3. Die Nutzlast übersteht `sanitizeEvents`.
 * 4. Die fertige Nutzlast enthält kein verbotenes Feld.
 *
 * Punkt 4 ist bewusst redundant zu Punkt 3. Er prüft, was tatsächlich
 * hinausgeht, nicht was hinausgehen sollte — und schlägt laut fehl statt still
 * zu senden. In einer local-first App ist ein zu viel gesendetes Feld kein
 * Schönheitsfehler, sondern der Bruch des Versprechens.
 *
 * **Warum eine Warteschlange.** Ereignisse fallen an, während die App läuft;
 * ein Versand pro Ereignis wäre Netzlast ohne Nutzen und im Offline-Fall
 * verloren. Sie liegt in `localStorage` und ist **gedeckelt** — Telemetrie darf
 * niemals den Speicher füllen, der den Finanzdaten gehört.
 */

const QUEUE_KEY = 'fintracker_telemetry_queue_v1';
const SESSION_KEY = 'fintracker_telemetry_session_v1';
const OVERRIDES_KEY = 'fintracker_feature_flags_v1';

/** Höchstzahl gepufferter Ereignisse. Darüber hinaus fallen die ältesten weg. */
export const MAX_QUEUED_EVENTS = 200;

const eventSchema: z.ZodType<TelemetryEvent> = z.union([
  z.object({ type: z.literal('screen_view'), route: z.string() }),
  z.object({
    type: z.literal('error'),
    kind: z.enum(['query_failed', 'render_crash', 'storage_unavailable', 'import_failed']),
    route: z.string(),
  }),
  z.object({
    type: z.literal('performance'),
    route: z.string(),
    metric: z.enum(['lcp', 'cls', 'interaction']),
    value: z.number().finite(),
  }),
  z.object({ type: z.literal('feature_used'), feature: z.string() }),
]);

function readOverrides(): FeatureFlagOverrides {
  try {
    return parseOverrides(JSON.parse(localStorage.getItem(OVERRIDES_KEY) ?? '{}'));
  } catch {
    return {};
  }
}

export function isTelemetryEnabled(): boolean {
  return isFeatureEnabled('telemetry', readOverrides());
}

/** Der Endpunkt hat KEINEN Rückfallwert — ohne Konfiguration kein Versand. */
function endpoint(): string | null {
  const configured = import.meta.env.VITE_TELEMETRY_ENDPOINT;
  return typeof configured === 'string' && configured.length > 0 ? configured : null;
}

/**
 * Kennung dieser Sitzung. Wird beim Schliessen des Tabs verworfen
 * (`sessionStorage`) — sie verbindet Ereignisse eines Besuchs und sonst nichts.
 */
function sessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return 'unavailable';
  }
}

export function readQueue(): TelemetryEvent[] {
  try {
    const raw = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    // Datengrenze → zod (AGENTS.md §8). Was nicht passt, ist ein Rest aus einer
    // aelteren Schemaversion und wird verworfen, nicht repariert.
    return raw.flatMap((item) => {
      const parsed = eventSchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    });
  } catch {
    return [];
  }
}

function writeQueue(events: TelemetryEvent[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(events.slice(-MAX_QUEUED_EVENTS)));
  } catch {
    // Speicher voll oder gesperrt: Telemetrie ist das Erste, was zurücktritt.
  }
}

/**
 * Nimmt ein Ereignis auf — oder eben nicht.
 *
 * Ist die Telemetrie aus, wird **gar nichts** geschrieben. Ein stiller Puffer
 * „für den Fall, dass jemand später zustimmt" wäre eine Sammlung ohne
 * Einwilligung, nur mit verzögertem Versand.
 */
export function recordTelemetryEvent(event: TelemetryEvent): void {
  if (!isTelemetryEnabled()) return;
  const [sanitized] = sanitizeEvents([event]);
  if (!sanitized) return;
  writeQueue([...readQueue(), sanitized]);
}

export function clearTelemetryQueue(): void {
  try {
    localStorage.removeItem(QUEUE_KEY);
  } catch {
    // nichts zu tun
  }
}

export function buildEnvelope(events: TelemetryEvent[], appVersion: string): TelemetryEnvelope {
  return {
    schema_version: TELEMETRY_SCHEMA_VERSION,
    session_id: sessionId(),
    app_version: appVersion,
    events: sanitizeEvents(events),
  };
}

export type FlushResult =
  | { status: 'sent'; events: number }
  | { status: 'skipped'; reason: 'disabled' | 'no-endpoint' | 'empty' }
  | { status: 'failed'; reason: string };

/**
 * Schickt die Warteschlange los. Die Warteschlange wird NUR bei bestätigtem
 * Empfang geleert — ein fehlgeschlagener Versand darf keine Ereignisse
 * verschlucken, sonst sieht die Auswertung eine heilere Welt als die echte.
 */
export async function flushTelemetry(appVersion: string): Promise<FlushResult> {
  if (!isTelemetryEnabled()) return { status: 'skipped', reason: 'disabled' };

  const target = endpoint();
  if (!target) return { status: 'skipped', reason: 'no-endpoint' };

  const queued = readQueue();
  if (queued.length === 0) return { status: 'skipped', reason: 'empty' };

  const envelope = buildEnvelope(queued, appVersion);

  // Letzte Kontrolle an der Ausgangstür. Schlaegt sie an, ist ein Fehler im
  // Bauteil davor — dann wird nicht gesendet und die Warteschlange verworfen,
  // damit dieselbe Nutzlast nicht beim naechsten Versuch erneut ansteht.
  const offending = containsForbiddenField(envelope);
  if (offending) {
    clearTelemetryQueue();
    return { status: 'failed', reason: `verbotenes Feld: ${offending}` };
  }

  try {
    const response = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envelope),
    });
    if (!response.ok) return { status: 'failed', reason: `HTTP ${response.status}` };
    clearTelemetryQueue();
    return { status: 'sent', events: envelope.events.length };
  } catch (error) {
    return { status: 'failed', reason: error instanceof Error ? error.message : 'Netzfehler' };
  }
}

/**
 * Widerruf: Schalter aus UND alles wegwerfen, was noch nicht gesendet wurde.
 *
 * Ein Widerruf, der die Warteschlange stehen lässt, ist keiner — beim nächsten
 * Einschalten gingen die alten Ereignisse mit hinaus.
 */
export function revokeTelemetryConsent(): void {
  clearTelemetryQueue();
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // nichts zu tun
  }
}
