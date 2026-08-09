/**
 * Tab-Leiste der Trading-Fläche.
 *
 * Aus `TradingDashboard.tsx` herausgelöst (WP 6.3). Welche Tabs es gibt, hängt
 * am Depottyp: Die sieben eToro-Tabs erscheinen nur für eToro-Depots, die drei
 * allgemeinen immer. Der aktive Tab lebt im ViewModel (`useEtoroAccount`) und
 * wird weder in der URL noch dauerhaft gespeichert — beim Depotwechsel fällt er
 * absichtlich auf die Voreinstellung zurück.
 */
import { useI18n } from '@/i18n/useI18n';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';

export interface TradingTabsBarProps {
  /** eToro-Depot: blendet die sieben Konto-Tabs vor den allgemeinen ein. */
  isEtoro: boolean;
}

export default function TradingTabsBar({ isEtoro }: TradingTabsBarProps) {
  const { t } = useI18n();
  // Schlüssel ausgeschrieben statt interpoliert: Ein `t(\`…${tab}\`)` wäre für
  // den Aufrufstellen-Wächter (`call-site-keys.test.ts`) unsichtbar, und ein
  // vertippter Key fiele erst auf dem Bildschirm auf.
  const etoroTabs = [
    { value: 'overview', label: t('trading.etoro.tabs.overview') },
    { value: 'mirrors', label: t('trading.etoro.tabs.mirrors') },
    { value: 'history', label: t('trading.etoro.tabs.history') },
    { value: 'analysis', label: t('trading.etoro.tabs.analysis') },
    { value: 'watchlists', label: t('trading.etoro.tabs.watchlists') },
    { value: 'news', label: t('trading.etoro.tabs.news') },
    { value: 'discover', label: t('trading.etoro.tabs.discover') },
  ];

  return (
    // Horizontal scrollbar, damit die eToro-Tabs auch mobil vollständig
    // erreichbar bleiben; Fade-Kante rechts signalisiert weitere Tabs.
    <div className="-mx-1 overflow-x-auto px-1 [-webkit-overflow-scrolling:touch] [mask-image:linear-gradient(to_right,transparent,black_12px,black_calc(100%-12px),transparent)]">
      <TabsList className="w-max flex-nowrap">
        {isEtoro &&
          etoroTabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="shrink-0">
              {tab.label}
            </TabsTrigger>
          ))}
        <TabsTrigger value="positions" className="shrink-0">{t('trading.dashboard.tabs.positions')}</TabsTrigger>
        <TabsTrigger value="performance" className="shrink-0">{t('trading.dashboard.tabs.performance')}</TabsTrigger>
        <TabsTrigger value="portfolios" className="shrink-0">{t('trading.dashboard.tabs.portfolios')}</TabsTrigger>
      </TabsList>
    </div>
  );
}
