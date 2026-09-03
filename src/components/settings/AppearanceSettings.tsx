import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import FinanceErrorState from '@/features/shared/presentation/FinanceErrorState';
import { Check } from 'lucide-react';
import { getUserSettings, updateUserSettings } from '@/services/transaction-service';
import { SKINS, normalizeSkinId, type SkinId } from '@/skins/skins';
import { applySkinClass } from '@/skins/skins';
import { ThemeToggle } from '@/components/ThemeToggle';
import { showError, showSuccess } from '@/utils/toast';
import { useI18n } from '@/i18n/useI18n';

export function AppearanceSettings() {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  // WP-9.6: Ohne den Fehlerfall zeigt der Screen die Standardwerte, als
  // waeren es die gespeicherten. Wer dann etwas umstellt, ueberschreibt seine
  // echte Einstellung mit einer, die er nie gesehen hat.
  const {
    data: settings,
    isError: settingsError,
    refetch: refetchSettings,
  } = useQuery({
    queryKey: ['userSettings'],
    queryFn: getUserSettings,
  });

  const skin: SkinId = normalizeSkinId(settings?.theme);

  const updateSkinMutation = useMutation({
    mutationFn: (nextSkin: SkinId) => updateUserSettings({ theme: nextSkin }),
    onSuccess: (_data, nextSkin) => {
      applySkinClass(nextSkin);
      localStorage.setItem('skin', nextSkin);
      queryClient.invalidateQueries({ queryKey: ['userSettings'] });
      showSuccess(t('settings.appearance.themeSavedSuccess'));
    },
    onError: () => showError(t('settings.appearance.themeSaveError')),
  });

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      {settingsError && (
        <div className="xl:col-span-2">
          <FinanceErrorState variant="data" onRetry={() => void refetchSettings()} />
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{t('settings.appearance.title')}</CardTitle>
          <CardDescription>{t('settings.appearance.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {SKINS.map((option) => {
              const isActive = option.id === skin;
              const locked = Boolean(option.isPremium);
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => !locked && updateSkinMutation.mutate(option.id)}
                  aria-pressed={isActive}
                  disabled={locked}
                  className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                    isActive
                      ? 'border-brand bg-brand/10'
                      : 'border-border hover:bg-accent/50'
                  } ${locked ? 'cursor-not-allowed opacity-60' : ''}`}
                >
                  <span
                    aria-hidden="true"
                    className="mt-0.5 h-8 w-8 shrink-0 rounded-md border border-border"
                    style={{ background: option.swatch }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{t(option.nameKey, option.name)}</span>
                      {locked && <Badge variant="secondary" className="text-[11px]">{t('settings.appearance.comingSoonBadge')}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">{t(option.descriptionKey, option.description)}</div>
                  </div>
                  {isActive && <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{t('settings.appearance.darkModeTitle')}</CardTitle>
          <CardDescription>{t('settings.appearance.darkModeDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">{t('settings.appearance.darkModeToggleLabel')}</span>
            <ThemeToggle />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default AppearanceSettings;
