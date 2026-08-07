/**
 * Telemetrie-Ereignisse (WP-11.2) — reine Domänenlogik, kein React, kein I/O.
 *
 * **Die Entscheidung, die hier umgesetzt wird.** `decision-log` F-1: Opt-in mit
 * Versand, standardmäßig aus, anonymisiert — und ausdrücklich: *Beträge dürfen
 * das Gerät nicht verlassen.* Gesendet werden Bereichsaufrufe, Fehler und
 * Performance-Werte. Nichts über das, was jemand ausgibt.
 *
 * **Warum das eine geschlossene Liste ist und kein `Record<string, unknown>`.**
 * Ein freies Feld ist genau die Stelle, an der irgendwann ein Betrag landet —
 * nicht aus bösem Willen, sondern weil er beim Debuggen gerade nützlich war.
 * Die App ist local-first (AGENTS.md §1); dieses Versprechen an einer Stelle zu
 * brechen macht es überall wertlos. Deshalb:
 *
 * 1. Jedes Ereignis hat eine feste Form. Es gibt keinen freien Nutzlast-Teil.
 * 2. Was doch hineingerät, filtert `sanitizeEvent` heraus.
 * 3. Dass beides zusammenpasst, prüft `src/security/telemetry.security.test.ts`.
 *
 * Die drei Stufen sind Absicht: Die Typen halten den ehrlichen Fehler ab, der
 * Filter den unaufmerksamen, der Test die spätere Änderung.
 */

/** Version des Ereignis-Schemas. Steigt, wenn sich die Form ändert. */
export const TELEMETRY_SCHEMA_VERSION = 1;

export type TelemetryEvent =
  | {
      type: 'screen_view';
      /** Route ohne Abfrageteil — `/transactions`, nie `/transactions?tx=abc123`. */
      route: string;
    }
  | {
      type: 'error';
      /** Klasse des Fehlers, nicht seine Nachricht. */
      kind: 'query_failed' | 'render_crash' | 'storage_unavailable' | 'import_failed';
      /** Bereich, in dem er auftrat. */
      route: string;
    }
  | {
      type: 'performance';
      route: string;
      metric: 'lcp' | 'cls' | 'interaction';
      /** Millisekunden bzw. dimensionsloser CLS-Wert. */
      value: number;
    }
  | {
      type: 'feature_used';
      /** Feste Kennung einer Funktion — nie ein vom Nutzer vergebener Name. */
      feature: string;
    };

export type TelemetryEnvelope = {
  schema_version: typeof TELEMETRY_SCHEMA_VERSION;
  /**
   * Zufällige Kennung PRO SITZUNG, nicht pro Gerät und nicht pro Person. Sie
   * verbindet die Ereignisse eines Besuchs, damit ein Fehler seinem Bereich
   * zuzuordnen ist — und ist nach dem Schliessen wertlos.
   */
  session_id: string;
  app_version: string;
  events: TelemetryEvent[];
};

/**
 * Feldnamen, die niemals in einem Ereignis stehen dürfen.
 *
 * Die Liste ist keine Vollständigkeitsbehauptung — sie ist das Netz unter den
 * Typen. Geprüft wird auf Teilzeichenketten, damit `amountMinor`, `betrag_soll`
 * und `saldo_neu` genauso hängenbleiben wie `amount`.
 */
const FORBIDDEN_FIELD_PARTS = [
  'amount',
  'betrag',
  'saldo',
  'balance',
  'sum',
  'summe',
  'iban',
  'payee',
  'empfaenger',
  'empfänger',
  'description',
  'beschreibung',
  'note',
  'notiz',
  'name',
  'email',
  'mail',
  'token',
  'password',
  'passwort',
] as const;

export function isForbiddenField(field: string): boolean {
  const lower = field.toLowerCase();
  return FORBIDDEN_FIELD_PARTS.some((part) => lower.includes(part));
}

/** Die Felder, die ein Ereignis der jeweiligen Art führen darf. */
const ALLOWED_FIELDS: Record<TelemetryEvent['type'], readonly string[]> = {
  screen_view: ['type', 'route'],
  error: ['type', 'kind', 'route'],
  performance: ['type', 'route', 'metric', 'value'],
  feature_used: ['type', 'feature'],
};

/** Routen, die als Ereignis auftauchen dürfen — alles andere wird verworfen. */
const ROUTE_PATTERN = /^\/[a-z0-9-]*(\/[a-z0-9-]+)*$/;

/**
 * Streicht alles, was nicht ausdrücklich erlaubt ist.
 *
 * Bewusst „erlauben" statt „verbieten": Eine Verbotsliste ist immer einen
 * Schritt hinter dem nächsten Feld, das jemand hinzufügt.
 */
export function sanitizeEvent(event: TelemetryEvent): TelemetryEvent | null {
  const allowed = ALLOWED_FIELDS[event.type];
  if (!allowed) return null;

  const out: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(event)) {
    if (!allowed.includes(field)) continue;
    if (isForbiddenField(field)) continue;
    out[field] = value;
  }

  // Eine Route mit Abfrageteil kann eine Buchungs-Kennung tragen
  // (`/transactions?tx=…`). Der Pfad allein reicht für die Aussage.
  if (typeof out.route === 'string') {
    const path = out.route.split('?')[0].split('#')[0];
    if (!ROUTE_PATTERN.test(path)) return null;
    out.route = path;
  }

  if (out.type === 'performance' && typeof out.value !== 'number') return null;
  if (out.type === 'feature_used' && typeof out.feature !== 'string') return null;

  return out as TelemetryEvent;
}

export function sanitizeEvents(events: TelemetryEvent[]): TelemetryEvent[] {
  return events.map(sanitizeEvent).filter((event): event is TelemetryEvent => event !== null);
}

/**
 * Letzte Kontrolle vor dem Versand: Enthält die fertige Nutzlast irgendwo einen
 * verbotenen Feldnamen?
 *
 * Doppelt gemoppelt gegenüber `sanitizeEvent` — und genau das ist der Zweck.
 * Diese Prüfung sieht die Nutzlast so, wie sie das Gerät verlässt, unabhängig
 * davon, wie sie zustande kam.
 */
export function containsForbiddenField(payload: unknown, path: string[] = []): string | null {
  if (Array.isArray(payload)) {
    for (const [index, item] of payload.entries()) {
      const found = containsForbiddenField(item, [...path, String(index)]);
      if (found) return found;
    }
    return null;
  }
  if (typeof payload === 'object' && payload !== null) {
    for (const [field, value] of Object.entries(payload)) {
      if (isForbiddenField(field)) return [...path, field].join('.');
      const found = containsForbiddenField(value, [...path, field]);
      if (found) return found;
    }
  }
  return null;
}
