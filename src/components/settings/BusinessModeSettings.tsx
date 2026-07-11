import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { getUserSettings, updateUserSettings } from '@/services/user-settings-service';
import { showError } from '@/utils/toast';
import { useI18n } from '@/i18n/useI18n';

/**
 * Opt-in für den Einzelunternehmer-Modus („Ruhe vor Fülle"): schaltet die
 * EÜR-Seite in der Nav, die Steuer-Stufe im Liquiditäts-Wasserfall und
 * EÜR-Vorschläge auf Geschäftskonten frei. Der Rücklage-Prozentsatz daneben
 * (TaxReserveSettings) wird mitgenutzt.
 */
export default function BusinessModeSettings() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { data: settings } = useQuery({ queryKey: ['userSettings'], queryFn: getUserSettings });

  const mutation = useMutation({
    mutationFn: (enabled: boolean) => updateUserSettings({ business_mode: enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['userSettings'] }),
    onError: () => showError(t('settings.businessMode.saveError', 'Einstellung konnte nicht gespeichert werden.')),
  });

  const enabled = Boolean(settings?.business_mode);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t('settings.businessMode.title', 'Einzelunternehmer-Modus')}</CardTitle>
        <CardDescription>
          {t('settings.businessMode.description', 'Schaltet EÜR-Übersicht, Steuerrücklage-Tank und die Steuer-Stufe im Liquiditäts-Wasserfall frei.')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <Label htmlFor="business-mode">{t('settings.businessMode.label', 'EÜR & Geschäftskonten aktivieren')}</Label>
            <p className="text-xs text-muted-foreground">
              {t('settings.businessMode.hint', 'Markiere anschließend deine Geschäftskonten in der Kontoverwaltung.')}
            </p>
          </div>
          <Switch
            id="business-mode"
            checked={enabled}
            disabled={mutation.isPending}
            onCheckedChange={(checked) => mutation.mutate(checked === true)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
