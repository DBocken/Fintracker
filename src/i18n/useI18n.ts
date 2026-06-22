import { useContext } from 'react';
import { I18nContext, type I18nContextValue } from './I18nProvider';

/**
 * Zugriff auf das i18n-System: `t(key, fallback?)`, aktuelle `locale` und
 * `setLocale`. Außerhalb des Providers wirft der Hook bewusst, damit fehlende
 * Einbindung früh auffällt.
 */
export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return ctx;
}
