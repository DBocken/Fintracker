import InfoButton from '@/components/common/InfoSheet';
import { useI18n } from '@/i18n/useI18n';

export function TaxDisclaimer() {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-2 text-xs text-muted-foreground">
      <span>{t('tax.disclaimer.short', 'Keine Steuerberatung.')}</span>
      <InfoButton title={t('tax.disclaimer.title', 'Hinweis')} label={t('tax.disclaimer.title', 'Hinweis')}>
        <p>{t('tax.disclaimer.long', '')}</p>
      </InfoButton>
    </div>
  );
}
