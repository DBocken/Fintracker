import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { completeTutorialChapter, getUserSettings } from '@/services/user-settings-service';
import { collectDataReadiness } from '@/services/data-readiness-service';
import { buildCurriculum, type TutorialChapterId } from '@/lib/tutorial-sequence';
import { hasSteps, stepsFor, type TutorialStep } from '@/lib/tutorial-steps';
import { nextTeachableChapter, teachableChapters } from '@/lib/tutorial-coach';
import { useTier } from '@/hooks/useTier';

/**
 * Der laufende Tutorial-Durchgang: welches Kapitel, welcher Schritt, was
 * passiert beim Abschluss.
 *
 * Der Lauf ist bewusst **nicht** persistent auf Schritt-Ebene: Gespeichert
 * werden abgeschlossene Kapitel, nicht die Position im Kapitel. Ein Kapitel
 * hat zwei bis vier Schritte — es noch einmal zu sehen kostet Sekunden, eine
 * halb gespeicherte Position dagegen erzeugt Zustände, die niemand
 * nachvollziehen kann.
 */

export interface TutorialRun {
  /** Läuft gerade eine Führung? */
  active: boolean;
  chapter: TutorialChapterId | null;
  step: TutorialStep | null;
  stepIndex: number;
  stepCount: number;
  /**
   * Wie viele Kapitel nach dem laufenden noch in der Folge stehen. `0` beim
   * Einzelstart — daran erkennt die Darstellung, ob der letzte Schritt
   * „Fertig" ist oder ins nächste Kapitel führt.
   */
  remaining: number;
  /** Nächstes Kapitel, das etwas zu zeigen hat — auch wenn gerade nichts läuft. */
  upcoming: TutorialChapterId | null;
  /**
   * Das Kapitel NACH dem laufenden in der aktuellen Folge — `null` beim
   * Einzelstart oder am Ende der Folge. Damit kann die Darstellung am
   * Kapitelende sagen, wohin „weiter" tatsächlich führt, statt nur
   * pauschal „Weiter" anzubieten.
   */
  nextChapter: TutorialChapterId | null;
  /**
   * Alle Kapitel, die jetzt laufen könnten, in Lehrplan-Reihenfolge.
   *
   * Nicht dasselbe wie `upcoming` und auch kein Luxus: Die Einladung schwebt
   * über jeder Seite und muss das Kapitel **dieser** Seite anbieten können,
   * nicht nur den Anfang des Lehrplans. Mit nur einem Kapitel in der Hand
   * bliebe ihr nur, wegzuspringen (`chapterOnRoute`).
   */
  teachable: readonly TutorialChapterId[];
  start: (chapter?: TutorialChapterId) => void;
  /**
   * Startet eine **Folge** von Kapiteln — das zusammenhängende Tutorial.
   *
   * Der Unterschied zu `start` ist nur das Ende: Statt anzuhalten, geht die
   * Führung zum nächsten Kapitel der Liste über. Ohne das wäre ein
   * „Gesamt-Tutorial" 24 Einzelstarts, und der Nutzer müsste nach jedem
   * Kapitel selbst wissen, wo es weitergeht — genau die Arbeit, die eine
   * Führung ihm abnehmen soll.
   *
   * Die Reihenfolge kommt von der Aufrufstelle: Die Übersicht kennt den
   * Katalog samt Stand, der Lauf kennt ihn nicht (und soll es nicht).
   */
  startSeries: (chapters: readonly TutorialChapterId[]) => void;
  next: () => void;
  back: () => void;
  /** Bricht ab, ohne das Kapitel als abgeschlossen zu werten. */
  end: () => void;
  /**
   * Schließt das laufende Kapitel ab (wie `next` am letzten Schritt), bricht
   * die Folge danach aber bewusst ab, statt zum nächsten Kapitel
   * überzugehen. Der Unterschied zu `end`: Das gerade fertig gesehene
   * Kapitel zählt als abgeschlossen — nur die Fortsetzung entfällt. Ohne
   * diese dritte Möglichkeit hätte man am Kapitelende nur „weiter" (Folge
   * geht automatisch weiter) oder „abbrechen" (auch das eben Gesehene zählt
   * nicht) — beides ist nicht dasselbe wie „genau hier reicht es mir für
   * heute".
   */
  finishAndEnd: () => void;
}

