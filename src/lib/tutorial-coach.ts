/**
 * Die Brücke vom Lehrplan zum Coach (`docs/tutorial-sequence.md`, Schritt 5).
 *
 * Vertagte Kapitel gehören dem Coach: Er ist bereits der Ort für „das wäre
 * jetzt dein nächster Schritt", und ein Kapitel, dessen Voraussetzung
 * eingetreten ist, wird dort zur Karte. Damit gibt es **keine zweite
 * Benachrichtigungswelt** — der Lehrplan bekommt keinen eigenen Posteingang,
 * sondern nutzt den vorhandenen.
 *
 * Bewusst wird **nicht** angekündigt, was noch vertagt ist. „17 Dinge kommen
 * noch" wäre genau die Fülle, die die behutsame Heranführung vermeiden soll;
 * ein Kapitel meldet sich, wenn es so weit ist, und vorher nicht.
 *
 * Reine Domänenschicht: kein React, kein I/O. Texte über `serviceT`
 * (AGENTS.md §6), weil hier kein React-Kontext existiert.
 */

import type { CoachRecommendation } from '@/types';
import { t } from '@/i18n/serviceT';
import type { Curriculum, TutorialChapterId } from './tutorial-sequence';
import { chapterNameKey, hasSteps } from './tutorial-steps';
import { NAV_FEATURE_PATHS } from './life-situations';
import { chapterById } from './tutorial-sequence';

/** Stabile ID der Coach-Karte — der Coach führt seine Empfehlungen darüber. */
export const TUTORIAL_RECOMMENDATION_ID = 'tutorial-next-chapter';

/**
 * Wohin die Karte führt. Kernkapitel haben keinen wählbaren Bereich und damit
 * keinen Pfad im Feature-Katalog; für sie ist der Coach selbst das Ziel, weil
 * die Führung von dort aus startet.
 */
function destinationFor(chapter: TutorialChapterId): string {
  const feature = chapterById(chapter)?.feature ?? null;
  return feature ? NAV_FEATURE_PATHS[feature] : '/coach';
}

/**
 * Das nächste Kapitel, das etwas zu zeigen hat — oder `null`.
 *
 * Übersprungen werden Kapitel ohne ausformulierte Schritte: Sie stehen im
 * Lehrplan, haben aber noch keinen Text, und eine Karte, die auf nichts führt,
 * wäre ein leeres Versprechen.
 */
export function nextTeachableChapter(curriculum: Curriculum | null): TutorialChapterId | null {
  return teachableChapters(curriculum)[0] ?? null;
}

/**
 * Alle Kapitel, die jetzt etwas zu zeigen haben — in Lehrplan-Reihenfolge.
 *
 * Der Coach nimmt davon das erste; die Einladung braucht die ganze Liste, um
 * das Kapitel **der geöffneten Seite** anbieten zu können, statt immer nur den
 * Anfang des Lehrplans (`chapterOnRoute`).
 */
export function teachableChapters(curriculum: Curriculum | null): TutorialChapterId[] {
  return (curriculum?.next ?? []).filter((id) => hasSteps(id));
}

/**
 * Baut die Coach-Karte für ein Kapitel. `null`, wenn keines ansteht oder es
 * noch keinen Text hat — dann schweigt der Coach zum Tutorial, statt eine
 * Karte zu zeigen, die auf nichts führt.
 */
export function buildTutorialRecommendation(
  chapter: TutorialChapterId | null,
): CoachRecommendation | null {
  if (!chapter || !hasSteps(chapter)) return null;

  // Der Kapitelname ist der vorhandene Navigations-Schlüssel — eine
  // Umbenennung des Bereichs schlägt dadurch automatisch durch.
  const nameKey = chapterNameKey(chapter);

  return {
    id: TUTORIAL_RECOMMENDATION_ID,
    title: t('tutorialCoach.title'),
    message: t('tutorialCoach.message').replace('{chapter}', nameKey ? t(nameKey) : chapter),
    reason: t('tutorialCoach.reason'),
    severity: 'info',
    ctaLabel: t('tutorialCoach.cta'),
    ctaTo: destinationFor(chapter),
  };
}
