import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/useI18n';
import EmptyState from '@/features/shared/presentation/EmptyState';

type FinanceErrorStateVariant = 'transactions' | 'data';

type FinanceErrorStateProps = {
  variant?: FinanceErrorStateVariant;
  /**
   * Erneuter Ladeversuch. **Pflicht** — eine Fehlermeldung ohne nächsten
   * Schritt ist eine Sackgasse, und in einer local-first App ist der zweite
   * Versuch fast immer der erfolgreiche.
   */
  onRetry: () => void;
};

/**
 * Fehlerzustand der Hauptseiten (WP-9.2).
 *
 * Das Gegenstück zu `FinanceEmptyState` — und der Grund, warum es beide
 * getrennt gibt: Bis hierher lief jeder Ladefehler in den Leerzustand
 * (`const { data = [] } = useQuery(…)` → `isEmpty` → „Noch keine Buchungen").
 * Der Nutzer las damit eine **falsche Auskunft**: Der eine Satz lädt zum
 * Neuladen ein, der andere zum Neuanlegen von Daten, die längst da sind.
 *
 * Der Text sagt bewusst drei Dinge, in dieser Reihenfolge:
 *
 * 1. **Was** nicht geladen werden konnte — nicht „ein Fehler ist aufgetreten".
 *    Ein Nutzer kann mit der Gattung „Fehler" nichts anfangen, mit „deine
 *    Buchungen" schon.
 * 2. Dass die Daten **nicht verloren** sind. Für eine Finanz-App ist das der
 *    wichtigste Satz überhaupt: Ein Lesefehler liest sich sonst wie ein
 *    Datenverlust, und die Panik daraus ist schlimmer als der Fehler.
 * 3. Den **nächsten Schritt**.
 *
 * Bewusst KEINE technische Fehlermeldung: `err.message` lautet hier
 * „IndexedDB nicht erreichbar" oder Ähnliches und hilft niemandem, der die
 * App benutzt statt sie zu bauen.
 */
export default function FinanceErrorState({
  variant = 'data',
  onRetry,
}: FinanceErrorStateProps) {
  const { t } = useI18n();

  const title =
    variant === 'transactions'
      ? t('financeErrorState.transactionsTitle')
      : t('financeErrorState.dataTitle');

  return (
    <div role="alert" className="relative overflow-hidden rounded-lg">
      {/*
        Warnfarbe statt der Marken-Verläufe des Leerzustands: Die beiden
        Zustaende duerfen sich nicht aehnlich sehen — genau ihre Verwechslung
        ist der Befund, der zu diesem Baustein gefuehrt hat.
      */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-br from-warning/10 via-warning/5 to-transparent"
      />
      <div className="relative">
        <EmptyState
          icon={AlertTriangle}
          title={title}
          description={t('financeErrorState.reassurance')}
          action={
            <Button variant="outline" onClick={onRetry}>
              <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
              {t('financeErrorState.retryButton')}
            </Button>
          }
        />
      </div>
    </div>
  );
}