export function useTutorialRun(): TutorialRun {
  const queryClient = useQueryClient();
  const tier = useTier();
  const { data: settings } = useQuery({ queryKey: ['userSettings'], queryFn: getUserSettings });
  const { data: readiness } = useQuery({
    queryKey: ['dataReadiness', tier],
    queryFn: () => collectDataReadiness(tier === 'premium'),
  });

  /**
   * Die noch zu zeigenden Kapitel; `queue[0]` ist das laufende. Eine Liste
   * statt eines einzelnen Kapitels, weil ein Einzelstart nur der Sonderfall
   * „Folge der Länge eins" ist — zwei Zustände nebeneinander (Kapitel +
   * Fortsetzungsmodus) hätten sich früher oder später widersprochen.
   */
  const [queue, setQueue] = useState<readonly TutorialChapterId[]>([]);
  const [stepIndex, setStepIndex] = useState(0);
  const chapter = queue[0] ?? null;

  const mutation = useMutation({
    mutationFn: (done: TutorialChapterId) => completeTutorialChapter(done),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['userSettings'] }),
  });

  const curriculum = useMemo(() => {
    if (!readiness) return null;
    return buildCurriculum({
      enabledFeatures: settings?.enabled_nav_features ?? null,
      lifeSituation: settings?.onboarding_life_situation ?? null,
      readiness,
      completed: settings?.tutorial_completed_chapters ?? [],
      subcategoriesEnabled: settings?.enable_subcategories ?? true,
    });
  }, [readiness, settings]);

  // Ein Kapitel ohne ausformulierte Schritte ist kein Fehler, sondern noch
  // nicht geschriebener Text — es wird übersprungen, nicht angehalten. Die
  // Regel steht in `tutorial-coach`, weil der Coach dieselbe Frage stellt.
  const teachable = useMemo(() => teachableChapters(curriculum), [curriculum]);
  const upcoming = useMemo(() => nextTeachableChapter(curriculum), [curriculum]);

  const steps = chapter ? stepsFor(chapter) : [];

  /**
   * Hält das Kapitel als abgeschlossen fest.
   *
   * Das Anhängen an die Liste passiert im Store, nicht hier: Die Aufrufstelle
   * kennt den bisherigen Stand nur aus dem Query-Cache, und der hinkt einer
   * gerade geschriebenen Änderung hinterher. In einer Folge (Gesamt-Tutorial)
   * folgen zwei Abschlüsse unmittelbar aufeinander — genau dort ging der
   * erste verloren.
   */
  const finishChapter = useCallback(
    (done: TutorialChapterId) => {
      if ((settings?.tutorial_completed_chapters ?? []).includes(done)) return;
      mutation.mutate(done);
    },
    [settings, mutation],
  );

  const start = useCallback(
    (which?: TutorialChapterId) => {
      const target = which ?? upcoming;
      if (!target || !hasSteps(target)) return;
      setQueue([target]);
      setStepIndex(0);
    },
    [upcoming],
  );

  const startSeries = useCallback((chapters: readonly TutorialChapterId[]) => {
    const withText = chapters.filter(hasSteps);
    if (withText.length === 0) return;
    setQueue(withText);
    setStepIndex(0);
  }, []);

  const end = useCallback(() => {
    setQueue([]);
    setStepIndex(0);
  }, []);

  const next = useCallback(() => {
    if (!chapter) return;
    const last = stepsFor(chapter).length - 1;
    if (stepIndex >= last) {
      finishChapter(chapter);
      // Weiter mit dem nächsten Kapitel der Folge; bei einem Einzelstart ist
      // die Folge hier zu Ende und die Führung schließt.
      setQueue((q) => q.slice(1));
      setStepIndex(0);
      return;
    }
    setStepIndex((i) => i + 1);
  }, [chapter, stepIndex, finishChapter]);

  const back = useCallback(() => setStepIndex((i) => Math.max(0, i - 1)), []);

  const finishAndEnd = useCallback(() => {
    if (!chapter) return;
    finishChapter(chapter);
    setQueue([]);
    setStepIndex(0);
  }, [chapter, finishChapter]);

  return {
    active: chapter !== null,
    chapter,
    step: steps[stepIndex] ?? null,
    stepIndex,
    stepCount: steps.length,
    remaining: Math.max(0, queue.length - 1),
    upcoming,
    nextChapter: queue[1] ?? null,
    teachable,
    start,
    startSeries,
    next,
    back,
    end,
    finishAndEnd,
  };
}

