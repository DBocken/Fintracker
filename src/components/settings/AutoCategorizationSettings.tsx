import { InfoGroup } from '@/features/shared/presentation/InfoGroup';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Shield } from 'lucide-react';
import { useI18n } from '@/i18n/useI18n';

interface AutoCategorizationSettingsProps {
  autoConfirm: boolean;
  onAutoConfirmChange: (enabled: boolean) => void;
}

export function AutoCategorizationSettings({ 
  autoConfirm, 
  onAutoConfirmChange 
}: AutoCategorizationSettingsProps) {
  const { t } = useI18n();

  // WP-8.1: karten-los (AGENTS.md Paragraf 9). Bedienbar war nur der Schalter,
  // nicht die Flaeche.
  return (
    <InfoGroup
      title={
        <span className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          {t('autoCategorization.title')}
        </span>
      }
    >
        <div className="flex items-center justify-between">
          <Label htmlFor="auto-confirm">{t('autoCategorization.autoConfirmLabel')}</Label>
          <Switch
            id="auto-confirm"
            checked={autoConfirm}
            onCheckedChange={onAutoConfirmChange}
          />
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          {t('autoCategorization.description')}
        </p>
    </InfoGroup>
  );
}