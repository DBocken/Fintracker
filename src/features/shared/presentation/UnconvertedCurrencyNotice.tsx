/**
 * „Nicht verrechnet" — die sichtbare Hälfte der EUR-only-Entscheidung (VE-1,
 * `docs/architecture/currency-eur-only.md`, WP 7.7).
 *
 * Fintracker hat keine Kursquelle. Was nicht in der Rechenwährung notiert,
 * fließt deshalb in keine Summe ein — und genau das muss dort stehen, wo die
 * Summe steht. Sonst ist die Zahl daneben eine Behauptung über ein Vermögen,
 * das der Nutzer teils gar nicht sieht.
 *
 * **Ein Baustein für beide Flächen** (Depot und Nettovermögen): Es ist
 * dieselbe Aussage über dieselbe Entscheidung, und AGENTS.md §4 verlangt
 * ohnehin, dass sie auf jeder Präsentation gleich lautet. Verschieden ist nur
 * der Grund — den gibt die aufrufende Fläche als `description` mit.
 *
 * Bauform: **Readout ohne Follow-up**, also `InfoGroup` statt Karte (AGENTS.md
 * §9 „Karten sind Aktionen") und bewusst KEIN `Alert`: Dessen `role="alert"`
 * ist eine assertive Live-Region und würde einen Dauerzustand bei jedem Render
 * ansagen. Hier ist nichts passiert — hier ist etwas dauerhaft so.
 */
import type { ReactNode } from 'react';
import { CircleOff } from 'lucide-react';
import { useI18n } from '@/i18n/useI18n';
import { InfoGroup } from './InfoGroup';
import { formatCurrency } from '@/lib/utils';

export interface UnconvertedCurrencyItem {
  key: string;
  /** Was der Bestand ist — Symbol der Position oder Name des Depots. */
  label: string;
  /** Optionale Nebenzeile, etwa die Anzahl der Positionen. */
  hint?: string;
  currency: string;
  /** Betrag in `currency`. Wird NIE als Euro formatiert. */
  value: number;
}

export interface UnconvertedCurrencyNoticeProps {
  items: UnconvertedCurrencyItem[];
  /** Warum dieser Bestand hier nicht mitzählt — je Fläche verschieden. */
  description: ReactNode;
  className?: string;
}

export function UnconvertedCurrencyNotice({ items, description, className }: UnconvertedCurrencyNoticeProps) {
  const { t } = useI18n();

  // Kein Fund, kein Hinweis: Ein leerer Kasten würde eine Ausnahme behaupten,
  // wo keine ist.
  if (items.length === 0) return null;

  return (
    <InfoGroup
      className={className}
      title={
        <span className="flex items-center gap-1.5 text-warning">
          <CircleOff className="h-3.5 w-3.5" aria-hidden />
          {t('currency.unconverted.title')}
        </span>
      }
      description={description}
    >
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.key} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0">
              <span className="font-medium">{item.label}</span>
              {item.hint && <span className="ml-2 text-xs text-muted-foreground">{item.hint}</span>}
            </span>
            {/* Betrag in der Fremdwährung — die Währungsangabe ist hier die
                eigentliche Aussage, nicht Dekoration. */}
            <span className="tabular-nums text-muted-foreground">
              {formatCurrency(item.value, item.currency)}
            </span>
          </li>
        ))}
      </ul>
    </InfoGroup>
  );
}

export default UnconvertedCurrencyNotice;
