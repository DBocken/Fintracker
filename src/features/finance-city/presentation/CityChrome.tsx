/**
 * Chrome der Stadt oberhalb der Canvas (herausgelöst aus `CityPage.tsx` in
 * WP 6.4): Breadcrumb, Listenansicht-/Legenden-Knopf, Titel, Welt-Tabs und —
 * nur im Ausgaben-Tab — die Monatsleiste.
 *
 * Die gerenderte Höhe dieses Blocks ist `chromeTopPx` für die
 * Sichtzentrums-Korrektur des Kamera-Controllers
 * (`domain/camera-math.ts#visualCenterOffset`) — deshalb der durchgereichte
 * Ref auf den äußeren Container.
 *
 * „Ausgaben" und „Einnahmen" sind erreichbar; Ziele/Übersicht bleiben bewusst
 * `disabled` statt versteckt, damit die finale Navigationsstruktur (README,
 * „3 Ebenen") schon jetzt sichtbar ist.
 */

import type { MutableRefObject } from 'react';
import { motion } from 'framer-motion';
import { Building2, HelpCircle, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useI18n } from '@/i18n/useI18n';
import type { CityBreadcrumbEntry, CityLevel } from '../application/city-view-model';
import type { CityModelTab } from '../application/use-city-model';
import type { CityTimelineCursor } from '../application/use-city-timeline-cursor';
import { CityBreadcrumb } from './CityBreadcrumb';
import { CityTimelineBar } from './CityTimelineBar';

const CITY_TABS = [
  { value: 'overview', labelKey: 'city.tabOverview' },
  { value: 'income', labelKey: 'city.tabIncome' },
  { value: 'expenses', labelKey: 'city.tabExpenses' },
  { value: 'goals', labelKey: 'city.tabGoals' },
] as const;

const ENABLED_CITY_TABS: ReadonlySet<string> = new Set(['overview', 'expenses', 'income', 'goals']);

export type CityChromeProps = {
  chromeRef: MutableRefObject<HTMLDivElement | null>;
  breadcrumb: CityBreadcrumbEntry[];
  onNavigate: (level: CityLevel, id?: string) => void;
  showList: boolean;
  onToggleList: () => void;
  onOpenLegend: () => void;
  tab: CityModelTab;
  onTabChange: (tab: CityModelTab) => void;
  /** `undefined` = keine Zeitachse in dieser Welt (nur der Ausgaben-Tab hat eine). */
  timelineCursor?: CityTimelineCursor;
};

export function CityChrome(props: CityChromeProps) {
  const { t } = useI18n();

  return (
    <div ref={props.chromeRef} className="flex shrink-0 flex-col gap-3">
      <header className="flex shrink-0 flex-col gap-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <motion.div
            layoutId="dashboard-city-link"
            className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <CityBreadcrumb entries={props.breadcrumb} onNavigate={props.onNavigate} />
          </motion.div>

          {/* A11y-Fallback für die 3D-Ansicht (README): Listenansicht-Toggle —
              teilt denselben `nav`-State (kein Parallel-State). */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-pressed={props.showList}
            aria-label={props.showList ? t('city.listView.backToCanvas') : t('city.a11yListToggle')}
            onClick={props.onToggleList}
          >
            <List className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button type="button" variant="ghost" size="icon" aria-label={t('city.legend.open')} onClick={props.onOpenLegend}>
            <HelpCircle className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-foreground">{t('city.title')}</h1>
        </div>
      </header>

      <Tabs
        value={props.tab}
        onValueChange={(value) => {
          if (ENABLED_CITY_TABS.has(value)) props.onTabChange(value as CityModelTab);
        }}
        className="shrink-0"
      >
        <TabsList aria-label={t('city.title')}>
          {CITY_TABS.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              disabled={!ENABLED_CITY_TABS.has(tab.value)}
              aria-disabled={!ENABLED_CITY_TABS.has(tab.value)}
              // Kein TabsContent im Stadt-Tab-Chrome (die Tabs schalten das
              // Datenmodell der einen Canvas-Fläche) — ohne Panel ist Radix'
              // automatisches aria-controls eine dangling IDREF (axe critical).
              aria-controls={undefined}
            >
              {t(tab.labelKey)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {props.timelineCursor && <CityTimelineBar cursor={props.timelineCursor} />}
    </div>
  );
}
