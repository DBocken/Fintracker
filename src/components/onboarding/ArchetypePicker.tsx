import { ARCHETYPES, MODIFIERS, type ArchetypeId, type ModifierId } from '@/lib/archetypes';
import { useI18n } from '@/i18n/useI18n';
import { cn } from '@/lib/utils';

interface ArchetypePickerProps {
  value: ArchetypeId | null;
  modifiers: readonly ModifierId[];
  onChange: (id: ArchetypeId) => void;
  onToggleModifier: (id: ModifierId) => void;
}

/**
 * Schritt 1 des Onboardings: Lebenssituation (genau eine) und Umstände
 * (mehrere). Beides steuert nur die Vorauswahl im nächsten Schritt — hier wird
 * noch nichts gespeichert.
 *
 * Die Kacheln sind ganzflächig klickbare Buttons (Design-Prinzip „Karten sind
 * Aktionen"), semantisch eine Radiogruppe, damit Tastatur und Screenreader die
 * Exklusivität der Auswahl mitbekommen.
 */
export default function ArchetypePicker({
  value,
  modifiers,
  onChange,
  onToggleModifier,
}: ArchetypePickerProps) {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 id="onboarding-archetype-title" className="font-display text-lg font-semibold">
          {t('onboarding.title', 'Welche Situation beschreibt dich am ehesten?')}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t(
            'onboarding.subtitle',
            'Wir blenden dann nur die Bereiche ein, die dazu passen. Ändern kannst du das jederzeit.',
          )}
        </p>
      </div>

      <div
        role="radiogroup"
        aria-labelledby="onboarding-archetype-title"
        className="grid gap-2 sm:grid-cols-2"
      >
        {ARCHETYPES.map((archetype) => {
          const selected = value === archetype.id;
          return (
            <button
              key={archetype.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(archetype.id)}
              className={cn(
                'ds-section flex min-h-[44px] w-full cursor-pointer flex-col items-start gap-1 p-3 text-left',
                'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                selected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'hover:border-primary/40 hover:bg-accent/40',
              )}
            >
              <span className="text-sm font-medium">{t(archetype.labelKey, archetype.id)}</span>
              <span className="text-xs leading-snug text-muted-foreground">
                {t(archetype.descriptionKey, '')}
              </span>
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        <div className="space-y-0.5">
          <h3 id="onboarding-modifier-title" className="text-sm font-medium">
            {t('onboarding.modifiersTitle', 'Trifft davon etwas zu?')}
          </h3>
          <p className="text-xs text-muted-foreground">
            {t(
              'onboarding.modifiersHint',
              'Mehrfachauswahl. Jeder Punkt schaltet zusätzliche Bereiche frei.',
            )}
          </p>
        </div>
        <div aria-labelledby="onboarding-modifier-title" className="flex flex-wrap gap-2">
          {MODIFIERS.map((modifier) => {
            const active = modifiers.includes(modifier.id);
            return (
              <button
                key={modifier.id}
                type="button"
                role="checkbox"
                aria-checked={active}
                onClick={() => onToggleModifier(modifier.id)}
                className={cn(
                  'min-h-[36px] rounded-full border px-3 py-1.5 text-xs transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'border-primary bg-primary/10 font-medium text-foreground'
                    : 'border-border text-muted-foreground hover:bg-accent/40',
                )}
              >
                {t(modifier.labelKey, modifier.id)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
