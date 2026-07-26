import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getUserSettings, updateUserSettings } from '@/services/user-settings-service';
import { collectDataReadiness } from '@/services/data-readiness-service';
import { buildCurriculum, chapterById, type TutorialChapterId } from '@/lib/tutorial-sequence';
import { hasSteps, stepsFor, type TutorialStep } from '@/lib/tutorial-steps';
import { withFeatureUnlocked } from '@/lib/life-situations';
import { useTier } from '@/hooks/useTier';
import type { UserSettings } from '@/types';

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
  /** Nächstes Kapitel, das etwas zu zeigen hat — auch wenn gerade nichts läuft. */
  upcoming: TutorialChapterId | null;
  start: (chapter?: TutorialChapterId) => void;
  next: () => void;
  back: () => void;
  /** Bricht ab, ohne das Kapitel als abgeschlossen zu werten. */
  end: () => void;
}

export function useTutorialRun(): TutorialRun {
  const queryClient = useQueryClient();
  const tier = useTier();
  const { data: settings } = useQuery({ queryKey: ['userSettings'], queryFn: getUserSettings });
  const { data: readiness } = useQuery({
    queryKey: ['dataReadiness', tier],
    queryFn: () => collectDataReadiness(tier === 'premium'),
  });

  const [chapter, setChapter] = useState<TutorialChapterId | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  const mutation = useMutation({
    mutationFn: (updates: Partial<UserSettings>) => updateUserSettings(updates),
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
  // nicht geschriebener Text — es wird übersprungen, nicht angehalten.
  const upcoming = useMemo(
    () => curriculum?.next.find((id) => hasSteps(id)) ?? null,
    [curriculum],
  );

  const steps = chapter ? stepsFor(chapter) : [];

  const finishChapter = useCallback(
    (done: TutorialChapterId) => {
      const completed = settings?.tutorial_completed_chapters ?? [];
      if (completed.includes(done)) return;

      const updates: Partial<UserSettings> = {
        tutorial_completed_chapters: [...completed, done],
      };

      // Ein abgeschlossenes Kapitel schaltet seinen Bereich frei — das ist der
      // Sinn der Freischaltungs-Achse. `withFeatureUnlocked` lässt „alles
      // freigeschaltet" (null) dabei bewusst unangetastet.
      // Welcher Bereich zu welchem Kapitel gehoert, steht in TUTORIAL_ORDER —
      // eine zweite Liste hier waere eine zweite Wahrheit.
      const feature = chapterById(done)?.feature ?? null;
      if (feature) {
        const unlocked = withFeatureUnlocked(settings?.unlocked_features ?? null, feature);
        if (unlocked !== (settings?.unlocked_features ?? null)) updates.unlocked_features = unlocked;
      }

      mutation.mutate(updates);
    },
    [settings, mutation],
  );

  const start = useCallback(
    (which?: TutorialChapterId) => {
      const target = which ?? upcoming;
      if (!target || !hasSteps(target)) return;
      setChapter(target);
      setStepIndex(0);
    },
    [upcoming],
  );

  const end = useCallback(() => {
    setChapter(null);
    setStepIndex(0);
  }, []);

  const next = useCallback(() => {
    if (!chapter) return;
    const last = stepsFor(chapter).length - 1;
    if (stepIndex >= last) {
      finishChapter(chapter);
      end();
      return;
    }
    setStepIndex((i) => i + 1);
  }, [chapter, stepIndex, finishChapter, end]);

  const back = useCallback(() => setStepIndex((i) => Math.max(0, i - 1)), []);

  return {
    active: chapter !== null,
    chapter,
    step: steps[stepIndex] ?? null,
    stepIndex,
    stepCount: steps.length,
    upcoming,
    start,
    next,
    back,
    end,
  };
}

