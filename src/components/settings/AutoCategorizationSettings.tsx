import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
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

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Shield className="h-5 w-5" />
          {t('autoCategorization.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}