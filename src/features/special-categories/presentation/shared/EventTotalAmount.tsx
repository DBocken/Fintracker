import { toMajor } from '@/lib/money';
import { formatCurrency } from '@/lib/utils';
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber';
import { cn } from '@/lib/utils';

interface EventTotalAmountProps {
  /** Betrag in Integer-Cent (vorzeichenbehaftet). */
  minor: number;
  className?: string;
  /** Count-up-Aufbau aktiv (Default an). Respektiert `prefers-reduced-motion`. */
  animate?: boolean;
}

/**
 * Anlass-Gesamtbetrag als hochzählender Wert (Animations-Baseline: Daten werden
 * aufgebaut, nicht aufgepoppt). Bei `prefers-reduced-motion` springt der Wert
 * direkt aufs Ziel (via useAnimatedNumber). Rechnet in Cent, formatiert erst zur
 * Anzeige.
 */
export function EventTotalAmount({ minor, className, animate = true }: EventTotalAmountProps) {
  const euro = toMajor(minor);
  const shown = useAnimatedNumber(euro, { enabled: animate });
  return (
    <span className={cn('tabular-nums', className)} aria-label={formatCurrency(euro)}>
      {formatCurrency(shown)}
    </span>
  );
}

export default EventTotalAmount;
