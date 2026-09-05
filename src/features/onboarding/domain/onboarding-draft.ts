/**
 * Der Entwurf des Einstiegs — die Antworten, solange sie noch nirgends
 * hingehören.
 *
 * **Warum es ihn gibt.** Die ersten Schritte laufen, BEVOR die App überhaupt
 * rendern darf: `App.tsx` lässt vorher keine Fläche zu (Store-Migration,
 * Tresor), und der Einstellungsspeicher ist verschlüsselt und an eine
 * Identität gebunden — die es beim ersten Klick noch gar nicht gibt. Der
 * Entwurf liegt deshalb unverschlüsselt im `localStorage` und wird am Ende in
 * EINEM Zug in die Einstellungen übernommen (`onboarding-commit.ts`).
 *
 * Er enthält bewusst **keine Finanzdaten** — nur Auswahlantworten und einen
 * selbst gewählten Anzeigenamen. Trotzdem ist er eine Datengrenze (§8): was
 * aus dem `localStorage` zurückkommt, hat niemand zugesichert, und ein
 * beschädigter Entwurf muss den Einstieg neu starten statt ihn abzustürzen.
 */

import { z } from 'zod';
import {
  LIFE_SITUATIONS,
  MODIFIERS,
  NAV_FEATURE_PATHS,
  type LifeSituationId,
  type ModifierId,
  type NavFeatureId,
} from '@/lib/life-situations';
import { ONBOARDING_STEPS } from './onboarding-steps';

/** Die beiden Wege aus Schritt 2. */
export type OnboardingPath = 'anonymous' | 'account';

// `z.enum` verlangt ein nicht-leeres Tupel; die Listen sind aber zur Laufzeit
// gebaut. Die Zusicherung hier ist die einzige Stelle, an der das nötig ist —
// und sie bleibt richtig, weil ein leerer Katalog die App ohnehin zerlegte.
const lifeSituationIds = LIFE_SITUATIONS.map((s) => s.id) as [LifeSituationId, ...LifeSituationId[]];
const modifierIds = MODIFIERS.map((m) => m.id) as [ModifierId, ...ModifierId[]];
const navFeatureIds = Object.keys(NAV_FEATURE_PATHS) as [NavFeatureId, ...NavFeatureId[]];

/**
 * Unbekannte Kennungen werden **verworfen, nicht abgelehnt**: Ein Entwurf, der
 * einen inzwischen entfernten Bereich nennt, ist kein Angriff, sondern ein
 * älterer Programmstand. Der Fluss soll dann weiterlaufen und die Auswahl
 * bereinigt anzeigen. Fehlt dagegen die Struktur selbst, greift `safeParse`
 * und der Einstieg beginnt von vorn.
 */
export const onboardingDraftSchema = z.object({
  step: z.enum(ONBOARDING_STEPS),
  path: z.enum(['anonymous', 'account']).optional(),
  displayName: z.string().max(80).optional(),
  lifeSituation: z.enum(lifeSituationIds).nullable().optional(),
  modifiers: z.array(z.enum(modifierIds)).optional(),
  features: z.array(z.enum(navFeatureIds)).optional(),
  premiumSeen: z.boolean().optional(),
});

export type OnboardingDraft = z.infer<typeof onboardingDraftSchema>;

/** Der Entwurf eines Erstbesuchers: nichts entschieden, ganz vorn. */
export const EMPTY_DRAFT: OnboardingDraft = { step: 'sprache' };
