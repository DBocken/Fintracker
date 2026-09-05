/**
 * Die Beschriftung eines Bereichs — an EINER Stelle aufgelöst.
 *
 * Bereichsnamen kommen als durchgereichter Schlüssel aus der Navigation
 * (`labelKey` mit `label` als deutschem Rückfalltext). Das ist die richtige
 * Bauform — die Alternative wäre eine zweite Namensliste, die von der
 * Navigation wegdriftet —, aber sie ist für `call-site-keys.test.ts` nicht
 * prüfbar: Ein aus einer Variablen gebauter Schlüssel lässt sich nicht gegen
 * den Sprachbaum halten.
 *
 * Deshalb gibt es genau diesen einen Aufruf statt fünf verstreuter. Der Fleck
 * ist damit klein und benannt, und die Ratsche für dynamische Schlüssel sinkt,
 * statt mit jeder neuen Fläche zu wachsen.
 */

import { useCallback } from 'react';
import { useI18n } from '@/i18n/useI18n';

/** Alles, was einen übersetzbaren Namen mit deutschem Rückfalltext trägt. */
export interface Beschriftet {
  labelKey: string;
  label: string;
}

export function useFeatureLabel(): (row: Beschriftet) => string {
  const { t } = useI18n();
  return useCallback((row: Beschriftet) => t(row.labelKey, row.label), [t]);
}
