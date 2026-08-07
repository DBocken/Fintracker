import { describe, it, expect } from 'vitest';
import {
  IBAN_PLACEHOLDER,
  MAX_FEEDBACK_LENGTH,
  MONEY_PLACEHOLDER,
  findSensitiveSpans,
  redactSensitive,
  validateFeedback,
} from '../feedback';

/**
 * [PRIVACY] WP-11.4 — Rückmeldung, ohne dass Beträge mitgehen.
 *
 * Der Fall, den das hier abfängt, entsteht aus Hilfsbereitschaft: „Bei der
 * Miete von 1.250 € stimmt die Kategorie nicht." Damit stünde ein Betrag in
 * einer Nachricht, die das Gerät verlässt — ausgerechnet, weil jemand helfen
 * wollte.
 *
 * Erkennen und Ersetzen sind getrennt, weil die Oberfläche zuerst *zeigen*
 * muss, worüber sie um Zustimmung bittet. Stilles Ersetzen wäre ein
 * Vertrauensbruch für sich.
 */

describe('findSensitiveSpans — Beträge', () => {
  it.each([
    ['Bei der Miete von 1.250,00 € stimmt etwas nicht', '1.250,00 €'],
    ['Es waren 1250 EUR', '1250 EUR'],
    ['Betrag: € 89,90', '€ 89,90'],
    ['Ich sehe 42 Euro zu viel', '42 Euro'],
    ['Das waren $1,250.00', '$1,250.00'],
    ['Summe 980.50 USD', '980.50 USD'],
  ])('sollte in %s den Betrag %s finden', (text, expected) => {
    expect(findSensitiveSpans(text).map((s) => s.text)).toContain(expected);
  });

  it.each(['1250 EUR', '12345 EUR', '999 €', '1.250,00 €'])(
    '[REGRESSION] sollte bei %s die Zahl VOLLSTAENDIG ersetzen',
    (text) => {
      // Der erste Entwurf verlangte Tausendertrenner und traf bei „1250 EUR"
      // nur „250 EUR" — uebrig blieb „1[Betrag]". Eine halb ersetzte Zahl ist
      // schlimmer als keine Erkennung: Sie sieht wie Schutz aus.
      expect(redactSensitive(text)).toBe(MONEY_PLACEHOLDER);
    },
  );

  it('sollte gewoehnliche Zahlen in Ruhe lassen', () => {
    // Sonst waere jede Rueckmeldung voller Platzhalter und niemand koennte
    // mehr beschreiben, was er meint.
    expect(findSensitiveSpans('Die Liste zeigt 12 Eintraege auf Seite 3')).toEqual([]);
  });

  it('sollte denselben Betrag nur einmal melden', () => {
    expect(findSensitiveSpans('100 € und nochmal 100 €')).toHaveLength(1);
  });
});

describe('findSensitiveSpans — IBAN', () => {
  it('sollte eine IBAN erkennen, auch in Vierergruppen', () => {
    const spans = findSensitiveSpans('Mein Konto DE89 3704 0044 0532 0130 00 fehlt');
    expect(spans).toEqual([{ text: 'DE89 3704 0044 0532 0130 00', kind: 'iban' }]);
  });

  it('sollte eine IBAN ohne Leerzeichen erkennen', () => {
    expect(findSensitiveSpans('DE89370400440532013000').map((s) => s.kind)).toEqual(['iban']);
  });
});

describe('redactSensitive', () => {
  it('[PRIVACY] sollte Betrag und IBAN durch Platzhalter ersetzen', () => {
    const text = 'Bei 1.250,00 € auf DE89 3704 0044 0532 0130 00 stimmt die Kategorie nicht';
    const redacted = redactSensitive(text);

    expect(redacted).toContain(MONEY_PLACEHOLDER);
    expect(redacted).toContain(IBAN_PLACEHOLDER);
    expect(redacted).not.toContain('1.250,00');
    expect(redacted).not.toContain('3704');
    // Die Aussage bleibt lesbar — das ist der Punkt.
    expect(redacted).toContain('stimmt die Kategorie nicht');
  });

  it('sollte einen unverfaenglichen Text unveraendert lassen', () => {
    const text = 'Der Knopf zum Speichern reagiert auf dem Handy nicht.';
    expect(redactSensitive(text)).toBe(text);
  });
});

describe('validateFeedback', () => {
  it('sollte eine leere Nachricht ablehnen', () => {
    expect(validateFeedback({ message: '   ' })).toEqual({ valid: false, reason: 'empty' });
  });

  it('sollte eine zu lange Nachricht ablehnen', () => {
    expect(validateFeedback({ message: 'x'.repeat(MAX_FEEDBACK_LENGTH + 1) })).toEqual({
      valid: false,
      reason: 'too-long',
    });
  });

  it('sollte eine gewoehnliche Nachricht annehmen', () => {
    expect(validateFeedback({ message: 'Der Export bricht ab.' })).toEqual({ valid: true });
  });
});
