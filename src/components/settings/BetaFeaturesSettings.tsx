import { Switch } from '@/components/ui/switch';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { useI18n } from '@/i18n/useI18n';

/**
 * Lokale Beta-Schalter. Bewusst standardmäßig aus – betrifft Bereiche, die nicht
 * zum monetarisierten Kern gehören (z. B. das Trading-Modul, Issue #33).
 */
export function BetaFeaturesSettings() {
  const [tradingEnabled, setTradingEnabled] = useFeatureFlag('trading_beta');
  const { t } = useI18n();

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-medium text-foreground">{t('settings.betaFeatures.tradingLabel')}</div>
          <p className="mt-1 text-sm text-muted-foreground">
            {t('settings.betaFeatures.tradingDescription')}
          </p>
        </div>
        <Switch
          checked={tradingEnabled}
          onCheckedChange={setTradingEnabled}
          aria-label={t('settings.betaFeatures.tradingAriaLabel')}
        />
      </div>
    </div>
  );
}

export default BetaFeaturesSettings;
