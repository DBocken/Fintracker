/**
 * Karte für Vermögenswerte ohne Buchung — Wohnung, Auto, Sachwerte (Welle 4).
 *
 * Reine Darstellung: Die Beschaffung liegt im ViewModel
 * (`use-manual-assets`), damit eine zweite Präsentation danebengestellt
 * werden kann, ohne sie zu wiederholen (§4).
 *
 * Zwei Dinge, die die Fläche tragen MUSS und die nicht in der Zahl stecken:
 * Ein Wert ohne Stichtag ist eine stille Behauptung, und eine Schätzung, die
 * ein Jahr alt ist, ist keine Aussage über heute. Beides steht deshalb
 * sichtbar an der Zeile, nicht in einem Tooltip.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DecimalInput } from '@/features/shared/presentation/DecimalInput';
import { TypedSelect } from '@/features/shared/presentation/TypedSelect';
import FinanceErrorState from '@/features/shared/presentation/FinanceErrorState';
import { useI18n } from '@/i18n/useI18n';
import { useMoneyFormat } from '@/hooks/useMoneyFormat';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { ManualAssetKind } from '@/lib/manual-asset-types';
import { MANUAL_ASSET_ICONS } from '@/services/manual-asset-service';
import { useManualAssets } from '../application/use-manual-assets';

const ARTEN: readonly ManualAssetKind[] = ['property', 'vehicle', 'valuables', 'other'];

export function ManualAssetsSection() {
  const { t, locale } = useI18n();
  const money = useMoneyFormat();
  const model = useManualAssets();

  /**
   * Beschriftungen je Art — als AUSGESCHRIEBENE `t()`-Aufrufe, nicht über
   * einen zusammengesetzten Schlüssel.
   *
   * Ein Key aus einer Variablen ist für die Aufrufstellen-Ratsche unsichtbar
   * (`call-site-keys.test` zählt genau diesen blinden Fleck); ein Tippfehler
   * darin rendert den rohen Punkt-String, ohne dass etwas rot wird. Die
   * Funktion wird bei jedem Rendern aufgerufen, damit ein Sprachwechsel
   * durchschlägt — eine Modul-Konstante fröre den Text ein (§6).
   */
  const artLabel = (art: ManualAssetKind): string =>
    art === 'property'
      ? t('manualAssets.kindProperty')
      : art === 'vehicle'
        ? t('manualAssets.kindVehicle')
        : art === 'valuables'
          ? t('manualAssets.kindValuables')
          : t('manualAssets.kindOther');

  const datum = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(`${iso}T00:00:00`));

  // Der Fehlerzustand gehört der Karte, nicht der Seite: Sie liest eine
  // EIGENE Collection — scheitert sie, sagt das nichts über die Konten aus.
  if (model.isError) {
    return <FinanceErrorState onRetry={() => void model.refetch()} />;
  }

  const entwurf = model.draft;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('manualAssets.title')}</CardTitle>
        <CardDescription>{t('manualAssets.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {model.zeilen.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('manualAssets.empty')}</p>
        ) : (
          <>
            <ul className="space-y-2">
              {model.zeilen.map((zeile) => (
                <li
                  key={zeile.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      <span aria-hidden="true">{MANUAL_ASSET_ICONS[zeile.kind]} </span>
                      {zeile.name}
                    </div>
                    <div
                      className={
                        zeile.stale ? 'text-xs text-warning-foreground' : 'text-xs text-muted-foreground'
                      }
                    >
                      {t('manualAssets.staleRow').split('{datum}').join(datum(zeile.valuedAt))}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="tabular-nums text-sm">{money.format(zeile.value)}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t('manualAssets.edit')}
                      onClick={() => model.entwurfOeffnen(zeile)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={t('manualAssets.remove')}
                      onClick={() => model.loeschen(zeile.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            <p className="text-sm font-medium">
              {t('manualAssets.total').split('{betrag}').join(money.format(model.summe))}
            </p>

            {model.veraltet > 0 && (
              <p className="text-xs text-warning-foreground">
                {model.veraltet === 1
                  ? t('manualAssets.staleOne')
                  : t('manualAssets.staleMany').split('{anzahl}').join(String(model.veraltet))}
              </p>
            )}
          </>
        )}

        <Button type="button" variant="outline" size="sm" onClick={() => model.entwurfOeffnen()}>
          <Plus className="mr-2 h-4 w-4" />
          {t('manualAssets.add')}
        </Button>
      </CardContent>

      <Dialog open={entwurf !== null} onOpenChange={(offen) => !offen && model.entwurfSchliessen()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {entwurf?.id ? t('manualAssets.edit') : t('manualAssets.add')}
            </DialogTitle>
          </DialogHeader>

          {entwurf && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="manual-asset-name">{t('manualAssets.nameLabel')}</Label>
                <Input
                  id="manual-asset-name"
                  value={entwurf.name}
                  placeholder={t('manualAssets.namePlaceholder')}
                  onChange={(e) => model.entwurfAendern({ name: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="manual-asset-kind">{t('manualAssets.kindLabel')}</Label>
                <TypedSelect<ManualAssetKind>
                  id="manual-asset-kind"
                  value={entwurf.kind}
                  onValueChange={(kind) => model.entwurfAendern({ kind })}
                  aria-label={t('manualAssets.kindLabel')}
                  options={ARTEN.map((art) => ({
                    value: art,
                    label: artLabel(art),
                  }))}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="manual-asset-value">{t('manualAssets.valueLabel')}</Label>
                {/* Dezimalfeld, nicht `type="number"`: Getipptes „12,50" würde
                    dort zu 1250 (§8, `check:decimal-inputs`). */}
                <DecimalInput
                  id="manual-asset-value"
                  value={entwurf.value}
                  onChange={(value) => model.entwurfAendern({ value })}
                  aria-label={t('manualAssets.valueLabel')}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="manual-asset-date">{t('manualAssets.valuedAtLabel')}</Label>
                <Input
                  id="manual-asset-date"
                  type="date"
                  value={entwurf.valuedAt}
                  onChange={(e) => model.entwurfAendern({ valuedAt: e.target.value })}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={model.entwurfSchliessen}>
              {t('manualAssets.cancel')}
            </Button>
            <Button
              type="button"
              disabled={
                !entwurf ||
                entwurf.name.trim() === '' ||
                entwurf.value === null ||
                model.speichertGerade
              }
              onClick={() => entwurf && model.speichern(entwurf)}
            >
              {t('manualAssets.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default ManualAssetsSection;
