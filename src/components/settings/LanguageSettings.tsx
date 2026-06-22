import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useI18n } from '@/i18n/useI18n';
import type { Locale } from '@/i18n/translations';

/**
 * Sprachumschalter (Deutsch/Englisch). Die Wahl wird lokal gespeichert und wirkt
 * auf die bereits migrierten Screens (z. B. Datenschutz).
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
            <SelectItem value="de">{t('settings.languageGerman')}</SelectItem>
            <SelectItem value="en">{t('settings.languageEnglish')}</SelectItem>
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
}

export default LanguageSettings;
