import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { InfoGroup } from '@/components/common/InfoGroup';
import { useI18n } from '@/i18n/useI18n';
import { LOCALE_OPTIONS } from '@/i18n/locale-options';
import type { Locale } from '@/i18n/translations';

/**
 * Sprachumschalter. Die Wahl wird lokal gespeichert und wirkt auf die bereits
 * migrierten Screens. Die Liste kommt aus `LOCALE_OPTIONS` und damit aus
 * `SUPPORTED_LOCALES` — nicht wählbare Sprachen erscheinen hier gar nicht.
 */
export function LanguageSettings() {
  const { locale, setLocale, t } = useI18n();

  // WP-8.1: Kein Karten-Chrome mehr (AGENTS.md Paragraf 9). Ein Rahmen mit
  // Schatten verspricht in dieser App "tipp mich an, dann geht es weiter" —
  // hier passiert beim Antippen der Flaeche aber nichts, nur das Auswahlfeld
  // reagiert. Die Gliederung traegt der SectionHeader der Seite; die Karte
  // wiederholte ihn nur (im Sprach-Abschnitt stand "Sprache" dadurch zweimal).
  return (
    <InfoGroup title={t('settings.language')} description={t('settings.languageDescription')}>
        <Select value={locale} onValueChange={(value) => setLocale(value as Locale)}>
          <SelectTrigger className="w-full sm:w-64" aria-label={t('settings.language')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LOCALE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {t(option.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
    </InfoGroup>
  );
}

export default LanguageSettings;
