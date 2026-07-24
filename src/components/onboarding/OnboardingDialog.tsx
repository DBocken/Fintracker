import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { getUserSettings, updateUserSettings } from '@/services/user-settings-service';
import { resolveFeatureSelection, type ArchetypeId, type ModifierId, type NavFeatureId } from '@/lib/archetypes';
import type { UserSettings } from '@/types';
import { showError } from '@/utils/toast';
import { useI18n } from '@/i18n/useI18n';
import ArchetypePicker from './ArchetypePicker';
import FeatureSelection from './FeatureSelection';

/**
 * Onboarding: „Welche Situation beschreibt dich am ehesten?" → Vorauswahl der
 * Bereiche → einzeln bestätigen.
 *
 * Erscheint genau einmal, nämlich solange `onboarding_archetype` `undefined`
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

  const [step, setStep] = useState<'archetype' | 'features'>('archetype');
  const [archetype, setArchetype] = useState<ArchetypeId | null>(null);
  const [modifiers, setModifiers] = useState<ModifierId[]>([]);
  const [features, setFeatures] = useState<NavFeatureId[] | null>(null);

  const mutation = useMutation({
    mutationFn: (updates: Partial<UserSettings>) => updateUserSettings(updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['userSettings'] }),
    onError: () =>
      showError(t('onboarding.saveError', 'Auswahl konnte nicht gespeichert werden.')),
  });

  // `undefined` = nie gefragt. `null` = gefragt und übersprungen.
  const open = settings !== undefined && settings.onboarding_archetype === undefined;

  const suggestion = useMemo(
    () => (archetype ? resolveFeatureSelection(archetype, modifiers) : null),
    [archetype, modifiers],
  );

  // Vor der Bestätigung zeigt Schritt 2 den Vorschlag; sobald der Nutzer etwas
  // umschaltet, gilt seine Auswahl.
  const shownFeatures = features ?? suggestion?.features ?? [];

  const goToFeatures = () => {
    setFeatures(null); // Vorschlag zum aktuellen Archetyp neu ziehen
    setStep('features');
  };

  const finish = () => {
    if (!archetype || !suggestion) return;
    mutation.mutate({
      onboarding_archetype: archetype,
      onboarding_modifiers: modifiers,
      enabled_nav_features: shownFeatures,
      ...suggestion.settings,
    });
  };

  const skip = () => mutation.mutate({ onboarding_archetype: null });

  return (
    <Dialog open={open}>
      <DialogContent
        className="max-h-[85vh] max-w-2xl overflow-y-auto"
        // Kein Schließen per Escape/Klick daneben: der Weg hinaus führt über
        // „Später entscheiden", damit der Zustand eindeutig gespeichert wird.
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {step === 'archetype' ? (
          <ArchetypePicker
            value={archetype}
            modifiers={modifiers}
            onChange={setArchetype}
            onToggleModifier={(id) =>
              setModifiers((prev) =>
                prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id],
              )
            }
          />
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
          {step === 'archetype' ? (
            <>
              <Button variant="ghost" onClick={skip} disabled={mutation.isPending}>
                {t('onboarding.skip', 'Später entscheiden')}
              </Button>
              <Button onClick={goToFeatures} disabled={!archetype}>
                {t('onboarding.next', 'Weiter')}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setStep('archetype')}>
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
