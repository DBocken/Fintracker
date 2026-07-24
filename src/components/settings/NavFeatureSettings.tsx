import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import FeatureSelection from '@/components/onboarding/FeatureSelection';
import { getUserSettings, updateUserSettings } from '@/services/user-settings-service';
import { ARCHETYPES, NAV_FEATURE_PATHS, type NavFeatureId } from '@/lib/archetypes';
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

  const archetype = ARCHETYPES.find((a) => a.id === settings?.onboarding_archetype);

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
          {archetype
            ? t('onboarding.manage.current', 'Gewählte Situation: {archetype}').replace(
                '{archetype}',
                t(archetype.labelKey, archetype.id),
              )
            : t('onboarding.manage.none', 'Keine Situation gewählt — es ist alles sichtbar.')}
        </p>

        <FeatureSelection
          hideHeading
          selected={selected}
          onToggle={(id) =>
            mutation.mutate({
              enabled_nav_features: selected.includes(id)
                ? selected.filter((f) => f !== id)
                : ALL_FEATURES.filter((f) => f === id || selected.includes(f)),
            })
          }
        />

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={mutation.isPending || stored === null}
            onClick={() => mutation.mutate({ enabled_nav_features: null })}
          >
            {t('onboarding.manage.showAll', 'Alle Bereiche anzeigen')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={mutation.isPending}
            // `undefined` = „nie gefragt" — genau der Zustand, in dem der
            // Onboarding-Dialog wieder erscheint.
            onClick={() => mutation.mutate({ onboarding_archetype: undefined })}
          >
            {t('onboarding.manage.restart', 'Situation neu wählen')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
