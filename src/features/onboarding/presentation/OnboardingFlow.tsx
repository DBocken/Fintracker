/**
 * Der Rahmen des Einstiegs: eine Seite je Schritt, mit einer Bewegungssprache.
 *
 * Der Schritt steht in der ADRESSE (`/willkommen/<schritt>`), nicht nur im
 * Zustand — sonst hätte der Zurück-Knopf des Browsers keine Bedeutung und ein
 * Neuladen führte auf die Startseite des Flusses zurück. Was die Adresse
 * behauptet, wird durch dieselbe Regel beschnitten, die auch die Wiederaufnahme
 * bestimmt (`clampStep`): Die URL ist frei tippbar, und ein Sprung auf die
 * Bereichsauswahl darf die Wegwahl nicht überspringen.
 */

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MOTION_DURATIONS, MOTION_EASINGS_BEZIER } from '@/lib/motion-tokens';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useI18n } from '@/i18n/useI18n';
import type { Locale } from '@/i18n/locale';
import { SUPPORTED_LOCALES } from '@/i18n/locale';
import type { LifeSituationId, ModifierId, NavFeatureId } from '@/lib/life-situations';
import { resolveFeatureSelection } from '@/lib/life-situations';
import type { TutorialSource } from '@/lib/tutorial-sequence';
import { isOnboardingStep, type OnboardingStepId } from '../domain/onboarding-steps';
import type { FeatureCatalog } from '../domain/feature-rows';
import { useOnboardingFlow } from '../application/use-onboarding-flow';
import LanguageStep from './steps/LanguageStep';
import PathStep from './steps/PathStep';
import AuthStep from './steps/AuthStep';
import GreetingStep from './steps/GreetingStep';
import SituationStep from './steps/SituationStep';
import ModifiersStep from './steps/ModifiersStep';
import FeaturesStep from './steps/FeaturesStep';
import PremiumStep from './steps/PremiumStep';
import StartStep from './steps/StartStep';

/** Wohin der jeweilige Weg führt. Alle drei enden an derselben Stelle: Buchungen. */
const DESTINATION: Record<TutorialSource, string> = {
  csv: '/csv',
  bank: '/accounts',
  demo: '/dashboard',
};

export interface OnboardingFlowProps {
  /**
   * Bereiche, Labels und Symbole. Wird von der Seite gereicht, weil die
   * Navigation in der Alt-Oberfläche liegt — Begründung in
   * `domain/feature-rows.ts`.
   */
  catalog: FeatureCatalog;
}

