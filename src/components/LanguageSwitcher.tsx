import { Languages, Check } from 'lucide-react';
import { useI18n } from '@/i18n/useI18n';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LOCALE_OPTIONS } from '@/i18n/locale-options';

/**
 * Sprachwahl als kompaktes Popup (Issue: Mobile-Skalierung). Ein einzelner
 * Icon-Trigger statt zweier Flaggen-Buttons — passt so auch in den schmalen
 * Mobil-Header, ohne ihn zu überlaufen.
 */
export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  const active = LOCALE_OPTIONS.find((l) => l.value === locale) ?? LOCALE_OPTIONS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('languageSwitcher.ariaLabel')}
          title={active.label}
          className="bg-background/50 backdrop-blur-sm"
        >
          <Languages className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LOCALE_OPTIONS.map((l) => (
          <DropdownMenuItem
            key={l.value}
            onClick={() => setLocale(l.value)}
            className="gap-2"
            aria-label={t('languageSwitcher.selectLocaleAriaLabel').replace('{label}', l.label)}
          >
            <span aria-hidden="true">{l.flag}</span>
            <span className="flex-1">{l.label}</span>
            {locale === l.value && <Check className="h-4 w-4 text-positive" aria-hidden="true" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default LanguageSwitcher;
