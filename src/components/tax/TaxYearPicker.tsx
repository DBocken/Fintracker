import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/i18n/useI18n';

interface TaxYearPickerProps {
  years: number[];
  value: number;
  onChange: (year: number) => void;
}

export function TaxYearPicker({ years, value, onChange }: TaxYearPickerProps) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="tax-year" className="text-sm text-muted-foreground">
        {t('tax.page.yearLabel', 'Steuerjahr')}
      </Label>
      <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger id="tax-year" className="w-32" aria-label={t('tax.page.yearLabel', 'Steuerjahr')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
