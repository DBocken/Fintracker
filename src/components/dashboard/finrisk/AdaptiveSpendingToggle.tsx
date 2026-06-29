import { Sparkles } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';

interface Props {
  /** Gegensteuern aktiv? */
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  /** Konsequenz 0..1 (Anteil der drosselbaren diskretionären Tagesausgabe). */
  strength: number;
  onStrengthChange: (v: number) => void;
}

/**
 * „Was, wenn du von Anfang an gegensteuerst?" – bewusstes Was-wäre-wenn (Issue #152):
 * Bei Knappheit hält der Nutzer diskretionäre Ausgaben zurück, Fixkosten & Verträge
 * bleiben. Schaltet `adaptiveSpending` in der Wahrscheinlichkeits-Simulation ein –
 * keine Prognose, sondern eine absichtliche Verhaltensannahme.
 *
 * Formular-Container (kein „Karten = eine Aktion"): die ganze Kopfzeile schaltet
 * den Switch; bei Aktivierung erscheint der Konsequenz-Regler.
 */
export default function AdaptiveSpendingToggle({
  enabled,
  onEnabledChange,
  strength,
  onStrengthChange,
}: Props) {
  return (
    <div className="rounded-xl border bg-card p-3 sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="liq-discipline" className="flex cursor-pointer items-start gap-2">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--brand))]" />
          <span>
            <span className="text-sm font-medium">Was, wenn du von Anfang an gegensteuerst?</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              Bei Knappheit hältst du diskretionäre Ausgaben zurück – Fixkosten &amp; Verträge
              bleiben. Bewusstes Was-wäre-wenn, keine Prognose.
            </span>
          </span>
        </label>
        <Switch
          id="liq-discipline"
          checked={enabled}
          onCheckedChange={onEnabledChange}
          aria-label="Bei Knappheit gegensteuern"
        />
      </div>
      {enabled && (
        <div className="mt-3 flex items-center gap-3 border-t pt-3">
          <span className="shrink-0 text-xs text-muted-foreground">Wie konsequent</span>
          <Slider
            value={[Math.round(strength * 100)]}
            onValueChange={([v]) => onStrengthChange((v ?? 50) / 100)}
            min={10}
            max={100}
            step={10}
            className="max-w-[240px] flex-1"
            aria-label="Konsequenz des Gegensteuerns"
          />
          <span className="w-10 shrink-0 text-right text-xs tabular-nums">
            {Math.round(strength * 100)} %
          </span>
        </div>
      )}
    </div>
  );
}
