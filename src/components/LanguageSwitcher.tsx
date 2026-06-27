import { Languages, Check } from 'lucide-react';
import { useI18n } from '@/i18n/useI18n';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const LOCALES = [
  { value: 'de', flag: '🇩🇪', label: 'Deutsch' },
  { value: 'en', flag: '🇬🇧', label: 'English' },
] as const;

/**
 * Sprachwahl als kompaktes Popup (Issue: Mobile-Skalierung). Ein einzelner
 * Icon-Trigger statt zweier Flaggen-Buttons — passt so auch in den schmalen
 * Mobil-Header, ohne ihn zu überlaufen.
 */
export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  const active = LOCALES.find((l) => l.value === locale) ?? LOCALES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Sprache wählen"
          title={active.label}
          className="bg-background/50 backdrop-blur-sm"
        >
          <Languages className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LOCALES.map((l) => (
          <DropdownMenuItem
            key={l.value}
            onClick={() => setLocale(l.value)}
            className="gap-2"
            aria-label={`${l.label} wählen`}
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
