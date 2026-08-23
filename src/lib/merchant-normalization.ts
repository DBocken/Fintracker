/**
 * Normalisiert Zahlungsempfänger-/Zahler-Strings für besseres Keyword-Matching.
 *
 * Beispiel: "PAYMENT 847261 REWE SAGT DANKE 3847 DE//MUENCHEN/2024-01-05"
 *        -> "rewe sagt danke"
 *
 * **Diese Funktion bestimmt, was EINE Händlerfamilie ist.** An ihr hängen der
 * Fingerprint (`merchant-fingerprint.ts`), damit die Vertragsableitung, die
 * Gehalts- und Schuldenerkennung, der Händlerfilter und die Merkmale des
 * gelernten Klassifikators. Jede Änderung hier verschiebt all das mit.
 *
 * Deshalb ist sie **idempotent**: Die eigene Ausgabe bleibt unverändert. Nur
 * so lassen sich ALT gespeicherte Werte (Händlerregel-Muster,
 * Vertragsentscheidungs-Fingerprints) durch erneutes Normalisieren in die
 * heutige Form überführen — ohne Datenmigration. Ein Test sichert das ab.
 */

/** Rechtsformen — auch die niederländischen/französischen aus Abo-Abrechnungen. */
const RECHTSFORMEN =
  /\b(gmbh\s*&\s*co\.?\s*kg|gmbh|mbh|se|ag|kg|ohg|e\.?\s*v\.?|ug|inc|ltd|co\.?|b\.?\s*v\.?|n\.?\s*v\.?|s\.?\s*a\.?\s*r\.?\s*l\.?|sarl|sas)\b\.?/g;

/** Zahlungsverkehrs-/Referenz-Begriffe. */
const ZAHLUNGSBEGRIFFE =
  /\b(kartenzahlung|payment|lastschrift|sepa|überweisung|ueberweisung|gutschrift|kauf|girocard|visa|mastercard|dauerauftrag)\b/g;

/**
 * Top-Level-Domains, die als Namensbestandteil nichts beitragen.
 *
 * Bewusst eine kurze Positivliste statt „alles nach dem letzten Punkt": Sonst
 * verlöre „Dr. Mueller" seinen Punkt und „b.v." liefe doppelt.
 */
const TLD = /\b([a-z0-9-]{2,})\.(com|de|net|org|eu|io|at|ch|shop|online|app)\b/g;

/** Alleinstehende Länderkürzel am Ende — Bankzusatz, kein Namensbestandteil. */
const LAENDERKUERZEL_AM_ENDE = /\s(de|at|ch|nl|fr|it|es|uk|us|eu|pl|cz|dk|se|no|fi|be|lu)$/;

export function normalizeMerchantName(raw: string | null | undefined): string {
  if (!raw) return "";

  let s = raw.toLowerCase();

  // Ort und Datum stehen bei Kartenzahlungen hinter einem DOPPELTEN
  // Schrägstrich ("…3847 DE//MUENCHEN/2024-01-05"). Der Schnitt ist bewusst
  // strukturell und nicht über eine Städteliste: Eine Wortliste deutscher Orte
  // wäre nie vollständig und verstümmelte echte Namen ("Frankfurter
  // Allgemeine", "Berliner Sparkasse"). Muss VOR dem Vereinheitlichen der
  // Trennzeichen laufen — danach ist die Grenze nicht mehr erkennbar.
  const ortsGrenze = s.indexOf("//");
  if (ortsGrenze > 0) s = s.slice(0, ortsGrenze);

  // TLD vor den Rechtsformen: "netflix.com" soll "netflix" werden, bevor
  // irgendeine andere Regel den Punkt anfasst.
  s = s.replace(TLD, "$1");

  s = s.replace(RECHTSFORMEN, " ");
  s = s.replace(ZAHLUNGSBEGRIFFE, " ");

  // Datumsmuster entfernen (DD.MM.YYYY, YYYY-MM-DD)
  s = s.replace(/\b\d{1,2}\.\d{1,2}\.\d{2,4}\b/g, " ");
  s = s.replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ");

  // Lange Ziffernfolgen (Referenznummern, Filialnummern) entfernen
  s = s.replace(/\b\d{3,}\b/g, " ");

  // Trennzeichen vereinheitlichen
  s = s.replace(/[\/\\|*#]+/g, " ");

  // Mehrfach-Leerzeichen zusammenfassen
  s = s.replace(/\s{2,}/g, " ").trim();

  // Zum Schluss: ein übrig gebliebenes Länderkürzel am Ende. Erst hier, weil
  // es vorher noch von Ziffern oder Trennzeichen umgeben sein kann.
  s = s.replace(LAENDERKUERZEL_AM_ENDE, "");

  return s.trim();
}

/**
 * Die Normalisierung, wie sie VOR der Ortszusatz-/TLD-Verschärfung aussah.
 *
 * **Existiert ausschließlich, um PERSISTIERTE Altwerte noch zu treffen** —
 * `merchantRules.merchant_pattern` und die Fingerprints in
 * `contractDecisions` wurden damit erzeugt und liegen unverändert im Speicher.
 *
 * Warum sie nicht durch erneutes Normalisieren ersetzbar ist: Bei TLDs und
 * Rechtsformen genügt das (die neue Funktion ist idempotent und führt
 * „netflix.com" auf „netflix"). Beim Ortszusatz nicht — im gespeicherten
 * „rewe sagt danke de muenchen" ist die Grenze `//` längst weg, und ob
 * „de muenchen" ein Ort war oder Teil des Namens, lässt sich daraus nicht
 * mehr entscheiden. Eine Datenmigration könnte es also auch nicht.
 *
 * Der einzig ehrliche Weg ist deshalb, die alte Form für den VERGLEICH
 * aufzuheben. Neue Werte entstehen immer mit `normalizeMerchantName`.
 *
 * **Abbaudatum: 2026-12-31.** Bis dahin hat jeder aktive Bestand seine Regeln
 * mindestens einmal neu geschrieben (jede manuelle Korrektur legt sie neu an);
 * danach darf diese Funktion samt ihrer Aufrufstellen entfallen.
 */
export function legacyNormalizeMerchantName(raw: string | null | undefined): string {
  if (!raw) return "";
  let s = raw.toLowerCase();
  s = s.replace(/\b(gmbh\s*&\s*co\.?\s*kg|gmbh|mbh|se|ag|kg|ohg|e\.?\s*v\.?|ug|inc|ltd|co\.?)\b\.?/g, " ");
  s = s.replace(
    /\b(kartenzahlung|payment|lastschrift|sepa|überweisung|ueberweisung|gutschrift|kauf|girocard|visa|mastercard|dauerauftrag)\b/g,
    " ",
  );
  s = s.replace(/\b\d{1,2}\.\d{1,2}\.\d{2,4}\b/g, " ");
  s = s.replace(/\b\d{4}-\d{2}-\d{2}\b/g, " ");
  s = s.replace(/\b\d{3,}\b/g, " ");
  s = s.replace(/[\/\\|*#]+/g, " ");
  s = s.replace(/\s{2,}/g, " ").trim();
  return s;
}
