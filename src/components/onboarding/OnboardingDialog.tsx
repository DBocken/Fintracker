import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { getUserSettings, updateUserSettings } from '@/services/user-settings-service';
import { resolveFeatureSelection, type LifeSituationId, type ModifierId, type NavFeatureId } from '@/lib/life-situations';
import type { UserSettings } from '@/types';
import { showError } from '@/utils/toast';
import { useI18n } from '@/i18n/useI18n';
import { collectOnboardingSignals } from '@/services/onboarding-signals-service';
import { proposeOnboarding } from '@/lib/onboarding-proposal';
import LifeSituationPicker from './LifeSituationPicker';
import FeatureSelection from './FeatureSelection';

/**
 * Onboarding: „Welche Situation beschreibt dich am ehesten?" → Vorauswahl der
 * Bereiche → einzeln bestätigen.
 *
 * Erscheint genau einmal, nämlich solange `onboarding_life_situation` `undefined`
 * ist (= nie gefragt). Überspringen speichert bewusst `null` (= gefragt,
 * abgelehnt) statt gar nichts — sonst käme der Dialog bei jedem Start wieder.
 *
 * Übersprungen heißt: `enabled_nav_features` bleibt ungesetzt und damit bleibt
 * die Navigation vollständig. Das Onboarding kann nur Sichtbarkeit einschränken,
 * niemals Zugriff — alle Routen bleiben registriert.
 */
export default function OnboardingDialog() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { data: settings } = useQuery({ queryKey: ['userSettings'], queryFn: getUserSettings });

  const [step, setStep] = useState<'lifeSituation' | 'features'>('lifeSituation');
  const [lifeSituation, setLifeSituation] = useState<LifeSituationId | null>(null);
  const [modifiers, setModifiers] = useState<ModifierId[]>([]);
  const [features, setFeatures] = useState<NavFeatureId[] | null>(null);
  /** Vorbelegung übernommen? Danach gewinnt immer die Hand des Nutzers. */
  const [proposalApplied, setProposalApplied] = useState(false);

  // Der Ertrag der Datenquellen-Weiche: Sind Buchungen da, muss die App nicht
  // mehr fragen, was sie ablesen kann. Der Vorschlag belegt nur vor — bestätigt
  // wird weiterhin von Hand, und ab der ersten eigenen Änderung rührt ihn
  // niemand mehr an.
  const { data: signals } = useQuery({
    queryKey: ['onboardingSignals'],
    queryFn: () => collectOnboardingSignals(),
  });
  const proposal = useMemo(() => (signals ? proposeOnboarding(signals) : null), [signals]);

  useEffect(() => {
    if (proposalApplied || !proposal?.lifeSituation) return;
    setLifeSituation(proposal.lifeSituation);
    setModifiers(proposal.modifiers);
    setProposalApplied(true);
  }, [proposal, proposalApplied]);

  const mutation = useMutation({
    mutationFn: (updates: Partial<UserSettings>) => updateUserSettings(updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['userSettings'] }),
    onError: () =>
      showError(t('onboarding.saveError', 'Auswahl konnte nicht gespeichert werden.')),
  });

  // `undefined` = nie gefragt. `null` = gefragt und übersprungen.
  //
  // Zusätzlich wartet der Dialog auf die Datenquellen-Weiche (Kapitel 0,
  // `DataSourceDialog`): erst wenn dort entschieden ist, kann die
  // Lebenssituation aus den importierten Daten *vorgeschlagen* statt erfragt
  // werden. Zwei Dialoge gleichzeitig wären ohnehin eine Zumutung.
  const open =
    settings !== undefined &&
    settings.tutorial_source !== undefined &&
    settings.onboarding_life_situation === undefined;

  const suggestion = useMemo(
    () => (lifeSituation ? resolveFeatureSelection(lifeSituation, modifiers) : null),
    [lifeSituation, modifiers],
  );

  // Vor der Bestätigung zeigt Schritt 2 den Vorschlag; sobald der Nutzer etwas
  // umschaltet, gilt seine Auswahl.
  const shownFeatures = features ?? suggestion?.features ?? [];

  const goToFeatures = () => {
    setFeatures(null); // Vorschlag zur aktuellen Lebenssituation neu ziehen
    setStep('features');
  };

  const finish = () => {
    if (!lifeSituation || !suggestion) return;
    mutation.mutate({
      onboarding_life_situation: lifeSituation,
      onboarding_modifiers: modifiers,
      enabled_nav_features: shownFeatures,
      ...suggestion.settings,
    });
  };

  const skip = () => mutation.mutate({ onboarding_life_situation: null });

  return (
    <Dialog open={open}>
      <DialogContent
        className="max-h-[85vh] max-w-2xl overflow-y-auto"
        aria-describedby={undefined}
        // Kein Schließen per Escape/Klick daneben: der Weg hinaus führt über
        // „Später entscheiden", damit der Zustand eindeutig gespeichert wird.
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/*
          Radix verlangt in jedem DialogContent einen DialogTitle — ohne ihn
          hat der Dialog kein zugaengliches Label und die Konsole warnt (der
          Befund aus dem E2E-Lauf).

          Der Titel benennt bewusst den DIALOG und nicht den aktuellen Schritt.
          Beide Schritte tragen bereits eine sichtbare <h2>; haette der
          DialogTitle denselben Wortlaut, laese ein Screenreader den Text
          zweimal — einmal als Dialogname, einmal als Ueberschrift. Die <h2>
          selbst als DialogTitle auszuweisen geht nicht: sie steckt in
          Kindkomponenten, und FeatureSelection wird ausserdem in den
          Einstellungen ohne Dialog verwendet.

          sr-only, weil der Dialog seinen Namen ansagt, aber keine zweite
          sichtbare Ueberschrift braucht.
        */}
        <DialogTitle className="sr-only">
          {t('onboarding.dialogLabel', 'Einrichtung')}
        </DialogTitle>
        {step === 'lifeSituation' ? (
          <>
          {proposalApplied && (
            <p className="text-xs text-muted-foreground">
              {t('onboarding.proposalHint', 'Aus deinen Daten geschätzt. Stimmt das nicht, ändere es einfach.')}
            </p>
          )}
          <LifeSituationPicker
            value={lifeSituation}
            modifiers={modifiers}
            onChange={setLifeSituation}
            onToggleModifier={(id) =>
              setModifiers((prev) =>
                prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
              )
            }
          />
          </>
        ) : (
          <FeatureSelection
            selected={shownFeatures}
            onToggle={(id) =>
              setFeatures(
                shownFeatures.includes(id)
                  ? shownFeatures.filter((f) => f !== id)
                  : [...shownFeatures, id],
              )
            }
          />
        )}

        <div className="flex items-center justify-between gap-3 border-t pt-4">
          {step === 'lifeSituation' ? (
            <>
              <Button variant="ghost" onClick={skip} disabled={mutation.isPending}>
                {t('onboarding.skip', 'Später entscheiden')}
              </Button>
              <Button onClick={goToFeatures} disabled={!lifeSituation}>
                {t('onboarding.next', 'Weiter')}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setStep('lifeSituation')}>
                {t('onboarding.back', 'Zurück')}
              </Button>
              <Button onClick={finish} disabled={mutation.isPending}>
                {t('onboarding.finish', "Los geht's")}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
