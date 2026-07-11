import { redactSensitive } from './redact';

/**
 * Zentraler, local-only Logger (Vorbild: performanceMonitor in lib/performance).
 * KEIN Netzwerk-Code — Fehler verlassen das Gerät nie automatisch; der Nutzer
 * kann das redigierte Protokoll in den Einstellungen einsehen und teilen.
 *
 * Routing: warn/error werden (redigiert) ins lokale Fehlerprotokoll
 * persistiert; debug/info sind reine Konsolen-Ausgaben im Dev-Modus.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Nur strukturarme, PII-freie Kontext-Keys werden persistiert; Freitext
// (message) läuft durch redactSensitive. Payees o. Ä. lassen sich nicht
// zuverlässig per Regex fangen — deshalb Whitelist statt Blacklist.
const CONTEXT_WHITELIST = ['source', 'route', 'code', 'count'] as const;

export interface LogContext {
  source?: string;
  route?: string;
  code?: string;
  count?: number;
  [key: string]: unknown;
}

export interface PersistedLogEvent {
  level: 'warn' | 'error';
  message: string;
  context?: Partial<Record<(typeof CONTEXT_WHITELIST)[number], unknown>>;
}

export interface LoggerOptions {
  dev: boolean;
  persist: (event: PersistedLogEvent) => void;
}

function pickWhitelisted(context?: LogContext): PersistedLogEvent['context'] {
  if (!context) return undefined;
  const picked: Record<string, unknown> = {};
  for (const key of CONTEXT_WHITELIST) {
    if (context[key] !== undefined) picked[key] = context[key];
  }
  return Object.keys(picked).length > 0 ? picked : undefined;
}

export function createLogger({ dev, persist }: LoggerOptions) {
  const emit = (level: LogLevel, message: string, context?: LogContext) => {
    if (dev) {
      console[level](`[${level}]`, message, context ?? '');
    }
    if (level === 'warn' || level === 'error') {
      try {
        persist({
          level,
          message: redactSensitive(message),
          context: pickWhitelisted(context),
        });
      } catch {
        // Logging darf die App nie zum Absturz bringen.
      }
    }
  };

  return {
    debug: (message: string, context?: LogContext) => emit('debug', message, context),
    info: (message: string, context?: LogContext) => emit('info', message, context),
    warn: (message: string, context?: LogContext) => emit('warn', message, context),
    error: (message: string, context?: LogContext) => emit('error', message, context),
  };
}

export type Logger = ReturnType<typeof createLogger>;

// Lazy-Import bricht den Zyklus logger → error-log-service → redact und hält
// den Logger frei von IndexedDB-Kosten, solange kein warn/error auftritt.
export const logger: Logger = createLogger({
  dev: import.meta.env.DEV,
  persist: (event) => {
    void import('@/services/error-log-service').then(({ appendErrorLogEntry }) =>
      appendErrorLogEntry({
        level: event.level,
        source: 'manual',
        message: event.message,
        context: event.context,
      }),
    );
  },
});
