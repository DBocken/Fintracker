/**
 * Paraphrasen je Sprache — Trainingsdaten der Router-Stufe 2. Regeln und
 * Einordnung im Kopf von `de.ts`.
 */
import type { IntentBeispiel } from '@/lib/question-intent-model';
import { PARAPHRASEN_DE } from './de';
import { PARAPHRASEN_EN } from './en';
import { PARAPHRASEN_RU } from './ru';

const JE_SPRACHE: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {
  de: PARAPHRASEN_DE,
  en: PARAPHRASEN_EN,
  ru: PARAPHRASEN_RU,
};

export function paraphrasenFuer(locale: string): Readonly<Record<string, readonly string[]>> {
  return JE_SPRACHE[locale] ?? PARAPHRASEN_DE;
}

/** Flach als Trainingsbeispiele. */
export function intentBeispieleFuer(locale: string): IntentBeispiel[] {
  return Object.entries(paraphrasenFuer(locale)).flatMap(([klasse, texte]) =>
    texte.map((text) => ({ klasse, text })),
  );
}
