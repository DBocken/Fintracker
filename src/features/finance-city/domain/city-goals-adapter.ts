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

import type { MilestoneStatus } from '@/lib/milestone-types';
import type { CityDistrict, CityModel } from './city-model';
import { goalProgressStage, goalStageColor, type GoalProgressStage } from './city-goal-progress';

/**
 * Baut das `CityModel` des Ziele-Tabs. Nicht quantifizierbare Meilensteine
 * (`progress === null`, z. B. Schuldenfreiheit ohne erfasste Schulden) werden
 * übersprungen — keine leeren Bauprojekte. Sortierung: laufende Ziele nach
 * Fortschritt absteigend (das fast fertige Projekt zuerst — Motivation),
 * erreichte Ziele dahinter (Trophäen-Reihe); Tie-Breaker Meilenstein-Key.
 *
 * WP-5.3: Die Farbe kam bis dahin aus dem SORTIER-INDEX — ein Ziel bei 5 % und
 * eines bei 95 % unterschieden sich in der Farbe, aber der Unterschied bedeutete
 * nur „steht weiter oben in der Liste". Jetzt trägt sie die Fortschritts-Stufe
 * (`city-goal-progress.ts`), damit der Blick über die Bauprojekte dieselbe
 * Aussage macht wie die Füllhöhe.
 *
 * `previousStages` ist der Stufen-Stand des letzten Aufrufs (die Application-
 * Schicht hält ihn) — nötig für die Hysterese, damit ein Ziel, das um eine
 * Schwelle pendelt, nicht bei jedem Datenrefresh die Farbe wechselt.
 */
export function buildCityModelFromMilestones(
  statuses: MilestoneStatus[],
  previousStages?: ReadonlyMap<string, GoalProgressStage>,
): CityModel {
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

  const districts: CityDistrict[] = sorted.map((status) => {
    const ratio = status.progress.amount / status.progress.target;
    const label = `${status.definition.icon} ${status.definition.title}`;
    const id = `goal:${status.definition.key}`;
    const stage = goalProgressStage(ratio, {
      achieved: status.achieved,
      previous: previousStages?.get(id),
    });

    return {
      id,
      stage,
      color: goalStageColor(stage),
      label,
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