export default function OnboardingFlow({ catalog }: OnboardingFlowProps) {
  const { t, setLocale } = useI18n();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const { step: stepParam } = useParams<{ step: string }>();
  const flow = useOnboardingFlow();

  const angefragt: OnboardingStepId | null = isOnboardingStep(stepParam) ? stepParam : null;
  const erlaubt = angefragt ? flow.clampStep(angefragt) : flow.resumeStep;

  // Der Entwurf folgt der Adresse: Wer über den Zurück-Knopf des Browsers
  // einen Schritt zurückgeht, soll beim nächsten Aufruf auch dort aufsetzen.
  const { patchDraft, draft } = flow;
  useEffect(() => {
    if (angefragt && erlaubt === angefragt && draft.step !== angefragt) {
      patchDraft({ step: angefragt });
    }
  }, [angefragt, erlaubt, draft.step, patchDraft]);

  if (!angefragt || erlaubt !== angefragt) {
    return <Navigate to={`/willkommen/${erlaubt}`} replace />;
  }

  const gehe = (ziel: OnboardingStepId | null) => {
    if (ziel) navigate(`/willkommen/${ziel}`);
  };

  const vorschlag = draft.lifeSituation
    ? resolveFeatureSelection(draft.lifeSituation, draft.modifiers ?? [])
    : null;
  const gewaehlteBereiche: NavFeatureId[] = draft.features ?? vorschlag?.features ?? [];

  const inhalt = (() => {
    switch (angefragt) {
      case 'sprache':
        return (
          <LanguageStep
            onChoose={(locale) => {
              if ((SUPPORTED_LOCALES as readonly string[]).includes(locale)) {
                setLocale(locale as Locale);
              }
              gehe(flow.advanceFrom('sprache'));
            }}
          />
        );
      case 'weg':
        return (
          <PathStep
            onChoose={(path) => {
              flow.choosePath(path);
              // Nicht `advanceFrom`: der Weg entscheidet erst hier, welche
              // Schritte überhaupt folgen.
              gehe(path === 'anonymous' ? 'begruessung' : 'anmeldung');
            }}
          />
        );
      case 'anmeldung':
        return (
          <AuthStep
            onBack={() => {
              patchDraft({ path: undefined });
              gehe('weg');
            }}
          />
        );
      case 'begruessung':
        return (
          <GreetingStep
            accountName={flow.accountName}
            initialName={draft.displayName ?? ''}
            onContinue={(name) => {
              patchDraft({ displayName: name });
              gehe(flow.advanceFrom('begruessung'));
            }}
          />
        );
      case 'situation':
        return (
          <SituationStep
            onChoose={(id: LifeSituationId) => {
              patchDraft({ lifeSituation: id, features: undefined });
              gehe(flow.advanceFrom('situation'));
            }}
            onSkip={() => {
              // `null` = gefragt und übersprungen. Ohne Situation bleibt die
              // Navigation vollständig — und die Umstände hätten nichts, was
              // sie ergänzen könnten.
              patchDraft({ lifeSituation: null, modifiers: [], features: undefined });
              gehe('premium');
            }}
          />
        );
      case 'umstaende':
        return (
          <ModifiersStep
            selected={draft.modifiers ?? []}
            onToggle={(id: ModifierId) => {
              const aktuell = draft.modifiers ?? [];
              patchDraft({
                modifiers: aktuell.includes(id)
                  ? aktuell.filter((m) => m !== id)
                  : [...aktuell, id],
                features: undefined,
              });
            }}
            onContinue={() => gehe(flow.advanceFrom('umstaende'))}
            onBack={() => gehe(flow.retreatFrom('umstaende'))}
          />
        );
      case 'bereiche':
        return (
          <FeaturesStep
            catalog={catalog}
            selected={gewaehlteBereiche}
            onToggle={(id) =>
              patchDraft({
                features: gewaehlteBereiche.includes(id)
                  ? gewaehlteBereiche.filter((f) => f !== id)
                  : [...gewaehlteBereiche, id],
              })
            }
            onContinue={() => gehe(flow.advanceFrom('bereiche'))}
            onBack={() => gehe(flow.retreatFrom('bereiche'))}
          />
        );
      case 'premium':
        return (
          <PremiumStep
            anonymous={!flow.context.authenticated}
            onContinue={() => gehe(flow.advanceFrom('premium'))}
            onBack={() => gehe(flow.retreatFrom('premium'))}
            onOpenBilling={() => navigate('/billing')}
          />
        );
      case 'start':
        return (
          <StartStep
            anonymous={!flow.context.authenticated}
            saving={flow.saving}
            saveFailed={flow.saveFailed}
            onBack={() => gehe(flow.retreatFrom('start'))}
            onFinish={({ source, startTutorial }) => {
              void flow.finish({ source, startTutorial }).then(
                () => navigate(DESTINATION[source], { replace: true }),
                // Der Fehlerfall bleibt auf der Seite stehen: `saveFailed`
                // zeigt ihn an, die Wahl ist wiederholbar.
                () => {},
              );
            }}
          />
        );
    }
  })();

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10 text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand/10 via-premium/10 to-transparent" />

      <div className="z-10 w-full max-w-2xl space-y-6">
        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
          {t('onboardingFlow.progressLabel', 'Schritt {current} von {total}')
            .replace('{current}', String(flow.position.current))
            .replace('{total}', String(flow.position.total))}
        </p>

        {flow.settingsError && (
          <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 p-3">
            <p className="text-sm text-destructive">
              {t('onboardingFlow.loadError', 'Deine Einstellungen konnten nicht gelesen werden.')}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => window.location.reload()}
            >
              {t('onboardingFlow.retry', 'Erneut versuchen')}
            </Button>
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={angefragt}
            initial={reduce ? false : { opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: -40 }}
            transition={
              reduce
                ? { duration: 0 }
                : {
                    duration: MOTION_DURATIONS.default / 1000,
                    ease: MOTION_EASINGS_BEZIER.precision,
                  }
            }
          >
            {inhalt}
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
}
