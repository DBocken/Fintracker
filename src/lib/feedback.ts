/**
 * Rückmeldung aus der App heraus (WP-11.4) — reine Logik, kein I/O.
 *
 * **Der Grund, warum das mehr ist als ein Textfeld.** Eine Fehlermeldung ist
 * ohne Umstände die gefährlichste Nachricht dieser App: Menschen fügen
 * hilfsbereit ein, was gerade auf dem Bildschirm stand — „bei der Miete von
 * 1.250 € stimmt die Kategorie nicht". Damit stünde ein Betrag in einer
 * Nachricht, die das Gerät verlässt, und zwar ausgerechnet, weil jemand helfen
 * wollte.
 *
 * Das lässt sich nicht verbieten, ohne die Rückmeldung unbrauchbar zu machen.
 * Also drei Dinge, in dieser Reihenfolge:
 *
 * 1. **Erkennen** (`findMoneyLikeSpans`): Beträge im freien Text finden.
 * 2. **Zeigen** (Aufgabe der Oberfläche): Die Person sieht VOR dem Absenden,
 *    was auffällig ist, und entscheidet selbst.
 * 3. **Ersetzen** (`redactMoneyLike`): Wer zustimmt, sendet den Text mit
 *    Platzhaltern statt Zahlen.
 *
 * Bewusst NICHT stilles Ersetzen: Eine Nachricht, die anders ankommt als
 * abgeschickt, ist ein Vertrauensbruch für sich — und die verstümmelte
 * Meldung wäre obendrein wertlos.
 */

/** Was anstelle eines erkannten Betrags im Text steht. */
export const MONEY_PLACEHOLDER = '[Betrag]';

/**
 * Muster für Geldbeträge in freiem Text.
 *
 * Deutsche und englische Schreibweise, Währung vor oder nach der Zahl, mit und
 * ohne Tausendertrenner. Bewusst grosszügig: Ein falscher Treffer kostet ein
 * ersetztes Wort, ein übersehener kostet das Versprechen.
 */
/**
 * Der Zahlteil, jeweils als Alternative: **entweder** mit Tausendertrennern
 * gruppiert **oder** eine durchgehende Ziffernfolge.
 *
 * [REGRESSION] Ohne die zweite Alternative traf `\d{1,3}(?:[.\s]\d{3})*` bei
 * „1250 EUR" nur „250 EUR" — der Ersatz hätte „Es waren 1[Betrag]" ergeben und
 * damit die führende Ziffer stehen lassen. Eine halb ersetzte Zahl ist
 * schlimmer als gar keine Erkennung, weil sie wie Schutz aussieht.
 */
const DE_NUMBER = String.raw`(?:\d{1,3}(?:[.\s]\d{3})+|\d+)(?:,\d{1,2})?`;
const EN_NUMBER = String.raw`(?:\d{1,3}(?:[,\s]\d{3})+|\d+)(?:\.\d{1,2})?`;

const MONEY_PATTERNS = [
  // 1.250,00 € · 1250 € · 1.250,00 EUR
  new RegExp(String.raw`${DE_NUMBER}\s?(?:€|EUR\b|Euro\b)`, 'gi'),
  // € 1.250,00 · EUR 1250
  new RegExp(String.raw`(?:€|EUR\b|Euro\b)\s?${DE_NUMBER}`, 'gi'),
  // 1,250.00 USD · 1250.00 GBP
  new RegExp(String.raw`(?:[$£]\s?)?${EN_NUMBER}\s?(?:USD|GBP|CHF)\b`, 'gi'),
  // $1,250.00 · £89.90
  new RegExp(String.raw`[$£]\s?${EN_NUMBER}`, 'g'),
];

/**
 * IBAN-ähnliche Ketten. Zwei Buchstaben, zwei Ziffern, dann mindestens zehn
 * weitere Zeichen — auch mit Leerzeichen gruppiert, wie man sie abschreibt.
 */
const IBAN_PATTERN = /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,8}[ ]?[A-Z0-9]{1,4}\b/g;
export const IBAN_PLACEHOLDER = '[IBAN]';

export type SensitiveSpan = { text: string; kind: 'money' | 'iban' };

/**
 * Findet auffällige Stellen — ohne etwas zu verändern.
 *
 * Getrennt vom Ersetzen, weil die Oberfläche zuerst *zeigen* muss, worüber sie
 * um Zustimmung bittet.
 */
export function findSensitiveSpans(text: string): SensitiveSpan[] {
  const found: SensitiveSpan[] = [];
  const seen = new Set<string>();

  for (const match of text.match(IBAN_PATTERN) ?? []) {
    if (seen.has(match)) continue;
    seen.add(match);
    found.push({ text: match, kind: 'iban' });
  }

  for (const pattern of MONEY_PATTERNS) {
    for (const match of text.match(pattern) ?? []) {
      const trimmed = match.trim();
      if (seen.has(trimmed)) continue;
      // Eine IBAN kann Ziffernfolgen enthalten, die wie ein Betrag aussehen —
      // sie ist bereits erfasst und wird nicht doppelt gemeldet.
      if ([...seen].some((existing) => existing.includes(trimmed))) continue;
      seen.add(trimmed);
      found.push({ text: trimmed, kind: 'money' });
    }
  }

  return found;
}

/** Ersetzt die erkannten Stellen durch Platzhalter. */
export function redactSensitive(text: string): string {
  let out = text.replace(IBAN_PATTERN, IBAN_PLACEHOLDER);
  for (const pattern of MONEY_PATTERNS) {
    out = out.replace(pattern, MONEY_PLACEHOLDER);
  }
  return out;
}

export const MAX_FEEDBACK_LENGTH = 2000;

export type FeedbackDraft = {
  message: string;
  /** Freiwillig: ohne Kontakt keine Rückfrage, aber auch keine Adresse. */
  contact?: string;
};

export type FeedbackValidation =
  | { valid: true }
  | { valid: false; reason: 'empty' | 'too-long' };

export function validateFeedback(draft: FeedbackDraft): FeedbackValidation {
  const message = draft.message.trim();
  if (message.length === 0) return { valid: false, reason: 'empty' };
  if (message.length > MAX_FEEDBACK_LENGTH) return { valid: false, reason: 'too-long' };
  return { valid: true };
}
