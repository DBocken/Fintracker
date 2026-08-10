import { useSyncExternalStore } from 'react';
import type { Locale as DateFnsLocale } from 'date-fns';
import { useI18n } from './useI18n';
import {
  readDateFnsLocaleOrFallback,
  subscribeDateFnsLocaleVersion,
  getDateFnsLocaleVersion,
} from './date-fns-locale';

/**
 * `date-fns`-Locale-Objekt für die AKTUELLE App-Sprache (React-Komponenten).
 * Pendant zu `t()` aus `useI18n()`, nur für `format(...)`-Aufrufe mit
 * Wochentags-/Monatsnamen statt Übersetzungstexte (WP 5.5b).
 *
 * Solange der Sprach-Chunk (`en`/`ru`, siehe `date-fns-locale.ts`) noch nicht
 * geladen ist, liefert dieser Hook den `de`-Fallback und rendert automatisch
 * neu, sobald er eintrifft — derselbe Mechanismus wie `I18nProvider`s
 * `localeVersion`-Abonnement für Übersetzungstexte.
 */
export function useDateFnsLocale(): DateFnsLocale {
  const { locale } = useI18n();
  useSyncExternalStore(subscribeDateFnsLocaleVersion, getDateFnsLocaleVersion, getDateFnsLocaleVersion);
  return readDateFnsLocaleOrFallback(locale);
}
