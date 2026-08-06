/**
 * Nicht-visuelle A11y-Parallelstruktur der Finanzstadt (WP-C5, README
 * Akzeptanzkriterium "vollständig nicht-visuelle Alternative … 3D ist nie
 * der einzige Zugriffsweg auf die Daten"). Teilt den Navigations-State 1:1
 * mit der 3D-Ansicht (`nav.actions` aus `use-city-navigation.ts`) — KEIN
 * Parallel-State: ein Zeilen-Tap ruft dieselbe Aktion wie ein Canvas-Tap.
 */
import { ArrowLeft } from 'lucide-react';
import InteractiveCard from '@/components/common/InteractiveCard';
import { useI18n } from '@/i18n/useI18n';
import { cn, formatCurrency, formatPercent } from '@/lib/utils';
import type { CityModel } from '../domain/city-model';
import type { CityNavigationViewModel } from '../application/city-view-model';
import { useMoneyFormat } from '@/hooks/useMoneyFormat';

export type CityAccessibleListProps = {
  model: CityModel;
  nav: CityNavigationViewModel;
  /** Optionaler "Zurück zur 3D-Ansicht"-Button innerhalb der Liste (zusätzlich zum Header-Toggle in `CityPage`). */
  onBackToCanvas?: () => void;
  className?: string;
};

type ListRow = { id: string; label: string; amount: number; onSelect: () => void };

/** Wählt Überschrift + Zeilen für die aktuell sichtbare Ebene — dieselben Ids/Aktionen wie `handleTapBox` in `CityPage.tsx` (Canvas-Pfad), nur ohne Raycast. */
function buildRows(model: CityModel, nav: CityNavigationViewModel): { headingKey: string; rows: ListRow[] } {
  if (nav.level === 'city') {
    return {
      headingKey: 'city.listView.districtsHeading',
      rows: model.districts.map((district) => ({
        id: district.id,
        label: district.label,
        amount: district.total,
        onSelect: () => nav.actions.tapDistrict(district.id),
      })),
    };
  }

  if (nav.level === 'district') {
    const district = model.districts.find((d) => d.id === nav.activeDistrictId);
    return {
      headingKey: 'city.listView.subcategoriesHeading',
      rows: (district?.subcategories ?? []).map((subcategory) => ({
        id: subcategory.id,
        label: subcategory.label,
        amount: subcategory.amount,
        onSelect: () => nav.actions.tapSubcategory(subcategory.id),
      })),
    };
  }

  const district = model.districts.find((d) => d.id === nav.activeDistrictId);
  const subcategory = district?.subcategories.find((s) => s.id === nav.activeSubcategoryId);
  return {
    headingKey: 'city.listView.contractsHeading',
    rows: (subcategory?.contracts ?? []).map((contract) => ({
      id: contract.id,
      label: contract.label,
      amount: contract.amount,
      onSelect: () => nav.actions.tapContract(contract.id),
    })),
  };
}

export function CityAccessibleList({ model, nav, onBackToCanvas, className }: CityAccessibleListProps) {
  const money = useMoneyFormat();
  const { t } = useI18n();
  const pathLabel = nav.breadcrumb.map((entry) => entry.label).join(' → ');
  const { headingKey, rows } = buildRows(model, nav);

  return (
    <section
      aria-label={t('city.listView.title')}
      className={cn('flex h-full flex-col gap-3 overflow-y-auto', className)}
      data-testid="city-accessible-list"
    >
      {onBackToCanvas && (
        <button
          type="button"
          onClick={onBackToCanvas}
          className="flex min-h-11 w-fit items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
          {t('city.listView.backToCanvas')}
        </button>
      )}

      {/* Pfad-Landmark + Live-Ansage (README-Akzeptanzkriterium: Ebenen-/Fokuswechsel wird angesagt). Die interaktive Breadcrumb-Navigation bleibt im immer sichtbaren `CityPage`-Header (`nav.actions.goTo`) — kein Duplikat hier. */}
      <nav aria-label={t('city.breadcrumbNavLabel')}>
        <p aria-live="polite" data-testid="city-list-path-announcement" className="text-sm text-muted-foreground">
          {t('city.listView.pathAnnouncement').replace('{path}', pathLabel)}
        </p>
      </nav>

      <h2 className="text-sm font-semibold text-foreground">{t(headingKey)}</h2>

      <ul className="flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.id}>
            {/* Karten-Regel (docs/design-principles.md #8): die GANZE Zeile
                ist das Klick-Ziel — `InteractiveCard` liefert Chevron-
                Affordanz, Hover/Fokusring und das ≥44px-Touch-Ziel, nicht nur
                ein verschachtelter Button in einer toten Karten-Hülle. */}
            <InteractiveCard
              onClick={row.onSelect}
              aria-label={`${row.label} · ${
                model.valueKind === 'progress'
                  ? t('city.listView.progressAmount').replace('{amount}', formatPercent(row.amount, 0))
                  : t('city.listView.monthlyAmount').replace('{amount}', money.mask(formatCurrency(row.amount)))
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-foreground">{row.label}</span>
                {/* WP-D7: Ziele-Modell trägt Fortschritts-Brüche, keine Euros. */}
                <span className="text-muted-foreground">
                  {model.valueKind === 'progress' ? formatPercent(row.amount, 0) : money.mask(formatCurrency(row.amount))}
                </span>
              </div>
            </InteractiveCard>
          </li>
        ))}
      </ul>
    </section>
  );
}
