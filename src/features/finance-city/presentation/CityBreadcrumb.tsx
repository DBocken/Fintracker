/**
 * Breadcrumb der drei Stadt-Ebenen (Stadt → Distrikt → Unterkategorie, siehe
 * README) — jeder Eintrag ist per `goTo` direkt anspringbar.
 * Herausgelöst aus `CityPage.tsx` in WP 6.4.
 */

import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/useI18n';
import type { CityBreadcrumbEntry, CityLevel } from '../application/city-view-model';

export type CityBreadcrumbProps = {
  entries: CityBreadcrumbEntry[];
  onNavigate: (level: CityLevel, id?: string) => void;
};

export function CityBreadcrumb({ entries, onNavigate }: CityBreadcrumbProps) {
  const { t } = useI18n();

  return (
    <nav aria-label={t('city.breadcrumbNavLabel')} className="flex flex-wrap items-center">
      {entries.map((entry, index) => {
        const isCurrent = index === entries.length - 1;
        return (
          <span key={`${entry.level}:${entry.id ?? 'root'}`} className="flex items-center">
            {index > 0 && <ChevronRight className="mx-0.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-current={isCurrent ? 'page' : undefined}
              className="h-11 min-w-11 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
              onClick={() => onNavigate(entry.level, entry.id ?? undefined)}
            >
              {entry.label}
            </Button>
          </span>
        );
      })}
    </nav>
  );
}
