/**
 * Ziele-Adapter der 3D-Finanzstadt (WP-D7, Ziele-Tab): bildet die
 * Meilenstein-Auswertung (`@/services/milestones-service#evaluateMilestones`)
 * auf das kanonische `CityModel` ab. Reine Funktion ohne React/three.js
 * (README-Architekturtabelle, `domain/`).
 *
 * Metapher „Bauprojekt": Jedes quantifizierbare Ziel ist ein EIGENER Distrikt
 * mit genau einem Gebäude — die Wireframe-HÜLLE zeigt den SOLL-Wert
 * (`targetAmount`), der gefüllte BALKEN den IST-Stand. Der Füllgrad der Hülle
 * IST der Zielfortschritt; ein erreichtes Ziel füllt seine Hülle vollständig
 * („fertiggestellt", Gold).
 *
 * Normierung: Ziele mischen Einheiten (Euro-Beträge vs. Zähler wie „Schulden
 * getilgt"). Damit alle Bauprojekte vergleichbar sind, wird auf den
 * FORTSCHRITTS-BRUCH normiert: `targetAmount = 1` für jedes Ziel (alle Hüllen
 * gleich hoch), Balken = `min(ist/soll, 1)`. `CityModel.valueKind =
 * 'progress'` sagt der Presentation, dass Beträge Prozente sind (keine Euros,
 * keine Anteils-Prozente an Gesamt/Eltern).
 *
 * Kein Geld-Rechnen hier (nur Brüche aus bereits berechneten Ist-/Soll-Werten
 * des Milestone-Service) — AGENTS.md §8 bleibt unberührt.
 */

import type { MilestoneStatus } from '@/services/milestones-service';
import type { CityDistrict, CityModel } from './city-model';

/** Fertiggestellte Ziele (persistiert erreicht) — Gold, unabhängig vom aktuellen Bruch. */
const GOAL_ACHIEVED_COLOR = '#f0b429';
/** Laufende Bauprojekte: kühle Blau-/Violett-Familie (Index nach Sortierung). */
const GOAL_IN_PROGRESS_PALETTE = ['#3b82f6', '#6366f1', '#a855f7', '#06b6d4', '#0ea5e9', '#8b5cf6'] as const;

function inProgressColor(index: number): string {
  return GOAL_IN_PROGRESS_PALETTE[index % GOAL_IN_PROGRESS_PALETTE.length];
}

/**
 * Baut das `CityModel` des Ziele-Tabs. Nicht quantifizierbare Meilensteine
 * (`progress === null`, z. B. Schuldenfreiheit ohne erfasste Schulden) werden
 * übersprungen — keine leeren Bauprojekte. Sortierung: laufende Ziele nach
 * Fortschritt absteigend (das fast fertige Projekt zuerst — Motivation),
 * erreichte Ziele dahinter (Trophäen-Reihe); Tie-Breaker Meilenstein-Key.
 */
export function buildCityModelFromMilestones(statuses: MilestoneStatus[]): CityModel {
  const quantifiable = statuses.filter(
    (s): s is MilestoneStatus & { progress: NonNullable<MilestoneStatus['progress']> } =>
      s.progress !== null && s.progress !== undefined && s.progress.target > 0,
  );

  const sorted = [...quantifiable].sort((a, b) => {
    if (a.achieved !== b.achieved) return a.achieved ? 1 : -1;
    const ratioA = a.progress.amount / a.progress.target;
    const ratioB = b.progress.amount / b.progress.target;
    return ratioB - ratioA || a.definition.key.localeCompare(b.definition.key);
  });

  let inProgressIndex = 0;
  const districts: CityDistrict[] = sorted.map((status) => {
    const ratio = status.progress.amount / status.progress.target;
    const label = `${status.definition.icon} ${status.definition.title}`;
    const color = status.achieved ? GOAL_ACHIEVED_COLOR : inProgressColor(inProgressIndex++);

    return {
      id: `goal:${status.definition.key}`,
      label,
      color,
      // Anzeige-Wert = echter Bruch (kann das Ziel übertreffen, z. B. „112 %").
      total: ratio,
      // Hülle = SOLL (normiert 1), Balken = IST (auf die Hülle gedeckelt) —
      // ein persistiert erreichtes Ziel bleibt voll gefüllt, auch wenn der
      // aktuelle Bruch wieder unter 1 liegt (Trophäe, kein Rückbau).
      targetAmount: 1,
      subcategories: [{ id: 'progress', label, amount: status.achieved ? 1 : Math.min(1, ratio) }],
      achieved: status.achieved,
    };
  });

  return { districts, valueKind: 'progress' };
}
