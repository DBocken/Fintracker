import { InfoGroup } from '@/features/shared/presentation/InfoGroup';
import { Slider } from '@/components/ui/slider';
import { Clock } from 'lucide-react';
import { useI18n } from '@/i18n/useI18n';

interface TimeRangeSettingsProps {
  retentionMonths: number;
  onRetentionChange: (months: number) => void;
}

export function TimeRangeSettings({ retentionMonths, onRetentionChange }: TimeRangeSettingsProps) {
  const { t } = useI18n();

  const getRetentionLabel = (months: number) => {
    if (months < 12) return t('settings.timeRange.months').replace('{months}', String(months));
    if (months === 12) return t('settings.timeRange.year');
    return t('settings.timeRange.years').replace('{years}', String(months / 12));
  };

  // WP-8.1: karten-los (AGENTS.md Paragraf 9). Der Rahmen versprach eine
  // Aktion auf der ganzen Flaeche, die es nie gab — bedienbar war nur der
  // Schieberegler.
  return (
    <InfoGroup
      title={
        <span className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          {t('settings.timeRange.title')}
        </span>
      }
    >
        <div className="space-y-2">
          <Slider
            aria-label={t('settings.timeRange.title')}
            value={[retentionMonths]}
            onValueChange={([value]: number[]) => onRetentionChange(value)}
            min={1}
            max={120}
            step={1}
          />
          <div className="text-center text-sm text-muted-foreground">
            {getRetentionLabel(retentionMonths)}
          </div>
        </div>
    </InfoGroup>
  );
}