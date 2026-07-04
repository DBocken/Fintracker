import { useMemo } from 'react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { getAusgabenklasseColor } from '@/lib/ausgabenklasse-colors';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n/useI18n';
import type { Category } from '@/types';
import type { AusgabenklasseFilter } from './filter-constants';

// Werte sind stabile Klassen-Schlüssel; nur die Labels werden übersetzt.
const AUSGABENKLASSE_LABEL_KEYS: Record<string, [string, string]> = {
  essenziell: ['dashboard.essential', 'Essenziell'],
  diskretionaer: ['dashboard.classDiscretionary', 'Nicht-Essenziell'],
  sparen: ['dashboard.classSavings', 'Sparen'],
  einkommen: ['dashboard.classIncome', 'Einkommen'],
  unkategorisiert: ['dashboard.uncategorized', 'Unkategorisiert'],
};

interface AusgabenklasseFilterProps {
  value: AusgabenklasseFilter;
  onChange: (value: AusgabenklasseFilter) => void;
  categories: Category[];
  className?: string;
}

export function AusgabenklasseFilterComponent({
  value,
  onChange,
  categories,
  className,
}: AusgabenklasseFilterProps) {
  const { t } = useI18n();
  // Kategorien nach Ausgabenklasse gruppieren
  const kategoriesByKlasse = useMemo(() => {
    const map = new Map<string, Category[]>();

    categories.forEach(cat => {
      const klasse = cat.attributes?.ausgabenklasse || 'unkategorisiert';
      if (!map.has(klasse)) map.set(klasse, []);
      map.get(klasse)!.push(cat);
    });

    return map;
  }, [categories]);

  return (
    <Select value={value} onValueChange={(v) => onChange(v as AusgabenklasseFilter)}>
      <SelectTrigger aria-label={t('dashboard.filterClassAria', 'Ausgabenklasse filtern')} className={cn(className ?? 'w-48', 'bg-background/50 backdrop-blur-sm')}>
        <SelectValue placeholder={t('dashboard.allClasses', 'Alle Klassen')} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{t('dashboard.allClasses', 'Alle Klassen')}</SelectItem>

        {Object.entries(AUSGABENKLASSE_LABEL_KEYS).map(([klasse, [labelKey, labelFallback]]) => (
          <SelectItem key={klasse} value={klasse}>
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: getAusgabenklasseColor(klasse as import('@/types').Ausgabenklasse) }}
                aria-hidden="true"
              />
              <span>{t(labelKey, labelFallback)}</span>
              {kategoriesByKlasse.get(klasse) && (
                <span className="text-xs text-muted-foreground ml-1">
                  ({kategoriesByKlasse.get(klasse)!.length})
                </span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
