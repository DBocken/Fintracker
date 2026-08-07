/**
 * Sanfter Modus — die Annäherungsleiter für Geldbeträge (WP-9.5, erweitert).
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
 *
 * **Warum der Modus nicht binär ist.** Ein Versteck ohne Rückweg lehrt „ich
 * kann Finanzen nur ertragen, solange ich die Zahlen nicht sehe" — die Maske
 * wäre dann selbst die Vermeidungsstrategie. Deshalb ist der Modus eine
 * **Leiter**: `***` ist der Anfang, nicht der Endzustand. Die Begründung, die
 * Reihenfolge der Stufen und die Regeln für die Einladung nach unten stehen in
 * `docs/debt-avoidance-recovery.md` — vor Änderungen hier zuerst lesen.
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
 * Wie viel jemand sich heute zutraut. `0` ist aus, `3` ist alles verdeckt.
 *
 * Ordinal und nicht zwei Felder (ein Schalter plus eine Stufe), weil zwei
 * Felder zwei Wahrheiten über denselben Sachverhalt wären und auseinander
 * liefen, sobald eines von beiden vergessen wird.
 */
export type GentleLevel = 0 | 1 | 2 | 3;

/**
 * Die Klasse eines Betrags — sie entscheidet, ab welcher Stufe er ruht.
 *
 * - `installment` — der **eine** als Nächstes fällige Betrag. Ihn braucht man,
 *   um zu handeln, und er ist der am wenigsten belastende.
 * - `progress` — was schon geschafft ist. Fortschritt sichtbar zu machen ist
 *   der Teil, der nachweislich trägt (Harkin et al. 2016).
 * - `total` — Summen, Salden, die Gesamtschuld. Die Zahl mit der meisten Scham
 *   und deshalb die letzte, die wieder auftaucht.
 */
export type AmountKind = 'total' | 'installment' | 'progress';

/**
 * Die geschützteste Klasse. Sie ist die Voreinstellung, weil eine Aufrufstelle
 * ohne Angabe nichts über ihren Betrag behauptet — und ein vergessenes
 * Argument nie zu einer unerwartet sichtbaren Zahl führen darf. Der Fehler
 * fällt in Richtung Maske.
 */
export const DEFAULT_AMOUNT_KIND: AmountKind = 'total';

/**
 * Ab welcher Stufe eine Klasse verdeckt wird.
 *
 * Die Reihenfolge ist der Kern der Leiter: Beim Abstieg von 3 nach 0 wird
 * zuerst sichtbar, was man zum **Handeln** braucht, dann was **Fortschritt**
 * zeigt, und zuletzt die Zahl, die am meisten weh tut.
 */
const MASKED_FROM: Record<AmountKind, GentleLevel> = {
  installment: 3,
  progress: 2,
  total: 1,
};

/** Die Stufen in der Reihenfolge, in der sie angeboten werden: verdeckt zuerst. */
export const GENTLE_LEVELS: readonly GentleLevel[] = [3, 2, 1, 0];

/**
 * Sprechende Kennungen der Stufen für i18n-Schlüssel.
 *
 * Nicht die Ziffer im Schlüssel, weil `gentleMode.level.2.label` niemandem
 * sagt, was gemeint ist — und weil eine später eingeschobene Stufe sonst alle
 * Schlüssel verschieben würde.
 */
export const GENTLE_LEVEL_IDS = {
  3: 'arrival',
  2: 'nextStep',
  1: 'progress',
  0: 'off',
} as const satisfies Record<GentleLevel, string>;

export type GentleLevelId = (typeof GENTLE_LEVEL_IDS)[GentleLevel];

/** Prüft, ob ein Betrag dieser Klasse auf dieser Stufe ruht. */
export function isAmountMasked(level: GentleLevel, kind: AmountKind = DEFAULT_AMOUNT_KIND): boolean {
  // `?? MASKED_FROM[DEFAULT_AMOUNT_KIND]`: eine unbekannte Klasse (aus JS
  // heraus, aus einem Test-Mock) darf nicht zu „nicht maskiert" führen — sonst
  // wäre ein Tippfehler im Klassennamen eine aufgedeckte Zahl.
  const from = MASKED_FROM[kind] ?? MASKED_FROM[DEFAULT_AMOUNT_KIND];
  return level >= from;
}

/**
 * Ersetzt einen bereits formatierten Betrag durch die Maske, wenn seine Klasse
 * auf dieser Stufe ruht.
 *
 * Nimmt bewusst den FERTIGEN String und nicht die Zahl: Die Formatierung
 * unterscheidet sich je Aufrufstelle (mit/ohne Nachkommastellen, mit
 * Vorzeichen, in einer anderen Währung) — diese Funktion soll sie nicht
 * vereinheitlichen, sondern nur verdecken.
 */
export function maskAmount(
  formatted: string,
  level: GentleLevel,
  kind: AmountKind = DEFAULT_AMOUNT_KIND,
): string {
  return isAmountMasked(level, kind) ? GENTLE_AMOUNT_MASK : formatted;
}

/**
 * Übersetzt den abgelösten Schalter in eine Stufe.
 *
 * `true` wird zu `3` und nicht zu einer milderen Stufe: Wer den Modus an hatte,
 * hat bisher **alles** verdeckt gesehen. Eine Migration, die dabei Beträge
 * aufdeckt, wäre genau der Schreck, den der Modus verhindern soll.
 */
export function gentleLevelFromLegacy(enabled: boolean | undefined | null): GentleLevel {
  return enabled ? 3 : 0;
}

/**
 * Liest die Stufe aus dem Schnellstart-Wert in `localStorage`.
 *
 * Der Wert dort war früher `"true"`/`"false"` — Altbestände in Browsern, die
 * die App schon kennen, müssen weiter gelesen werden können. Alles
 * Unverständliche wird zu `0`: Ein kaputter Wert darf die App nicht in einen
 * Modus zwingen, den niemand gewählt hat.
 */
export function parseGentleLevel(raw: string | null | undefined): GentleLevel {
  if (raw === 'true') return 3;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 3) return 0;
  return parsed as GentleLevel;
}
