import { useI18n } from '@/i18n/useI18n';
import { Button } from '@/components/ui/button';

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <div className="flex gap-1">
      <Button
        variant={locale === 'de' ? 'default' : 'outline'}
        size="sm"
        onClick={() => setLocale('de')}
        className="bg-background/50 backdrop-blur-sm"
        aria-label="Deutsch wählen"
        title="Deutsch"
      >
        🇩🇪
      </Button>
      <Button
        variant={locale === 'en' ? 'default' : 'outline'}
        size="sm"
        onClick={() => setLocale('en')}
        className="bg-background/50 backdrop-blur-sm"
        aria-label="English wählen"
        title="English"
      >
        🇬🇧
      </Button>
    </div>
  );
}

export default LanguageSwitcher;
