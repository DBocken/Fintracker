import { useMemo } from 'react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { getAusgabenklasseColor } from '@/lib/ausgabenklasse-colors';
import type { Category } from '@/types';
import type { AusgabenklasseFilter } from './filter-constants';

const AUSGABENKLASSE_LABELS = {
  essenziell: 'Essenziell',
  diskretionaer: 'Nicht-Essenziell',
  sparen: 'Sparen',
  einkommen: 'Einkommen',
  unkategorisiert: 'Unkategorisiert',
};

interface AusgabenklasseFilterProps {
  value: AusgabenklasseFilter;
  onChange: (value: AusgabenklasseFilter) => void;
  categories: Category[];
}

export function AusgabenklasseFilterComponent({
  value,
  onChange,
  categories,
}: AusgabenklasseFilterProps) {
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
      <SelectTrigger aria-label="Ausgabenklasse filtern" className="w-48 bg-background/50 backdrop-blur-sm">
        <SelectValue placeholder="Alle Klassen" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Alle Klassen</SelectItem>

        {Object.entries(AUSGABENKLASSE_LABELS).map(([klasse, label]) => (
          <SelectItem key={klasse} value={klasse}>
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: getAusgabenklasseColor(klasse as any) }}
                aria-hidden="true"
              />
              <span>{label}</span>
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
