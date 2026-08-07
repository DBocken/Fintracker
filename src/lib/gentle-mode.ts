/**
 * Sanfter Modus — die Maskierung von Geldbeträgen (WP-9.5).
 *
 * **Wofür der Modus da ist.** Er wird bei der Lebenssituationen-Auswahl für
 * `student_school`, `student_university`, `single_parent` und `debt_focus`
 * vorgeschlagen (`docs/onboarding-life-situations.md`) — also für belastende
 * Lagen. Es geht um **emotionale Entlastung**, nicht um Vertraulichkeit:
 * Wer gerade Schulden abbaut, soll die App benutzen können, ohne dass ihm bei
 * jedem Blick eine Zahl entgegenspringt.
 *
 * Das ist der Unterschied zum Privatsphäre-Schutz, der in dieser App über die
 * lokale Verschlüsselung läuft (`PrivacyIndicator`). Wer den Sanften Modus
 * einschaltet, versteckt seine Zahlen vor SICH, nicht vor anderen.
 *
 * **Warum die Maske hier steht und nicht an 78 Aufrufstellen.** Genau das war
 * der Befund: Maskiert wurde von Hand, an acht von 78 Dateien, mit drei
 * verschiedenen Masken (`***`, `••`, leer). In der Aufrufstelle ist das eine
 * Frage der Aufmerksamkeit; hier ist es eine Eigenschaft.
 */

/**
 * Die Maske für Geldbeträge.
 *
 * Drei Zeichen, weil ein einzelnes zu sehr nach „fehlt" aussieht und ein
 * langer Balken die Spaltenbreite sprengt. Bewusst nicht die tatsächliche
 * Stellenzahl nachgebildet: Aus `****.**` liesse sich die Grössenordnung
 * ablesen, und die ist genau das, was hier ruhen soll.
 */
export const GENTLE_AMOUNT_MASK = '***';

/**
 * Ersetzt einen bereits formatierten Betrag durch die Maske, wenn der Sanfte
 * Modus an ist.
 *
 * Nimmt bewusst den FERTIGEN String und nicht die Zahl: Die Formatierung
 * unterscheidet sich je Aufrufstelle (mit/ohne Nachkommastellen, mit
 * Vorzeichen, in einer anderen Währung) — diese Funktion soll sie nicht
 * vereinheitlichen, sondern nur verdecken.
 */
export function maskAmount(formatted: string, masked: boolean): string {
  return masked ? GENTLE_AMOUNT_MASK : formatted;
}
