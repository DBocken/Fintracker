/**
 * ViewModel der manuellen Vermögenswerte (Welle 4).
 *
 * Der Datenzugriff liegt hier und nicht in der Karte: Eine Fläche, die ihre
 * eigene Datenschicht IST, lässt sich nicht durch eine zweite Präsentation
 * ergänzen, ohne die Beschaffung ein zweites Mal zu schreiben (§4,
 * `check:view-data`). Die Karte bekommt fertige Zeilen und Rückrufe.
 */

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteManualAsset,
  getManualAssets,
  upsertManualAsset,
} from '@/services/manual-asset-service';
import type { ManualAsset, ManualAssetKind } from '@/lib/manual-asset-types';
import { bewertungsAlterInTagen, istVeraltet, summeManuellerWerte } from '@/lib/manual-asset-types';

export const MANUAL_ASSETS_QUERY_KEY = ['manual-assets'] as const;

/** Eine Zeile, wie die Fläche sie braucht — Rechnung erledigt, Text noch nicht. */
export interface ManualAssetRow {
  id: string;
  name: string;
  kind: ManualAssetKind;
  /** Roh; maskiert wird in der Präsentation (Sanfter Modus). */
  value: number;
  valuedAt: string;
  /** Schätzung älter als ein Jahr. */
  stale: boolean;
  alterInTagen: number;
}

/** Der Entwurf im Dialog — `null` heisst „kein Dialog offen". */
export interface ManualAssetDraft {
  id?: string;
  name: string;
  kind: ManualAssetKind;
  value: number | null;
  valuedAt: string;
}

export function leererEntwurf(jetzt: Date): ManualAssetDraft {
  return { name: '', kind: 'property', value: null, valuedAt: jetzt.toISOString().slice(0, 10) };
}

export function useManualAssets(jetzt: Date = new Date()) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<ManualAssetDraft | null>(null);

  const {
    data: assets,
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: MANUAL_ASSETS_QUERY_KEY, queryFn: getManualAssets });

  const speichern = useMutation({
    mutationFn: (entwurf: ManualAssetDraft) =>
      upsertManualAsset({
        id: entwurf.id,
        name: entwurf.name.trim(),
        kind: entwurf.kind,
        value: entwurf.value ?? 0,
        valued_at: entwurf.valuedAt,
      }),
    onSuccess: () => {
      setDraft(null);
      void queryClient.invalidateQueries({ queryKey: MANUAL_ASSETS_QUERY_KEY });
    },
  });

  const loeschen = useMutation({
    mutationFn: (id: string) => deleteManualAsset(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: MANUAL_ASSETS_QUERY_KEY }),
  });

  const zeilen = useMemo<ManualAssetRow[]>(
    () =>
      (assets ?? []).map((a: ManualAsset) => ({
        id: a.id,
        name: a.name,
        kind: a.kind,
        value: a.value,
        valuedAt: a.valued_at,
        stale: istVeraltet(a, jetzt),
        alterInTagen: bewertungsAlterInTagen(a, jetzt),
      })),
    [assets, jetzt],
  );

  return {
    zeilen,
    summe: summeManuellerWerte(assets ?? []),
    /** Wie viele Schätzungen älter als ein Jahr sind — die Karte sagt es. */
    veraltet: zeilen.filter((z) => z.stale).length,
    isLoading,
    isError,
    refetch,
    draft,
    entwurfOeffnen: (zeile?: ManualAssetRow) =>
      setDraft(
        zeile
          ? {
              id: zeile.id,
              name: zeile.name,
              kind: zeile.kind,
              value: zeile.value,
              valuedAt: zeile.valuedAt,
            }
          : leererEntwurf(jetzt),
      ),
    entwurfAendern: (teil: Partial<ManualAssetDraft>) =>
      setDraft((bisher) => (bisher ? { ...bisher, ...teil } : bisher)),
    entwurfSchliessen: () => setDraft(null),
    speichern: (entwurf: ManualAssetDraft) => speichern.mutate(entwurf),
    speichertGerade: speichern.isPending,
    loeschen: (id: string) => loeschen.mutate(id),
  };
}
