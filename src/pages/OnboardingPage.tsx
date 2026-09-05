/**
 * Routen-Einstieg des Einstiegs (`/willkommen/*`).
 *
 * Dünn wie jede Seite (AGENTS.md §3) — mit einer Aufgabe: den Bereichs-Katalog
 * aus der Navigation zu holen und dem Slice zu reichen. Der Slice darf die
 * Navigation nicht selbst lesen; die Begründung steht in
 * `features/onboarding/domain/feature-rows.ts`.
 */

import { useMemo } from 'react';
import { onboardingFeatureCatalog } from '@/components/layout/nav-config';
import OnboardingFlow from '@/features/onboarding/presentation/OnboardingFlow';

export default function OnboardingPage() {
  const catalog = useMemo(() => onboardingFeatureCatalog(), []);
  return <OnboardingFlow catalog={catalog} />;
}
