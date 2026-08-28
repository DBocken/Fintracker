/**
 * Anlass-Aktion im Chat: Vorschau → Bestätigen → Rückgängig (Welle 5).
 *
 * Dieselbe Zusage wie bei den beiden anderen Aktionen. Was diese Fläche
 * zusätzlich sagt: **wie viele Buchungen tatsächlich geschrieben wurden.**
 * `assignTransaction` prüft je Buchung Invarianten und kann eine einzelne
 * abweisen; „12 zugeordnet" zu melden, wenn es 11 waren, wäre eine falsche
 * Quittung — und die Quittung ist das, worauf sich jemand verlässt.
 */
import { useState } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/useI18n';
import { InfoGroup } from '@/features/shared/presentation/InfoGroup';
import { useAnlassAction } from '@/features/money-questions/application/use-anlass-action';
import type { AnlassAktionsVorschlag } from '@/features/shared/domain/question-registry';

function ersetze(text: string, params: Record<string, string>): string {
  return Object.entries(params).reduce((t, [name, wert]) => t.split(`{${name}}`).join(wert), text);
}

export function AnlassAktionAntwort({
  vorschlag,
  aussage,
}: {
  vorschlag: AnlassAktionsVorschlag;
  aussage: string;
}) {
  const { t } = useI18n();
  const model = useAnlassAction();
  const [verworfen, setVerworfen] = useState(false);

  if (model.stand.art === 'zurueckgenommen' || verworfen) {
    return (
      <InfoGroup title={t('financeQuestions.aktion.vorschauTitle')}>
        <p className="text-sm">{t('financeQuestions.aktion.zurueckgenommen')}</p>
      </InfoGroup>
    );
  }

  if (model.stand.art === 'erledigt') {
    return (
      <InfoGroup title={t('financeQuestions.aktion.vorschauTitle')}>
        <p className="flex items-center gap-2 text-sm">
          <Check className="h-4 w-4 text-positive" aria-hidden="true" />
          {ersetze(
            t(
              model.stand.vorschlag.art === 'anlassAnlegen'
                ? 'financeQuestions.anlassAktion.erledigtAnlegen'
                : 'financeQuestions.anlassAktion.erledigtZuordnen',
            ),
            {
              name: model.stand.vorschlag.name,
              // Die TATSÄCHLICH geschriebene Zahl, nicht die angekündigte.
              anzahl: String(model.stand.geschrieben),
            },
          )}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          disabled={model.istAmSchreiben}
          onClick={model.rueckgaengig}
        >
          <RotateCcw className="mr-1 h-3 w-3" aria-hidden="true" />
          {t('financeQuestions.aktion.rueckgaengig')}
        </Button>
        {model.istFehler && (
          <p role="alert" className="mt-2 text-sm">
            {t('financeQuestions.aktion.fehler')}
          </p>
        )}
      </InfoGroup>
    );
  }

  return (
    <InfoGroup title={t('financeQuestions.aktion.vorschauTitle')}>
      <p className="text-sm">{aussage}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          disabled={model.istAmSchreiben}
          onClick={() => model.bestaetigen(vorschlag)}
        >
          <Check className="mr-1 h-3 w-3" aria-hidden="true" />
          {t('financeQuestions.aktion.bestaetigen')}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setVerworfen(true)}>
          <X className="mr-1 h-3 w-3" aria-hidden="true" />
          {t('financeQuestions.aktion.abbrechen')}
        </Button>
      </div>
      {model.istFehler && (
        <p role="alert" className="mt-2 text-sm">
          {t('financeQuestions.aktion.fehler')}
        </p>
      )}
    </InfoGroup>
  );
}
