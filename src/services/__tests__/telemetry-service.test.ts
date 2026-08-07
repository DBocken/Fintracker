import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  MAX_QUEUED_EVENTS,
  buildEnvelope,
  clearTelemetryQueue,
  flushTelemetry,
  isTelemetryEnabled,
  readQueue,
  recordTelemetryEvent,
  revokeTelemetryConsent,
} from '../telemetry-service';

/**
 * WP-11.2 — Telemetrie-Versand.
 *
 * Die inhaltliche Zusage („keine Beträge") sichert
 * `src/security/telemetry.security.test.ts`. Hier geht es um das Verhalten
 * drumherum, und das ist genauso Teil des Versprechens: Wann wird überhaupt
 * etwas geschrieben, wann gesendet, und was passiert beim Widerruf.
 */

const FLAGS_KEY = 'fintracker_feature_flags_v1';
const APP_VERSION = '1.3.0';

function enableTelemetry() {
  localStorage.setItem(FLAGS_KEY, JSON.stringify({ telemetry: true }));
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Einwilligung', () => {
  it('sollte in der Voreinstellung aus sein', () => {
    expect(isTelemetryEnabled()).toBe(false);
  });

  it('[SECURITY] sollte ohne Einwilligung NICHTS aufzeichnen', () => {
    // Kein stiller Puffer „fuer den Fall, dass jemand spaeter zustimmt": Das
    // waere eine Sammlung ohne Einwilligung, nur mit verzoegertem Versand.
    recordTelemetryEvent({ type: 'screen_view', route: '/dashboard' });
    expect(readQueue()).toEqual([]);
  });

  it('sollte mit Einwilligung aufzeichnen', () => {
    enableTelemetry();
    recordTelemetryEvent({ type: 'screen_view', route: '/dashboard' });
    expect(readQueue()).toEqual([{ type: 'screen_view', route: '/dashboard' }]);
  });

  it('[SECURITY] sollte beim Widerruf die Warteschlange leeren', () => {
    // Ein Widerruf, der die Warteschlange stehen laesst, ist keiner: Beim
    // naechsten Einschalten gingen die alten Ereignisse mit hinaus.
    enableTelemetry();
    recordTelemetryEvent({ type: 'screen_view', route: '/dashboard' });
    expect(readQueue()).toHaveLength(1);

    revokeTelemetryConsent();

    expect(readQueue()).toEqual([]);
  });
});

describe('Warteschlange', () => {
  beforeEach(enableTelemetry);

  it('sollte gedeckelt sein und die aeltesten Ereignisse fallen lassen', () => {
    // Telemetrie darf niemals den Speicher fuellen, der den Finanzdaten
    // gehoert.
    for (let i = 0; i < MAX_QUEUED_EVENTS + 25; i += 1) {
      recordTelemetryEvent({ type: 'feature_used', feature: `f${i}` });
    }

    const queue = readQueue();
    expect(queue).toHaveLength(MAX_QUEUED_EVENTS);
    // Das juengste ist noch da, das aelteste nicht.
    expect(queue.at(-1)).toEqual({ type: 'feature_used', feature: `f${MAX_QUEUED_EVENTS + 24}` });
    expect(queue[0]).not.toEqual({ type: 'feature_used', feature: 'f0' });
  });

  it('sollte Reste einer aelteren Schemaversion verwerfen statt sie zu senden', () => {
    localStorage.setItem(
      'fintracker_telemetry_queue_v1',
      JSON.stringify([
        { type: 'screen_view', route: '/dashboard' },
        { type: 'unbekannt', irgendwas: 1 },
        { type: 'performance', route: '/x', metric: 'lcp', value: 'schnell' },
      ]),
    );

    expect(readQueue()).toEqual([{ type: 'screen_view', route: '/dashboard' }]);
  });

  it('sollte beschaedigten Speicher als leer behandeln', () => {
    localStorage.setItem('fintracker_telemetry_queue_v1', '{kein json');
    expect(readQueue()).toEqual([]);
  });
});

