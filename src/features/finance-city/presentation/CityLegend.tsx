import { useI18n } from '@/i18n/useI18n';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cityLegendItems, type CityLegendInput, type CityLegendItem } from '../domain/city-legend';

/**
 * WP-5.8 — Legende der visuellen Sprache der Finanzstadt.
 *
 * Die Stadt kodiert fünf Dinge gleichzeitig (Höhe, Distriktfarbe, Hülle,
 * Flusslinien, Fassaden-Fenster). Ein Kanal, den niemand liest, ist kein
 * Kanal, sondern Dekoration mit Extraschritten.
 *
 * Bewusst KEIN Tutorial und keine Tour: `docs/tutorial-progressive-disclosure.md`
 * legt dafür eine eigene Architektur fest (Freischaltungs-Achse ZUERST,
 * `data-tour-id`-Anker, Overlay danach). Die Legende ist eine in sich
 * geschlossene Erklärfläche — eine spätere Führung kann über
 * `data-tour-id="city-legend"` darauf zeigen, statt sie zu ersetzen.
 *
 * Bottom Sheet auf beiden Plattformen: der Inhalt ist kurz, und auf dem
 * Desktop verdeckt ein Sheet die Stadt weniger als ein zentrierter Dialog —
 * man kann nebenher hinschauen, worum es geht (AGENTS.md §4: gleiches Feature,
 * je Plattform passende Präsentation).
 */
export type CityLegendProps = CityLegendInput & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Schlüssel je Eintrag AUSGESCHRIEBEN statt per Template zusammengesetzt.
 * `src/i18n/__tests__/call-site-keys.test.ts` prüft Aufrufstellen gegen den
 * Übersetzungsbaum — ein zusammengesetzter Schlüssel (`city.legend.${item}Title`)
 * wäre für diesen Wächter unsichtbar, und ein Tippfehler landete als roher
 * Punkt-String auf dem Bildschirm (AGENTS.md §6, Falle „vertippter t()-Key").
 */
const LEGEND_KEYS: Record<CityLegendItem, { title: string; body: string }> = {
  height: { title: 'city.legend.heightTitle', body: 'city.legend.heightBody' },
  heightProgress: { title: 'city.legend.heightProgressTitle', body: 'city.legend.heightProgressBody' },
  districtColor: { title: 'city.legend.districtColorTitle', body: 'city.legend.districtColorBody' },
  goalStage: { title: 'city.legend.goalStageTitle', body: 'city.legend.goalStageBody' },
  hull: { title: 'city.legend.hullTitle', body: 'city.legend.hullBody' },
  floors: { title: 'city.legend.floorsTitle', body: 'city.legend.floorsBody' },
  flowLines: { title: 'city.legend.flowLinesTitle', body: 'city.legend.flowLinesBody' },
  activity: { title: 'city.legend.activityTitle', body: 'city.legend.activityBody' },
  projected: { title: 'city.legend.projectedTitle', body: 'city.legend.projectedBody' },
};

export function CityLegend({ open, onOpenChange, ...input }: CityLegendProps) {
  const { t } = useI18n();
  const items = cityLegendItems(input);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[70dvh] overflow-y-auto rounded-t-2xl" data-tour-id="city-legend">
        <SheetHeader>
          <SheetTitle>{t('city.legend.title')}</SheetTitle>
          <SheetDescription>{t('city.legend.description')}</SheetDescription>
        </SheetHeader>

        <dl className="mt-4 space-y-4">
          {items.map((item) => (
            <div key={item} data-testid={`city-legend-${item}`}>
              <dt className="text-sm font-medium text-foreground">{t(LEGEND_KEYS[item].title)}</dt>
              <dd className="mt-1 text-sm text-muted-foreground">{t(LEGEND_KEYS[item].body)}</dd>
            </div>
          ))}
        </dl>
      </SheetContent>
    </Sheet>
  );
}
