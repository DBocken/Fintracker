/**
 * IBAN — Vereinheitlichung und Prüfsumme. Reine Zeichenkettenarbeit ohne I/O.
 *
 * `normalizeIban` lag zuvor im `transfer-service`, wodurch
 * `lib/merchant-fingerprint.ts` entgegen der Schichtrichtung nach oben
 * importieren musste (AGENTS.md §3).
 *
 * `isValidIban` lag aus demselben Grund falsch: in
 * `services/letter-parser-service.ts`, weil der Briefparser sie zuerst
 * brauchte. Eine reine Funktion ohne I/O gehört nach `src/lib/`, „auch wenn
 * nur ein Service sie heute ruft" — und wer sie aus einer Komponente rufen
 * will, zöge sonst den kompletten OCR-Briefparser mit.
 *
 * Die Trennung zwischen beiden ist Absicht: Vereinheitlichen darf nie
 * verwerfen. Der Händler-Fingerprint gruppiert auch über eine IBAN, die aus
 * dem Bank-Sync stammt und die niemand je bestätigt hat; ihn an ein Urteil zu
 * koppeln hiesse, Buchungen wegen einer fremden Datenqualität auseinander
 * fallen zu lassen.
 */

/** Vereinheitlicht eine IBAN (Leerzeichen weg, Großbuchstaben) für den Vergleich. */
export function normalizeIban(iban?: string | null): string | null {
  if (!iban) return null;
  const normalized = iban.replace(/\s+/g, '').toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

/**
 * Sollwerte je Land — ein billiger Vorfilter, **kein Zulassungsregister**.
 *
 * Ein hier nicht eingetragenes Land wird allein über Mod-97 beurteilt, sonst
 * wäre jede gültige norwegische IBAN „ungültig". Der Eintrag fängt den Fall
 * ab, in dem eine zu kurze oder zu lange Ziffernfolge die Prüfsumme zufällig
 * trifft (1 von 97).
 */
const IBAN_LENGTHS: Record<string, number> = {
  DE: 22, AT: 20, CH: 21, NL: 18, FR: 27, BE: 16, LU: 20, ES: 24, IT: 27, PL: 28,
};

/**
 * Sollwert-Länge eines Ländercodes, falls bekannt.
 *
 * Der Briefparser braucht sie über die Prüfung hinaus: Er schneidet aus einer
 * OCR-Zeile Kandidaten wachsender Länge heraus und kann eine Länge, die es für
 * das Land gar nicht gibt, überspringen, statt sie durch Mod-97 zu schicken.
 */
export function ibanLengthFor(countryCode: string): number | undefined {
  return IBAN_LENGTHS[countryCode.toUpperCase()];
}

/**
 * Prüft eine IBAN nach ISO 13616 (Mod-97-10, ISO 7064).
 *
 * Der Punkt ist nicht die Syntax, sondern der **Zahlendreher**: „…0532 0130 00"
 * und „…0532 0103 00" sind beide formal einwandfrei, und nur eines davon ist
 * das Konto des Nutzers.
 */
export function isValidIban(iban: string): boolean {
  const s = iban.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(s)) return false;
  const expected = IBAN_LENGTHS[s.slice(0, 2)];
  if (expected && s.length !== expected) return false;
  if (s.length < 15 || s.length > 34) return false;
  // Mod-97: erste 4 Zeichen ans Ende, Buchstaben → Zahlen (A=10 … Z=35)
  const rearranged = s.slice(4) + s.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const part = ch >= 'A' ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of part) remainder = (remainder * 10 + Number(d)) % 97;
  }
  return remainder === 1;
}
