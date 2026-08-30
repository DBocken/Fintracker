/**
 * Die Form, in der die Bereichsauswahl ihre Zeilen erwartet.
 *
 * **Warum der Slice die Form vorgibt und nicht die Navigation.** Labels und
 * Symbole der Bereiche stehen in `src/components/layout/nav-config.ts` — und
 * genau dorthin darf eine Slice-Präsentation nicht greifen: Eine zweite
 * Präsentation (Android, anderer Shell) müsste sonst die Navigation der
 * alten Oberfläche mitschleppen, nur damit die Bereichsauswahl ihre Labels
 * findet. Dieselbe Begründung, die `check:slice-presentation` zählt.
 *
 * Also andersherum: Der Slice beschreibt, WAS er braucht, und die Oberfläche,
 * die die Navigation ohnehin kennt, füllt es aus (`onboardingFeatureRows()`).
 * Aus einer Abhängigkeit nach oben wird eine Angabe von oben.
 *
 * Der einzige React-Bezug ist der Typ des Symbols — eine reine Typangabe ohne
 * Laufzeitanteil, damit die Zeile ihr Icon tragen kann.
 */

import type { ComponentType } from 'react';
import type { NavFeatureId } from '@/lib/life-situations';

export interface FeatureRow {
  feature: NavFeatureId;
  /** i18n-Schlüssel des Labels; `label` ist der deutsche Rückfalltext. */
  labelKey: string;
  label: string;
  subtitleKey?: string;
  subtitle?: string;
  icon: ComponentType<{ className?: string }>;
}

export interface FeatureRowGroup {
  id: string;
  labelKey: string;
  label: string;
  rows: FeatureRow[];
}

/** Kernbereiche — immer sichtbar, nicht abwählbar, deshalb ohne Schalter. */
export interface CoreFeatureRow {
  path: string;
  labelKey: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

export interface FeatureCatalog {
  groups: FeatureRowGroup[];
  core: CoreFeatureRow[];
  /** Anzahl aller wählbaren Bereiche — für „x von y aktiv". */
  total: number;
}
