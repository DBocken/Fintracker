import { useI18n } from '@/i18n/useI18n';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
} from '@/components/ui/select';
import { TAX_RUBRICS, TAX_CATEGORIES } from '@/data/tax-catalog';

const NONE_VALUE = '__none__';

interface TaxCategorySelectProps {
  /** Aktuelle Steuer-Kategorie-ID oder null/undefined. */
  value: string | null | undefined;
  onChange: (taxCategoryId: string | null) => void;
  id?: string;
  className?: string;
  /** Label des „keine Auswahl"-Eintrags (unterscheidet Rubrik-Default vs. Markierung). */
  noneLabel?: string;
}

/**
 * Wiederverwendbares, nach Steuer-Rubrik gruppiertes Select für die Auswahl
 * einer Steuer-Kategorie. Emittiert die stabile Kategorie-ID (oder null).
 */
export function TaxCategorySelect({ value, onChange, id, className, noneLabel }: TaxCategorySelectProps) {
  const { t } = useI18n();

  return (
    <Select
      value={value || NONE_VALUE}
      onValueChange={(v) => onChange(v === NONE_VALUE ? null : v)}
    >
      <SelectTrigger id={id} className={className} aria-label={t('tax.form.selectPlaceholder', 'Steuer-Rubrik wählen …')}>
        <SelectValue placeholder={t('tax.form.selectPlaceholder', 'Steuer-Rubrik wählen …')} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE_VALUE}>{noneLabel ?? t('tax.form.notTaxRelevant', 'Nicht steuerrelevant')}</SelectItem>
        {TAX_RUBRICS.map((rubric) => {
          const cats = TAX_CATEGORIES.filter((c) => c.rubricId === rubric.id);
          if (cats.length === 0) return null;
          return (
            <SelectGroup key={rubric.id}>
              <SelectLabel>{t(rubric.nameKey as never, rubric.id)}</SelectLabel>
              {cats.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {t(c.nameKey as never, c.id)}
                </SelectItem>
              ))}
            </SelectGroup>
          );
        })}
      </SelectContent>
    </Select>
  );
}
