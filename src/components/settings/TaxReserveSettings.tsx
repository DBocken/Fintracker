import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { getUserSettings, updateUserSettings } from '@/services/transaction-service';
import { resolveTaxReservePercent } from '@/lib/tax-reserve';
import { showError, showSuccess } from '@/utils/toast';
import { useI18n } from '@/i18n/useI18n';

/**
 * Einstellung für den Steuer-Puffer-Prozentsatz (0 = deaktiviert). Reine
 * Prozent-Faustregel, keine Steuerlogik.
 */
export default function TaxReserveSettings() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const { data: settings } = useQuery({ queryKey: ['userSettings'], queryFn: getUserSettings });

  const [value, setValue] = useState<string | null>(null);
  const current = value ?? String(resolveTaxReservePercent(settings));

  const mutation = useMutation({
    mutationFn: (percent: number) => updateUserSettings({ tax_reserve_percent: percent }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userSettings'] });
      showSuccess(t('settings.taxReserve.saved'));
    },
    onError: () => showError(t('settings.taxReserve.saveError')),
  });

  const handleSave = () => {
    const n = Math.max(0, Math.min(100, Number(current) || 0));
    mutation.mutate(n);
    setValue(String(n));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">{t('settings.taxReserve.title')}</CardTitle>
        <CardDescription>{t('settings.taxReserve.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="tax-reserve-percent">{t('settings.taxReserve.label')}</Label>
          <Input
            id="tax-reserve-percent"
            type="number"
            min={0}
            max={100}
            value={current}
            onChange={(e) => setValue(e.target.value)}
            className="max-w-[120px]"
          />
        </div>
        <p className="text-xs text-muted-foreground">{t('income.tax.disclaimer')}</p>
        <Button onClick={handleSave} disabled={mutation.isPending}>
          {t('common.save')}
        </Button>
      </CardContent>
    </Card>
  );
}
