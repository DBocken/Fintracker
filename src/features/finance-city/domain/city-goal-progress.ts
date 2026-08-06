/**
 * WP-5.3 — Fortschritts-Stufen der Bauprojekte (Ziele-Tab der Finanzstadt).
 *
 * Der Balken wuchs schon vor WP-5.3 datengetrieben: eine Änderung des
 * Ist-Werts läuft als Höhen-Tween über den `applyLayout`-Diff, das Gebäude
 * WÄCHST also statt aufzupoppen (`docs/design-principles.md`, Prinzip 2).
 *
 * Was fehlte, war die zweite Hälfte derselben Aussage. Die Farbe der
 * Bauprojekte kam aus dem SORTIER-INDEX (`GOAL_IN_PROGRESS_PALETTE[i]`): ein
 * Ziel bei 5 % und eines bei 95 % sahen unterschiedlich aus, aber der
 * Unterschied bedeutete nur „steht weiter oben in der Liste". Ein ganzer
 * Wahrnehmungskanal lag auf einer Zufallsgröße, während der Fortschritt —
 * die eigentliche Aussage des Tabs — allein an der Füllhöhe hing.
 *
 * Hier steht deshalb die Zuordnung Fortschritt → Stufe → Farbe. Rein und
 * browserfrei (README-Architekturtabelle, `domain/`).
 */

/** Stufen in AUFSTEIGENDER Ordnung — die Reihenfolge ist Teil des Vertrags (siehe Hysterese unten). */
export const GOAL_STAGE_ORDER = ['started', 'underway', 'nearly', 'achieved'] as const;

export type GoalProgressStage = (typeof GOAL_STAGE_ORDER)[number];

/**
 * Untergrenze je Stufe (Fortschritts-Bruch Ist/Soll). `achieved` bei 1 —
 * darüber hinaus (z. B. 112 %) bleibt es `achieved`, der Balken ist ohnehin
 * auf die Hülle gedeckelt.
 */
const STAGE_THRESHOLDS: Record<GoalProgressStage, number> = {
  started: 0,
  underway: 0.33,
  nearly: 0.75,
  achieved: 1,
};

/**
 * Breite des Hysterese-Bandes. Ein Wert, der um eine Schwelle pendelt (ein
 * Ziel bei 74,9 %, das mit jeder Buchung die 75 % streift), würde sonst bei
 * jedem Datenrefresh die Farbe wechseln — genau das Flackern, das
 * `docs/design-principles.md` mit „schwellwertbewusst" ausschließt.
 *
 * Bewusst nur gegen das ZURÜCKfallen: wer die nächste Stufe erreicht, sieht es
 * sofort. Eine Glättung, die den Moment verzögert, auf den das ganze Feature
 * hinarbeitet, wäre der falsche Kompromiss.
 */
export const GOAL_STAGE_HYSTERESIS = 0.04;

/**
 * Farben je Stufe: kühl und zurückhaltend am Anfang, wärmer und gesättigter
 * gegen Ende, Gold bei Fertigstellung. Die Steigerung IST die Aussage — sie
 * ist auch ohne Farbunterscheidung an der Helligkeit ablesbar und dupliziert
 * ohnehin nur, was die Füllhöhe schon zeigt (Farbe ist hier
 * Redundanz-Kanal, nicht einziger Träger — barrierefrei nach Prinzip „nie
 * Farbe allein").
 */
const STAGE_COLORS: Record<GoalProgressStage, string> = {
  started: '#3b82f6',
  underway: '#06b6d4',
  nearly: '#a855f7',
  achieved: '#f0b429',
};

export function goalStageColor(stage: GoalProgressStage): string {
  return STAGE_COLORS[stage];
}

function stageFromRatio(ratio: number): GoalProgressStage {
  if (!Number.isFinite(ratio) || ratio <= 0) return 'started';

  // Von oben nach unten: die erste Stufe, deren Schwelle erreicht ist.
  for (let index = GOAL_STAGE_ORDER.length - 1; index > 0; index -= 1) {
    const stage = GOAL_STAGE_ORDER[index];
    if (ratio >= STAGE_THRESHOLDS[stage]) return stage;
  }
  return 'started';
}

export type GoalStageOptions = {
  /** Persistiert erreicht (Trophäe) — schlägt jeden aktuellen Bruch. */
  achieved?: boolean;
  /** Zuletzt angezeigte Stufe. Nur für die Hysterese beim Zurückfallen nötig. */
  previous?: GoalProgressStage;
};

/**
 * Stufe eines Bauprojekts aus seinem Fortschritts-Bruch.
 *
 * `achieved` (persistiert) gewinnt immer — dieselbe Zusicherung, die der
 * Adapter beim Balken schon gibt: ein einmal erreichtes Ziel bleibt gefüllt,
 * auch wenn der aktuelle Bruch wieder darunter liegt. Trophäe, kein Rückbau.
 */
export function goalProgressStage(ratio: number, options: GoalStageOptions = {}): GoalProgressStage {
  if (options.achieved || options.previous === 'achieved') return 'achieved';

  const next = stageFromRatio(ratio);
  const previous = options.previous;
  if (!previous) return next;

  const nextIndex = GOAL_STAGE_ORDER.indexOf(next);
  const previousIndex = GOAL_STAGE_ORDER.indexOf(previous);
  // Fortschritt (oder gleich): sofort übernehmen.
  if (nextIndex >= previousIndex) return next;

  // Rückfall: nur, wenn er das Hysterese-Band unter der bisherigen Schwelle
  // vollständig verlässt.
  return ratio < STAGE_THRESHOLDS[previous] - GOAL_STAGE_HYSTERESIS ? next : previous;
}
