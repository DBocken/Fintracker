/**
 * Normalisiert Zahlungsempfänger-/Zahler-Strings für besseres Keyword-Matching.
 *
 * Beispiel: "PAYMENT 847261 REWE SAGT DANKE 3847 DE//MUENCHEN/2024-01-05"
 *        -> "rewe sagt danke"
 */
export function normalizeMerchantName(raw: string | null | undefined): string {
  if (!raw) return "";

  let s = raw.toLowerCase();

  // Rechtsformen entfernen
  s = s.replace(/\b(gmbh\s*&\s*co\.?\s*kg|gmbh|mbh|se|ag|kg|ohg|e\.?\s*v\.?|ug|inc|ltd|co\.?)\b\.?/g, " ");

  // Zahlungsverkehrs-/Referenz-Begriffe entfernen
  s = s.replace(/\b(kartenzahlung|payment|lastschrift|sepa|überweisung|ueberweisung|gutschrift|kauf|girocard|visa|mastercard|dauerauftrag)\b/g, " ");

  // Datumsmuster entfernen (DD.MM.YYYY, YYYY-MM-DD)
  s = s.replace(/\b\d{1,2}\.\d{1,2}\.\d{2,4}\b/g, " ");
  s = s.replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ");

  // Lange Ziffernfolgen (Referenznummern, Filialnummern) entfernen
  s = s.replace(/\b\d{3,}\b/g, " ");

  // Trennzeichen vereinheitlichen
  s = s.replace(/[\/\\|*#]+/g, " ");

  // Mehrfach-Leerzeichen zusammenfassen
  s = s.replace(/\s{2,}/g, " ").trim();

  return s;
}
