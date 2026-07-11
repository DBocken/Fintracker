/**
 * Redaktion sensibler Finanzdaten aus Freitext (Fehlermeldungen, Stacktraces),
 * BEVOR er das lokale Fehlerprotokoll erreicht. Das Protokoll ist bewusst
 * unverschlüsselt (muss pre-unlock lesbar sein) — deshalb dürfen IBANs,
 * Beträge und E-Mails es nie im Klartext erreichen.
 */

// IBAN: Ländercode + 2 Prüfziffern + 10–30 Stellen, optional in 4er-Gruppen
// mit Leerzeichen. Die Gruppen-Variante zuerst matchen, sonst bleibt der
// Leerzeichen-Rest stehen.
const IBAN_GROUPED = /\b[A-Z]{2}\d{2}(?:\s[A-Z0-9]{2,4}){3,8}\b/g;
const IBAN_COMPACT = /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g;

// Beträge im deutschen Format: "1.234,56 €", "€ 500,00", "42,10 EUR".
// Bewusst NUR Formen mit Dezimal-Komma + Währungszeichen — nackte Zahlen
// (Zeilennummern, Chunk-Namen, Dauern) bleiben unangetastet.
const AMOUNT_SUFFIX = /\d{1,3}(?:\.\d{3})*,\d{2}\s?(?:€|EUR\b)/g;
const AMOUNT_PREFIX = /€\s?\d{1,3}(?:\.\d{3})*,\d{2}\b/g;

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;

export function redactSensitive(text: string): string {
  return text
    .replace(IBAN_GROUPED, '[IBAN]')
    .replace(IBAN_COMPACT, '[IBAN]')
    .replace(AMOUNT_SUFFIX, '[AMOUNT]')
    .replace(AMOUNT_PREFIX, '[AMOUNT]')
    .replace(EMAIL, '[EMAIL]');
}
