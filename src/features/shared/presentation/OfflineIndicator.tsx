import { CloudOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useI18n } from '@/i18n/useI18n';

/**
 * Verbindungsanzeige im Header (WP-9.3).
 *
 * **Warum das hier kein Alarm ist.** Die naheliegende Lösung — ein roter
 * Balken „Keine Internetverbindung" — wäre für diese App schlicht falsch.
 * Fintracker ist local-first: Die Finanzdaten liegen in IndexedDB auf dem
 * Gerät, Eintragen und Auswerten funktionieren ohne Netz vollständig. Ein
 * Alarm würde einen Ausfall behaupten, den es nicht gibt, und nebenbei die
 * beste Eigenschaft des Produkts als Mangel darstellen.
 *
 * Deshalb: ein ruhiges Zeichen neben den anderen Statusanzeigen, das auf
 * Antippen erklärt, was weiterläuft (fast alles) und was ruht (drei
 * Zusatzfunktionen, die echten Netzzugang brauchen).
 *
 * **Warum im Header und nicht als Streifen über dem Inhalt.** Ein
 * eingeschobener Streifen verschiebt beim Auftauchen die ganze Seite nach
 * unten — genau der Befund, der in WP-8.3 das CLS-Budget gerissen hat. Der
 * Header hat feste Höhe (`h-14`); ein Zeichen mehr in seiner Reihe kostet
 * keine Verschiebung des Inhalts.
 *
 * Rendert nichts, solange eine Verbindung besteht: Ein dauerhaftes
 * „online"-Abzeichen wäre Rauschen — der Normalfall braucht keine Meldung.
 */
export default function OfflineIndicator() {
  const online = useOnlineStatus();
  const { t } = useI18n();

  if (online) return null;

  const paused = [
    t('offlineState.pausedMarketData'),
    t('offlineState.pausedBankSync'),
    t('offlineState.pausedCloudSync'),
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('offlineState.label')}
          data-testid="offline-indicator"
        >
          <CloudOff className="h-4 w-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <div className="space-y-3 p-3 text-sm">
          <p className="font-semibold">{t('offlineState.title')}</p>
          <p className="text-muted-foreground">{t('offlineState.body')}</p>
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              {t('offlineState.pausedTitle')}
            </p>
            <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">
              {paused.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
