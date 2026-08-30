import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { type NavFeatureId } from '@/lib/life-situations';
import { useI18n } from '@/i18n/useI18n';
import type { FeatureCatalog } from '../domain/feature-rows';

interface FeatureSelectionProps {
  /**
   * Bereiche, Labels und Symbole. Wird von aussen gereicht statt aus
   * `nav-config` gezogen — Begründung in `domain/feature-rows.ts`.
   */
  catalog: FeatureCatalog;
  selected: readonly NavFeatureId[];
  onToggle: (id: NavFeatureId) => void;
  /** Überschrift/Erklärung ausblenden, wenn der Rahmen sie schon liefert. */
  hideHeading?: boolean;
}

/**
 * Schritt 2 des Onboardings (und zugleich der Dauer-Schalter in den
 * Einstellungen): jeder Bereich einzeln an- und abwählbar, vorbelegt aus der
 * gewählten Situation.
 *
 * Labels und Icons kommen aus `NAV_GROUPS` statt aus einer zweiten Liste —
 * sonst driften Onboarding und Navigation auseinander. Kernbereiche erscheinen
 * bewusst als reine Aufzählung ohne Schalter: sie sind nicht abwählbar, und ein
 * dauerhaft deaktivierter Schalter würde das Gegenteil suggerieren.
 */
export default function FeatureSelection({
  catalog,
  selected,
  onToggle,
  hideHeading = false,
}: FeatureSelectionProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-5">
      {!hideHeading && (
        <div className="space-y-1">
          <h2 className="font-display text-lg font-semibold">
            {t('onboarding.featuresTitle', 'Das schlagen wir dir vor')}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t(
              'onboarding.featuresHint',
              'Alles einzeln an- und abwählbar. Abgewählte Bereiche sind nur ausgeblendet, nicht gesperrt.',
            )}
          </p>
        </div>
      )}

      <p className="text-xs font-medium text-muted-foreground">
        {t('onboarding.selectedCount', '{count} von {total} Bereichen aktiv')
          .replace('{count}', String(selected.length))
          .replace('{total}', String(catalog.total))}
      </p>

      {catalog.groups.map((group) => {
        return (
          <div key={group.id} className="space-y-1">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {t(group.labelKey, group.label)}
            </h3>
            <div className="divide-y rounded-md border">
              {group.rows.map((item) => {
                const Icon = item.icon;
                const feature = item.feature;
                const inputId = `feature-${feature}`;
                return (
                  <div key={feature} className="flex items-center gap-3 px-3 py-2.5">
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <Label htmlFor={inputId} className="cursor-pointer text-sm">
                        {t(item.labelKey, item.label)}
                      </Label>
                      {item.subtitle && (
                        <p className="truncate text-[11px] text-muted-foreground">
                          {t(item.subtitleKey ?? '', item.subtitle)}
                        </p>
                      )}
                    </div>
                    <Switch
                      id={inputId}
                      checked={selected.includes(feature)}
                      onCheckedChange={() => onToggle(feature)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="space-y-1">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {t('onboarding.coreTitle', 'Immer dabei')}
        </h3>
        <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-md border border-dashed px-3 py-2.5">
          {catalog.core.map((item) => {
            const Icon = item.icon;
            return (
              <span
                key={item.path}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {t(item.labelKey, item.label)}
              </span>
            );
          })}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {t('onboarding.coreHint', 'Diese Bereiche bleiben in jeder Situation sichtbar.')}
        </p>
      </div>
    </div>
  );
}
