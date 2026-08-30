/**
 * Das ViewModel des Einstiegs.
 *
 * Es hält den Entwurf, kennt den Schritt und schreibt am Ende genau einmal.
 * Die Darstellung kennt es nicht (AGENTS.md §3) — sie bekommt Werte und
 * Rückrufe, mehr nicht.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { displayNameFromIdentity } from '@/lib/identity';
import { hasStartedAnonymousMode, startAnonymousMode } from '@/lib/anonymous-mode';
import type { TutorialSource } from '@/lib/tutorial-sequence';
import { getUserSettings } from '@/services/user-settings-service';
import { loadDemoData } from '@/services/demo-data-service';
import { invalidateFinanceData } from '@/features/shared/data/finance-query-keys';
import {
  EMPTY_DRAFT,
  type OnboardingDraft,
  type OnboardingPath,
} from '../domain/onboarding-draft';
import {
  nextStep,
  prevStep,
  resolveStartStep,
  stepsForPath,
  type OnboardingContext,
  type OnboardingStepId,
} from '../domain/onboarding-steps';
import {
  clearOnboardingDraft,
  readOnboardingDraft,
  writeOnboardingDraft,
} from '../data/onboarding-draft-store';
import { commitOnboarding } from '../data/onboarding-commit';
import { markTutorialWanted } from '../data/pending-tutorial';

export interface OnboardingFlowModel {
  draft: OnboardingDraft;
  context: OnboardingContext;
  /** Der Schritt, auf dem der Fluss laut Entwurf und Kontext steht. */
  resumeStep: OnboardingStepId;
  /** Nummer und Gesamtzahl für die Fortschrittsanzeige. */
  position: { current: number; total: number };
  /** Anzeigename aus dem Konto, falls vorhanden. */
  accountName: string | null;
  /** Konnten die Einstellungen gelesen werden? */
  settingsError: boolean;
  saving: boolean;
  saveFailed: boolean;
  /** Beschränkt einen gewünschten Schritt auf das, was der Entwurf trägt. */
  clampStep: (requested: OnboardingStepId) => OnboardingStepId;
  patchDraft: (patch: Partial<OnboardingDraft>) => OnboardingDraft;
  choosePath: (path: OnboardingPath) => OnboardingDraft;
  advanceFrom: (step: OnboardingStepId) => OnboardingStepId | null;
  retreatFrom: (step: OnboardingStepId) => OnboardingStepId | null;
  finish: (input: { source: TutorialSource | null; startTutorial: boolean }) => Promise<void>;
}

export function useOnboardingFlow(): OnboardingFlowModel {
  const { status, identity } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<OnboardingDraft>(() => readOnboardingDraft() ?? EMPTY_DRAFT);
  // Der anonyme Start ist ein einmaliger Übergang; ihn bei jedem Render neu
  // aus dem Speicher zu lesen brächte nichts, weil nur DIESER Fluss ihn setzt.
  const [anonymousStarted, setAnonymousStarted] = useState(() => hasStartedAnonymousMode());

  const authenticated = status === 'authenticated';
  const context = useMemo<OnboardingContext>(
    () => ({ authenticated, hasAccess: authenticated || anonymousStarted }),
    [authenticated, anonymousStarted],
  );

  // Nur für den Abschluss nötig (und für die Frage, ob überhaupt gelesen
  // werden kann). Der Fehlerfall wird ausgewiesen, nicht verschluckt —
  // `pnpm check:query-errors`.
  const { isError: settingsError } = useQuery({
    queryKey: ['userSettings'],
    queryFn: getUserSettings,
    enabled: context.hasAccess,
  });

  // Spiegel des jüngsten Entwurfs. Nötig, weil im selben Tick mehrere Patches
  // fallen — die Begrüßung setzt den Namen UND geht weiter. Über den
  // Render-Zustand gelesen setzte der zweite Patch auf dem Stand VOR dem
  // ersten auf und verschluckte ihn; genau das hat ein Test gemeldet.
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const patchDraft = useCallback((patch: Partial<OnboardingDraft>) => {
    const next = { ...draftRef.current, ...patch };
    draftRef.current = next;
    setDraft(next);
    writeOnboardingDraft(next);
    return next;
  }, []);

  const choosePath = useCallback(
    (path: OnboardingPath) => {
      // Der anonyme Weg ist genau hier entschieden — erst damit darf die App
      // hinter dem Einstieg überhaupt rendern.
      if (path === 'anonymous') {
        startAnonymousMode();
        setAnonymousStarted(true);
      }
      return patchDraft({ path });
    },
    [patchDraft],
  );

  const clampStep = useCallback(
    (requested: OnboardingStepId) => resolveStartStep({ ...draft, step: requested }, context),
    [draft, context],
  );

  const resumeStep = useMemo(() => resolveStartStep(draft, context), [draft, context]);

  const position = useMemo(() => {
    const steps = stepsForPath(draft.path);
    const index = steps.indexOf(draft.step);
    return { current: (index < 0 ? 0 : index) + 1, total: steps.length };
  }, [draft.path, draft.step]);

  const advanceFrom = useCallback(
    (step: OnboardingStepId) => {
      const ziel = nextStep(step, draftRef.current.path);
      if (ziel) patchDraft({ step: ziel });
      return ziel;
    },
    [patchDraft],
  );

  const retreatFrom = useCallback(
    (step: OnboardingStepId) => {
      const ziel = prevStep(step, draftRef.current.path);
      if (ziel) patchDraft({ step: ziel });
      return ziel;
    },
    [patchDraft],
  );

  const mutation = useMutation({
    mutationFn: async (input: { source: TutorialSource | null; startTutorial: boolean }) => {
      const aktuell = draftRef.current;
      // Nur der Beispieldaten-Weg ändert wirklich Finanzdaten. Datei und Bank
      // ändern hier noch nichts — Import und Verbindung laufen auf ihren
      // Zielseiten mit eigener Invalidierung, ein Pauschal-Wipe wäre dort
      // reine Verschwendung (übernommen aus der abgelösten Weiche).
      if (input.source === 'demo') await loadDemoData();
      const settings = await commitOnboarding({ draft: aktuell, source: input.source });
      if (input.source === 'demo') await invalidateFinanceData(queryClient);
      return settings;
    },
    onSuccess: async () => {
      clearOnboardingDraft();
      await queryClient.invalidateQueries({ queryKey: ['userSettings'] });
    },
  });

  const { mutateAsync } = mutation;
  const finish = useCallback(
    async (input: { source: TutorialSource | null; startTutorial: boolean }) => {
      // Der Wunsch wird VOR dem Schreiben notiert: Der Zettel kostet nichts,
      // wenn der Schreibvorgang scheitert (er wird beim nächsten Eintritt in
      // die App verbraucht oder gar nicht), aber danach zu notieren hiesse,
      // ihn bei einem Fehler zu verlieren.
      if (input.startTutorial) markTutorialWanted();
      await mutateAsync(input);
    },
    [mutateAsync],
  );

  return {
    draft,
    context,
    resumeStep,
    position,
    accountName: displayNameFromIdentity(identity),
    settingsError,
    saving: mutation.isPending,
    saveFailed: mutation.isError,
    clampStep,
    patchDraft,
    choosePath,
    advanceFrom,
    retreatFrom,
    finish,
  };
}