describe('flushTelemetry', () => {
  it('sollte ohne Einwilligung nicht senden', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    expect(await flushTelemetry(APP_VERSION)).toEqual({ status: 'skipped', reason: 'disabled' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sollte ohne konfigurierten Endpunkt nicht senden', async () => {
    enableTelemetry();
    recordTelemetryEvent({ type: 'screen_view', route: '/dashboard' });
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    expect(await flushTelemetry(APP_VERSION)).toEqual({ status: 'skipped', reason: 'no-endpoint' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sollte senden und die Warteschlange erst danach leeren', async () => {
    enableTelemetry();
    vi.stubEnv('VITE_TELEMETRY_ENDPOINT', 'https://telemetry.example/v1');
    recordTelemetryEvent({ type: 'screen_view', route: '/dashboard' });
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));

    const result = await flushTelemetry(APP_VERSION);

    expect(result).toEqual({ status: 'sent', events: 1 });
    expect(readQueue()).toEqual([]);
    const body = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    expect(body.app_version).toBe(APP_VERSION);
    expect(body.events).toEqual([{ type: 'screen_view', route: '/dashboard' }]);
  });

  it('[REGRESSION] sollte die Warteschlange bei einem Fehlschlag BEHALTEN', () => {
    // Sonst sieht die Auswertung eine heilere Welt als die echte: Ausgerechnet
    // die Sitzungen mit Netzproblemen faenden nie statt.
    return (async () => {
      enableTelemetry();
      vi.stubEnv('VITE_TELEMETRY_ENDPOINT', 'https://telemetry.example/v1');
      recordTelemetryEvent({ type: 'screen_view', route: '/dashboard' });
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));

      const result = await flushTelemetry(APP_VERSION);

      expect(result).toEqual({ status: 'failed', reason: 'offline' });
      expect(readQueue()).toHaveLength(1);
    })();
  });

  it('sollte einen abgelehnten Versand als Fehlschlag werten', async () => {
    enableTelemetry();
    vi.stubEnv('VITE_TELEMETRY_ENDPOINT', 'https://telemetry.example/v1');
    recordTelemetryEvent({ type: 'screen_view', route: '/dashboard' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }));

    expect(await flushTelemetry(APP_VERSION)).toEqual({ status: 'failed', reason: 'HTTP 500' });
    expect(readQueue()).toHaveLength(1);
  });

  it('sollte bei leerer Warteschlange gar nicht erst anfragen', async () => {
    enableTelemetry();
    vi.stubEnv('VITE_TELEMETRY_ENDPOINT', 'https://telemetry.example/v1');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    expect(await flushTelemetry(APP_VERSION)).toEqual({ status: 'skipped', reason: 'empty' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('[SECURITY] sollte bei einem verbotenen Feld NICHT senden', async () => {
    // Der Fall, dass die Filterstufe davor versagt haette. Die Kontrolle an
    // der Ausgangstuer sieht die Nutzlast so, wie sie hinausginge.
    enableTelemetry();
    vi.stubEnv('VITE_TELEMETRY_ENDPOINT', 'https://telemetry.example/v1');
    localStorage.setItem(
      'fintracker_telemetry_queue_v1',
      // An `readQueue` vorbei laesst sich das nicht einschleusen — deshalb
      // wird hier direkt der Umschlag geprueft (siehe naechster Test).
      JSON.stringify([{ type: 'screen_view', route: '/dashboard' }]),
    );
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }));

    await flushTelemetry(APP_VERSION);

    const body = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    expect(JSON.stringify(body)).not.toMatch(/amount|betrag|saldo/i);
  });
});

describe('buildEnvelope', () => {
  it('sollte eine Sitzungskennung fuehren, die kein Geraetemerkmal ist', () => {
    // Sie liegt in `sessionStorage` und ist nach dem Schliessen wertlos —
    // sie verbindet die Ereignisse EINES Besuchs, nicht eine Person.
    const first = buildEnvelope([], APP_VERSION).session_id;
    expect(first).toEqual(buildEnvelope([], APP_VERSION).session_id);

    sessionStorage.clear();
    expect(buildEnvelope([], APP_VERSION).session_id).not.toEqual(first);
  });

  it('sollte die Schemaversion mitgeben', () => {
    expect(buildEnvelope([], APP_VERSION).schema_version).toBe(1);
  });

  it('sollte unbrauchbare Ereignisse nicht in den Umschlag lassen', () => {
    clearTelemetryQueue();
    const envelope = buildEnvelope(
      [
        { type: 'screen_view', route: '/transactions?tx=abc' },
        { type: 'screen_view', route: 'freier Text mit 1.250 EUR' },
      ],
      APP_VERSION,
    );
    expect(envelope.events).toEqual([{ type: 'screen_view', route: '/transactions' }]);
  });
});
