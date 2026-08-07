import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  containsForbiddenField,
  isForbiddenField,
  sanitizeEvent,
  sanitizeEvents,
  type TelemetryEvent,
} from '@/lib/telemetry-events';

/**
 * [SECURITY] WP-11.2 — „Beträge dürfen das Gerät nicht verlassen."
 *
 * Das ist nicht meine Formulierung, sondern der Wortlaut der Entscheidung
 * F-1 im `decision-log`. Eine Zusage dieser Art ist nur so viel wert wie ihre
 * Durchsetzung: Sie steht sonst in einem Dokument, und der Code tut, was
 * gerade praktisch war.
 *
 * Diese Datei ist die Durchsetzung. Sie prüft drei Dinge, die zusammen die
 * Lücke schliessen:
 *
 * 1. Der Filter lässt nur die erlaubten Felder durch (Positivliste).
 * 2. Die Kontrolle an der Ausgangstür findet verbotene Felder in beliebiger
 *    Verschachtelung.
 * 3. **Es gibt genau eine Stelle im Code, die senden kann.** Ohne diesen Punkt
 *    wären 1 und 2 wertlos: Ein zweites `fetch` an anderer Stelle umginge
 *    beide, ohne dass ein Test rot würde.
 */

describe('[SECURITY] Telemetrie sendet keine Finanzdaten', () => {
  it('sollte Betragsfelder in jeder Schreibweise erkennen', () => {
    for (const field of [
      'amount',
      'amountMinor',
      'Betrag',
      'betrag_soll',
      'saldo_neu',
      'balance',
      'expense_sum',
      'summe',
      'iban',
      'payee',
      'empfaenger',
      'description',
      'notiz',
      'accountName',
      'email',
      'access_token',
      'passwort',
    ]) {
      expect(isForbiddenField(field), field).toBe(true);
    }
  });

  it('sollte erlaubte Felder nicht faelschlich verwerfen', () => {
    for (const field of ['type', 'route', 'kind', 'metric', 'value', 'feature', 'session_id']) {
      expect(isForbiddenField(field), field).toBe(false);
    }
  });

  it('[REGRESSION] sollte ein untergeschobenes Feld aus dem Ereignis streichen', () => {
    // Der realistische Fall: Beim Suchen eines Fehlers haengt jemand den
    // Betrag an — nicht aus boesem Willen, sondern weil er gerade nuetzlich
    // war. Der Filter arbeitet mit einer Positivliste, deshalb faellt es raus,
    // ohne dass die Verbotsliste den Namen kennen muss.
    const smuggled = {
      type: 'error',
      kind: 'query_failed',
      route: '/transactions',
      amount: -42.5,
      debugPayload: { saldo: 1234 },
    } as unknown as TelemetryEvent;

    const cleaned = sanitizeEvent(smuggled);

    expect(cleaned).toEqual({ type: 'error', kind: 'query_failed', route: '/transactions' });
    expect(containsForbiddenField(cleaned)).toBeNull();
  });

  it('sollte die Kennung aus einer Route entfernen', () => {
    // `/transactions?tx=abc123` benennt eine EINZELNE Buchung. Fuer die
    // Aussage „jemand war im Buchungsbereich" reicht der Pfad.
    const cleaned = sanitizeEvent({ type: 'screen_view', route: '/transactions?tx=abc123' });
    expect(cleaned).toEqual({ type: 'screen_view', route: '/transactions' });
  });

  it('sollte eine Route verwerfen, die wie freier Text aussieht', () => {
    // Eine Route, die nicht dem Muster folgt, ist keine Route — dann steht
    // dort etwas anderes, und das geht nicht mit hinaus.
    expect(sanitizeEvent({ type: 'screen_view', route: 'Miete Januar 1.250 EUR' })).toBeNull();
  });

  it('sollte verbotene Felder in beliebiger Verschachtelung finden', () => {
    expect(containsForbiddenField({ a: { b: [{ c: { amount: 1 } }] } })).toBe('a.b.0.c.amount');
    expect(containsForbiddenField({ a: { b: [{ c: { route: '/x' } }] } })).toBeNull();
  });

  it('sollte unbrauchbare Ereignisse ganz weglassen statt sie halb zu senden', () => {
    const events = [
      { type: 'performance', route: '/dashboard', metric: 'lcp', value: 'schnell' },
      { type: 'screen_view', route: '/dashboard' },
    ] as unknown as TelemetryEvent[];

    expect(sanitizeEvents(events)).toEqual([{ type: 'screen_view', route: '/dashboard' }]);
  });
});

describe('[SECURITY] Es gibt genau einen Versandweg', () => {
  /**
   * Ohne diese Pruefung waeren die Filter oben Zierde: Wer an anderer Stelle
   * ein `fetch` auf den Telemetrie-Endpunkt setzt, umgeht sie vollstaendig,
   * und kein bestehender Test wuerde rot.
   */
  const SRC = resolve(__dirname, '..');

  function collect(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
        collect(full, out);
      } else if (
        (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
        // Tests zaehlen nicht als Versandweg. `src/security/*.security.test.ts`
        // liegt bewusst NEBEN dem Code (AGENTS.md §5) — diese Datei hier faende
        // sonst sich selbst, weil sie den Namen der Variablen nennt.
        !entry.name.includes('.test.')
      ) {
        out.push(full);
      }
    }
    return out;
  }

  it('sollte den Endpunkt nur im Telemetrie-Dienst lesen', () => {
    const users = collect(SRC)
      .filter((file) => readFileSync(file, 'utf8').includes('VITE_TELEMETRY_ENDPOINT'))
      .map((file) => file.slice(SRC.length + 1).split('\\').join('/'));

    expect(users).toEqual(['services/telemetry-service.ts']);
  });

  it('sollte den Endpunkt ohne Rueckfallwert lesen', () => {
    // Ein `?? "https://…"` waere ein Versandziel, das niemand konfiguriert hat
    // — und damit ein Versand, den niemand entschieden hat.
    const source = readFileSync(join(SRC, 'services/telemetry-service.ts'), 'utf8');
    expect(source).not.toMatch(/VITE_TELEMETRY_ENDPOINT\s*(\?\?|\|\|)/);
  });
});
