/**
 * Schritt 7 — „Welche Funktionen sind für dich wichtig?"
 *
 * **Erst die Aussage, dann die Konfiguration.** Die Fläche zeigt zuerst das
 * ERGEBNIS der Lebenssituation — welche Bereiche eingeblendet werden — und
 * öffnet die zwölf Schalter erst auf Wunsch. Vorher standen sie sofort da:
 * eine Einstellungsfläche, die etwas abfragt, bevor der Nutzer weiß, wofür es
 * gut ist (*premature configuration*).
 *
 * Die Reihenfolge ist die Regel aus `docs/architecture/darstellungsdichte.md`:
 * Aussage → Detail → Konfiguration.
 */

import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { NavFeatureId } from '@/lib/life-situations';
import { useI18n } from '@/i18n/useI18n';
import FeatureSelection from '../FeatureSelection';
import type { FeatureCatalog, FeatureRow } from '../../domain/feature-rows';

export interface FeaturesStepProps {
  catalog: FeatureCatalog;
  selected: readonly NavFeatureId[];
  onToggle: (id: NavFeatureId) => void;
  onContinue: () => void;
  onBack: () => void;
}

/** Die gewählten Bereiche in Navigations-Reihenfolge, mit Label und Symbol. */
function chosenRows(catalog: FeatureCatalog, selected: readonly NavFeatureId[]): FeatureRow[] {
  return catalog.groups.flatMap((group) =>
    group.rows.filter((row) => selected.includes(row.feature)),
  );
}

export default function FeaturesStep({
  catalog,
  selected,
  onToggle,
  onContinue,
  onBack,
}: FeaturesStepProps) {
  const { t } = useI18n();
  const [anpassen, setAnpassen] = useState(false);
  const gewaehlt = chosenRows(catalog, selected);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold">
          {t('onboardingFlow.featuresTitle', 'Welche Funktionen sind für dich wichtig?')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('onboardingFlow.featuresSubtitle', '')}
        </p>
      </div>

      {anpassen ? (
        <FeatureSelection hideHeading catalog={catalog} selected={selected} onToggle={onToggle} />
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-medium">
            {t('onboardingFlow.featuresChosen', 'Das blenden wir für dich ein')}
          </p>
          <ul className="flex flex-wrap gap-2">
            {gewaehlt.map((row) => {
              const Icon = row.icon;
              return (
                <li
                  key={row.feature}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                  {t(row.labelKey, row.label)}
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted-foreground">
            {t('onboardingFlow.featuresCoreHint', '')}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <Button variant="ghost" onClick={onBack}>
          {t('onboardingFlow.back', 'Zurück')}
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setAnpassen((offen) => !offen)}>
            <SlidersHorizontal className="mr-2 h-4 w-4" aria-hidden="true" />
            {anpassen
              ? t('onboardingFlow.featuresAdjustDone', 'Fertig')
              : t('onboardingFlow.featuresAdjust', 'Bereiche anpassen')}
          </Button>
          <Button onClick={onContinue}>{t('onboardingFlow.next', 'Weiter')}</Button>
        </div>
      </div>
    </div>
  );
}
