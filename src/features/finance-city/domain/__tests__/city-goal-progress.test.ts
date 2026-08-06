import { describe, it, expect } from 'vitest';
import {
  goalProgressStage,
  goalStageColor,
  GOAL_STAGE_ORDER,
  GOAL_STAGE_HYSTERESIS,
  type GoalProgressStage,
} from '../city-goal-progress';

/**
 * WP-5.3 — Gebäudewachstum bei Zielfortschritt.
 *
 * Der Balken wuchs schon vorher datengetrieben (Höhen-Tween über den
 * `applyLayout`-Diff). Was fehlte, war die zweite Hälfte: die FARBE trug
 * keinerlei Information über den Fortschritt. Sie kam aus dem Sortier-Index
 * (`GOAL_IN_PROGRESS_PALETTE[i]`) — ein Ziel bei 5 % und eines bei 95 % sahen
 * gleich aus, unterschieden nur danach, an welcher Stelle der Liste sie
 * standen. Ein ganzer Wahrnehmungskanal lag auf einer Zufallsgröße.
 *
 * `docs/design-principles.md` fordert für Farb-/Statuswechsel ausdrücklich
 * SCHWELLWERTBEWUSSTSEIN. Das heißt hier zweierlei: definierte Stufen — und
 * eine Hysterese, damit ein Wert, der um eine Schwelle pendelt, nicht bei
 * jedem Datenrefresh die Farbe wechselt.
 */
describe('goalProgressStage', () => {
  it('sollte einen frischen Fortschritt als Beginn einstufen', () => {
    expect(goalProgressStage(0)).toBe('started');
    expect(goalProgressStage(0.1)).toBe('started');
  });

  it('sollte die mittleren Bereiche unterscheiden', () => {
    expect(goalProgressStage(0.4)).toBe('underway');
    expect(goalProgressStage(0.8)).toBe('nearly');
  });

  it('sollte ein erfülltes Verhältnis als erreicht einstufen', () => {
    expect(goalProgressStage(1)).toBe('achieved');
    expect(goalProgressStage(1.4)).toBe('achieved');
  });

  it('sollte ein persistiert erreichtes Ziel erreicht lassen, auch wenn der Bruch fällt', () => {
    // Trophäe, kein Rückbau — dieselbe Zusicherung, die der Adapter beim
    // Balken schon gibt (`amount: achieved ? 1 : …`).
    expect(goalProgressStage(0.2, { achieved: true })).toBe('achieved');
  });

  it('sollte einen negativen oder unbrauchbaren Bruch als Beginn behandeln', () => {
    expect(goalProgressStage(-1)).toBe('started');
    expect(goalProgressStage(Number.NaN)).toBe('started');
  });

  describe('Schwellwertbewusstsein (Hysterese)', () => {
    it('sollte eine Stufe nicht verlassen, solange der Rückfall innerhalb des Bandes bleibt', () => {
      // Ein Ziel knapp über der Schwelle, das um wenige Promille schwankt,
      // darf nicht bei jedem Refresh die Farbe wechseln.
      const justAbove = 0.75;
      const stage = goalProgressStage(justAbove);
      expect(stage).toBe('nearly');
      expect(goalProgressStage(justAbove - GOAL_STAGE_HYSTERESIS / 2, { previous: stage })).toBe('nearly');
    });

    it('sollte die Stufe verlassen, sobald der Rückfall das Band überschreitet', () => {
      expect(goalProgressStage(0.75 - GOAL_STAGE_HYSTERESIS * 2, { previous: 'nearly' })).toBe('underway');
    });

    it('sollte einen echten Fortschritt SOFORT anerkennen', () => {
      // Hysterese gilt nur gegen das Zurückfallen. Wer die nächste Stufe
      // erreicht, soll das sofort sehen — sonst bestraft die Glättung genau
      // den Moment, auf den das Feature hinarbeitet.
      expect(goalProgressStage(0.8, { previous: 'started' })).toBe('nearly');
    });

    it('[REGRESSION] sollte ein einmal erreichtes Ziel nie zurückstufen', () => {
      expect(goalProgressStage(0.5, { previous: 'achieved' })).toBe('achieved');
    });
  });
});

describe('goalStageColor', () => {
  it('sollte jeder Stufe genau eine Farbe zuordnen', () => {
    const colors = GOAL_STAGE_ORDER.map(goalStageColor);
    expect(new Set(colors).size, 'Zwei Stufen teilen sich eine Farbe — die Stufe wäre nicht ablesbar').toBe(
      GOAL_STAGE_ORDER.length,
    );
  });

  it('sollte gültige Hex-Farben liefern', () => {
    for (const stage of GOAL_STAGE_ORDER) {
      expect(goalStageColor(stage)).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('sollte die Stufen in einer aufsteigenden Ordnung führen', () => {
    // Die Reihenfolge ist Teil des Vertrags: `goalProgressStage` vergleicht
    // Indizes, um „Fortschritt" von „Rückfall" zu unterscheiden.
    expect(GOAL_STAGE_ORDER).toEqual(['started', 'underway', 'nearly', 'achieved'] satisfies GoalProgressStage[]);
  });
});
