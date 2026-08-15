/**
 * Der **Katalog**: alle Tutorials, die es für diesen Nutzer gibt — gruppiert
 * nach der Fläche, auf der sie spielen, mit ihrem Stand.
 *
 * Das Gegenstück zu `buildCurriculum` und bewusst kein Ersatz dafür. Der
 * Lehrplan beantwortet „was ist mein **nächster** Schritt" und lässt dafür
 * alles Erledigte weg. Der Katalog beantwortet „was gibt es **überhaupt**, und
 * wo stehe ich" — dafür muss gerade das Erledigte sichtbar bleiben, sonst
 * verschwindet der Fortschritt in dem Moment, in dem er entsteht.
 *
 * **Vokabular** (bewusst das der App, nicht ein neues):
 *
 * - **Bereich** ist der Menüpunkt — `/transactions`, `/tax`. So heißt es im
 *   Onboarding („Bereiche wählen") und in den Einstellungen („Bereiche ein-
 *   und ausblenden"); ein dritter Begriff dafür wäre eine dritte Wahrheit.
 * - **Kapitel** ist das einzelne Tutorial darin. So heißt es seit
 *   `docs/tutorial-sequence.md` im Code, in den i18n-Schlüsseln und im
 *   gespeicherten Fortschritt (`tutorial_completed_chapters`).
 *
 * Ein Bereich hat also mehrere Kapitel: „Buchungen" trägt die Liste, das
 * Kategorisieren, das Filtern, die Detailansicht und das Aufteilen.
 *
 * Reine Domänenschicht: kein React, kein I/O (AGENTS.md §3).
 */

import {
  TUTORIAL_ORDER,
  CHAPTER_SUBSTITUTES,
  belongsToApp,
  type CurriculumInput,
  type TutorialChapterId,
} from './tutorial-sequence';
import { chapterNameKey, chapterRoute, hasSteps, stepsFor, tutorialTitleKey } from './tutorial-steps';

/**
 * Stand eines Kapitels. Drei Werte, weil drei verschiedene Dinge zu sagen
 * sind — „geht jetzt", „hast du schon" und „hat noch keine Daten". Der letzte
 * ist kein Fehler und keine Sperre: Ein Rahmen um einen leeren Bildschirm
 * lehrt nichts (`docs/tutorial-sequence.md`).
 */
export type TutorialChapterState = 'done' | 'ready' | 'waiting';

export interface TutorialCatalogChapter {
  id: TutorialChapterId;
  state: TutorialChapterState;
  /** Fläche, auf der es spielt — dorthin führt der Start. */
  route: string;
  /** i18n-Schlüssel des Kapitelnamens (`tutorial.<id>.name`). */
  titleKey: string;
  stepCount: number;
}

export interface TutorialCatalogSection {
  /** Der Menüpunkt, unter dem die Kapitel stehen. */
  route: string;
  /**
   * i18n-Schlüssel der Bereichsbeschriftung — der **vorhandene**
   * Navigations-Schlüssel des ersten Kapitels. Ein eigener Satz Namen wäre
   * eine zweite Wahrheit, die beim ersten Umbenennen ausei­nanderläuft
   * (dieselbe Begründung wie bei {@link chapterNameKey}).
   */
  titleKey: string;
  chapters: TutorialCatalogChapter[];
  doneCount: number;
  total: number;
}

export interface TutorialCatalog {
  sections: TutorialCatalogSection[];
  doneCount: number;
  total: number;
}

/**
 * Bereichsauswahl + Datenreife + Fortschritt → der vollständige Katalog.
 *
 * Nicht enthalten sind zwei Gruppen, und beide bewusst:
 *
 * - **Kapitel ohne Text** (`source`) — der Eintrag führte auf nichts.
 * - **Bereiche, die dieser Nutzer nicht gewählt hat.** Die Übersicht zeigt die
 *   App, die er hat, nicht die, die er haben könnte; einschalten lässt sich
 *   ein Bereich in den Einstellungen. Eine Liste mit Schlössern wäre Werbung.
 *
 * Vertagte Kapitel stehen dagegen **drin** (`waiting`). Für den Coach gilt
 * „was noch vertagt ist, wird nicht angekündigt" — dort ist es ein Zuruf. Hier
 * hat der Nutzer die Übersicht selbst geöffnet und gefragt, was es gibt; ihm
 * dann die Hälfte zu verschweigen, wäre keine Behutsamkeit, sondern eine
 * Auskunftssperre.
 */
export function buildTutorialCatalog(input: CurriculumInput): TutorialCatalog {
  const { enabledFeatures = null, readiness, completed = [], subcategoriesEnabled = true } = input;
  const done = new Set<TutorialChapterId>(completed);

  const sections: TutorialCatalogSection[] = [];
  const byRoute = new Map<string, TutorialCatalogSection>();

  for (const chapter of TUTORIAL_ORDER) {
    if (!hasSteps(chapter.id)) continue;
    if (!belongsToApp(chapter, enabledFeatures, subcategoriesEnabled)) continue;

    const route = chapterRoute(chapter.id);
    if (!route) continue;

    const entry: TutorialCatalogChapter = {
      id: chapter.id,
      state: done.has(chapter.id) ? 'done' : chapter.requires(readiness) ? 'ready' : 'waiting',
      route,
      titleKey: tutorialTitleKey(chapter.id),
      stepCount: stepsFor(chapter.id).length,
    };

    let section = byRoute.get(route);
    if (!section) {
      section = {
        route,
        titleKey: chapterNameKey(chapter.id) ?? entry.titleKey,
        chapters: [],
        doneCount: 0,
        total: 0,
      };
      byRoute.set(route, section);
      sections.push(section);
    }

    // Ein Kapitel, das ein anderes vertritt (`CHAPTER_SUBSTITUTES`), ist kein
    // zweiter Lerninhalt, sondern derselbe für das andere Publikum. Gelistet
    // wird das Kapitel, das für DIESEN Nutzer gilt; ist keines davon so weit,
    // bleibt das zuerst gefundene stehen.
    const family = CHAPTER_SUBSTITUTES[chapter.id] ?? chapter.id;
    const twin = section.chapters.find(
      (c) => (CHAPTER_SUBSTITUTES[c.id] ?? c.id) === family,
    );
    if (twin) {
      if (twin.state === 'waiting' && entry.state !== 'waiting') {
        section.chapters[section.chapters.indexOf(twin)] = entry;
        if (entry.state === 'done') section.doneCount += 1;
      }
      continue;
    }

    section.chapters.push(entry);
    section.total += 1;
    if (entry.state === 'done') section.doneCount += 1;
  }

  return {
    sections,
    doneCount: sections.reduce((sum, s) => sum + s.doneCount, 0),
    total: sections.reduce((sum, s) => sum + s.total, 0),
  };
}

/**
 * Das Kapitel, mit dem ein Bereich weitergeht — das erste noch offene, sonst
 * das erste überhaupt.
 *
 * Damit ein Klick auf den Bereich selbst etwas Sinnvolles tut, statt den
 * Nutzer vor eine zweite Wahl zu stellen, die er noch nicht treffen kann:
 * Wer den Bereich noch nicht kennt, kennt auch seine Kapitel nicht.
 */
export function nextChapterOfSection(section: TutorialCatalogSection): TutorialChapterId | null {
  const open = section.chapters.find((c) => c.state === 'ready');
  return open?.id ?? section.chapters[0]?.id ?? null;
}
