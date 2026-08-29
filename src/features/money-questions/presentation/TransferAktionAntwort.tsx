/**
 * Übertrags-Markierung im Chat: Vorschau → Bestätigen → Rückgängig
 * (Welle 5).
 *
 * Die Vorschau zeigt hier mehr als bei den anderen Aktionen, und zwar aus
 * einem Grund: Ein markierter Übertrag verschwindet aus JEDER Auswertung.
 * „3 Paare markieren?" lässt niemanden abschätzen, was er auslöst — die
 * SUMME, die aus Einnahmen und Ausgaben fällt, tut es. Sie läuft durch den
 * Sanften Modus wie jeder Betrag.
 */
import { useState } from 'react';
import { Check, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/useI18n';
import { useMoneyFormat } from '@/hooks/useMoneyFormat';
import { InfoGroup } from '@/features/shared/presentation/InfoGroup';
import { useTransferAction } from '@/features/money-questions/application/use-transfer-action';
import type { TransferAktionsVorschlag } from '@/features/shared/domain/question-registry';

function ersetze(text: string, params: Record<string, string>): string {
  return Object.entries(params).reduce((t, [name, wert]) => t.split(`{${name}}`).join(wert), text);
}

export function TransferAktionAntwort({
  vorschlag,
  aussage,
}: {
  vorschlag: TransferAktionsVorschlag;
  aussage: string;
}) {
  const { t } = useI18n();
  const money = useMoneyFormat();
  const model = useTransferAction();
  const [verworfen, setVerworfen] = useState(false);

  const params = { anzahl: String(vorschlag.paare.length), summe: money.format(vorschlag.summe) };

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
          {ersetze(t('financeQuestions.transferAktion.erledigt'), params)}
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
      {/*
        Die WIRKUNG vor der Liste: Was aus den Summen fällt, ist das, worauf
        jemand seine Entscheidung stützt.
      */}
      <p className="mt-1 text-base font-medium">
        {ersetze(t('financeQuestions.transferAktion.wirkung'), params)}
      </p>
      <ul className="mt-2 space-y-1">
        {vorschlag.paare.slice(0, 10).map((paar) => (
          <li key={paar.ausId} className="flex items-baseline justify-between gap-4 text-sm">
            <span className="truncate">{paar.label}</span>
            <span className="shrink-0 tabular-nums">{money.format(paar.betrag)}</span>
          </li>
        ))}
      </ul>

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
