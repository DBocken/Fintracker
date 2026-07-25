import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('settings.language')}</CardTitle>
        <CardDescription>{t('settings.languageDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Select value={locale} onValueChange={(value) => setLocale(value as Locale)}>
          <SelectTrigger className="w-full sm:w-64">
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
      </CardContent>
    </Card>
  );
}

export default LanguageSettings;
