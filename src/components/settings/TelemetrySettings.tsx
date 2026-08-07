import { BarChart3, Check, X } from 'lucide-react';
import { InfoGroup } from '@/components/common/InfoGroup';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { revokeTelemetryConsent } from '@/services/telemetry-service';
import { useI18n } from '@/i18n/useI18n';

/**
 * Der Opt-in-Schalter für die Telemetrie (WP-11.2).
 *
 * `decision-log` F-1 verlangt ihn an dieser Stelle. Zwei Dinge sind an der
 * Gestaltung Absicht:
 *
 * **Erstens: zwei Listen statt eines Absatzes.** „Anonymisiert" ist ein Wort,
 * das alles und nichts heissen kann. Was gesendet wird und was ausdrücklich
 * nicht, steht deshalb nebeneinander — nicht als Beruhigung, sondern damit die
 * Entscheidung auf einer Tatsache beruht.
 *
 * **Zweitens: Ausschalten wirft weg.** Der Widerruf löscht die noch nicht
 * gesendeten Ereignisse (`revokeTelemetryConsent`). Ein Schalter, der nur den
 * künftigen Versand stoppt, hätte die alten beim nächsten Einschalten
 * mitgeschickt.
 *
 * Kein Karten-Chrome (AGENTS.md §9): Die Fläche als Ganzes tut nichts, die
 * Handlung liegt beim Schalter.
 */
export function TelemetrySettings() {
  const { t } = useI18n();
  const { isEnabled, setFlag } = useFeatureFlags();
  const enabled = isEnabled('telemetry');

  const sent = [
    t('settings.telemetry.sends.screens'),
    t('settings.telemetry.sends.errors'),
    t('settings.telemetry.sends.performance'),
  ];
  const neverSent = [
    t('settings.telemetry.never.amounts'),
    t('settings.telemetry.never.payees'),
    t('settings.telemetry.never.identity'),
  ];

  return (
    <InfoGroup
      title={
        <span className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-brand" />
          {t('settings.telemetry.title')}
        </span>
      }
      description={t('settings.telemetry.description')}
    >
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-foreground">
          {enabled ? t('settings.telemetry.stateOn') : t('settings.telemetry.stateOff')}
        </span>
        <Switch
          checked={enabled}
          aria-label={t('settings.telemetry.title')}
          onCheckedChange={(next) => {
            // Reihenfolge zaehlt: erst wegwerfen, dann umschalten. Andersherum
            // liefe zwischen beiden Schritten eine Aufzeichnung ohne
            // Einwilligung.
            if (!next) revokeTelemetryConsent();
            setFlag('telemetry', next);
          }}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('settings.telemetry.sendsTitle')}
          </p>
          <ul className="space-y-1 text-sm">
            {sent.map((line) => (
              <li key={line} className="flex items-start gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-positive" aria-hidden="true" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('settings.telemetry.neverTitle')}
          </p>
          <ul className="space-y-1 text-sm">
            {neverSent.map((line) => (
              <li key={line} className="flex items-start gap-2">
                <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {enabled && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            revokeTelemetryConsent();
            setFlag('telemetry', false);
          }}
        >
          {t('settings.telemetry.revokeButton')}
        </Button>
      )}
    </InfoGroup>
  );
}

export default TelemetrySettings;
