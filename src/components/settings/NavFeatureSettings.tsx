import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import FeatureSelection from '@/features/onboarding/presentation/FeatureSelection';
import { onboardingFeatureCatalog } from '@/components/layout/nav-config';
import RestartOnboardingButton from '@/features/onboarding/presentation/RestartOnboardingButton';
import { getUserSettings, updateUserSettings } from '@/services/user-settings-service';
import {
  LIFE_SITUATIONS,
  NAV_FEATURE_PATHS,
  isBusinessModeEnabled,
  type NavFeatureId,
} from '@/lib/life-situations';
import type { UserSettings } from '@/types';
import { showError } from '@/utils/toast';
import { useI18n } from '@/i18n/useI18n';

const ALL_FEATURES = Object.keys(NAV_FEATURE_PATHS) as NavFeatureId[];

/**
 * Dauerhafter Schalter für die Bereichsauswahl aus dem Onboarding — „jederzeit
 * änderbar" ist hier eingelöst.
 *
 * `enabled_nav_features === null` heißt „keine Einschränkung". In der UI wird
 * das als „alles aktiv" dargestellt: für den Nutzer ist beides dasselbe, und
 * ein leerer Zustand wäre irreführend.
 */
export default function NavFeatureSettings() {
  const { t } = useI18n();
  // Labels und Symbole der Bereiche kommen aus der Navigation; die Auswahl
  // selbst liegt im Onboarding-Slice und darf sie nicht lesen (Begründung in
  // `features/onboarding/domain/feature-rows.ts`).
  const catalog = onboardingFeatureCatalog();
  const queryClient = useQueryClient();
  const { data: settings } = useQuery({ queryKey: ['userSettings'], queryFn: getUserSettings });

  const mutation = useMutation({
    mutationFn: (updates: Partial<UserSettings>) => updateUserSettings(updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['userSettings'] }),
    onError: () =>
      showError(t('onboarding.saveError', 'Auswahl konnte nicht gespeichert werden.')),
  });

  const stored = settings?.enabled_nav_features ?? null;
  const selected = stored ?? ALL_FEATURES;

  // `unlocked_features == null` heißt „Freischaltung nicht in Gebrauch" — dann
  // ist nichts gesperrt und es gibt auch nichts freizuschalten.
  const locked = (settings?.unlocked_features ?? null) !== null;

  const lifeSituation = LIFE_SITUATIONS.find((a) => a.id === settings?.onboarding_life_situation);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          {t('onboarding.manage.title', 'Bereiche & Navigation')}
        </CardTitle>
        <CardDescription>
          {t(
            'onboarding.manage.description',
            'Welche Bereiche in der Navigation erscheinen. Ausgeblendetes bleibt über Links und Lesezeichen erreichbar.',
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          {lifeSituation
            ? t('onboarding.manage.current', 'Gewählte Situation: {situation}').replace(
                '{situation}',
                t(lifeSituation.labelKey, lifeSituation.id),
              )
            : t('onboarding.manage.none', 'Keine Situation gewählt — es ist alles sichtbar.')}
        </p>

        <FeatureSelection
          hideHeading
          catalog={catalog}
          selected={selected}
          onToggle={(id) =>
            mutation.mutate({
              enabled_nav_features: selected.includes(id)
                ? selected.filter((f) => f !== id)
                : ALL_FEATURES.filter((f) => f === id || selected.includes(f)),
            })
          }
        />

        {isBusinessModeEnabled(stored) && (
          // Der abgelöste Einzelunternehmer-Schalter trug diesen Hinweis; ohne
          // markierte Geschäftskonten bleibt die EÜR leer. Bestehender Key.
          <p className="text-xs text-muted-foreground">
            {t(
              'settings.businessMode.hint',
              'Markiere anschließend deine Geschäftskonten in der Kontoverwaltung.',
            )}
          </p>
        )}

        {locked && (
          // Der Ausgang aus der behutsamen Heranführung. Er erscheint nur,
          // solange es etwas freizuschalten gibt: ein Knopf ohne Wirkung wäre
          // schlimmer als keiner. Ohne diesen Ausgang kippt Behutsamkeit in
          // Bevormundung (`docs/tutorial-progressive-disclosure.md`).
          <p className="text-xs text-muted-foreground">
            {t(
              'onboarding.manage.unlockHint',
              'Manche Bereiche schaltet das Tutorial nach und nach frei. Du kannst das jederzeit überspringen.',
            )}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={mutation.isPending || stored === null}
            onClick={() => mutation.mutate({ enabled_nav_features: null })}
          >
            {t('onboarding.manage.showAll', 'Alle Bereiche anzeigen')}
          </Button>
          {locked && (
            <Button
              variant="outline"
              size="sm"
              disabled={mutation.isPending}
              // `null` = Achse nicht in Gebrauch. Bewusst nicht „alle Bereiche
              // aufzählen": eine Liste würde bei jedem neuen Bereich veralten.
              onClick={() => mutation.mutate({ unlocked_features: null })}
            >
              {t('onboarding.manage.unlockAll', 'Alles freischalten')}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            disabled={mutation.isPending}
            // `undefined` = „nie gefragt" — genau der Zustand, in dem der
            // Einstieg wieder greift. Er setzt dann NICHT bei der Sprachwahl
            // auf, sondern bei der Lebenssituation: Sprache und Zugang sind für
            // diesen Nutzer entschiedene Tatsachen (`firstRunStep`).
            onClick={() => mutation.mutate({ onboarding_life_situation: undefined })}
          >
            {t('onboarding.manage.restart', 'Situation neu wählen')}
          </Button>
          {/* Der ganze Einstieg von der Sprachwahl an — daneben, weil es eine
              andere Handlung ist als „nur die Situation neu".
              Steht hier UND im Profil, und das ist kein Versehen: Wer anonym
              unterwegs ist, hat gar kein Profil (`UserQuickProfile` zeigt ihm
              den Anmelde-Einstieg), und genau dieser Nutzer ist der Regelfall
              dieser App. Ein Weg, den die Hälfte der Nutzer nicht sieht, ist
              keiner. */}
          <RestartOnboardingButton />
        </div>
      </CardContent>
    </Card>
  );
}
