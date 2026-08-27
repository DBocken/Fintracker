/**
 * Vermögenswerte ohne Buchung — Wohnung, Auto, Sachwerte (Welle 4).
 *
 * I/O-Schicht: Die FORM liegt in `lib/manual-asset-types.ts`, hier steht nur
 * das Lesen und Schreiben (AGENTS.md §3). Die Collection ist in
 * `LOCAL_FINANCE_KEYS` registriert und damit ohne weiteres Zutun
 * verschlüsselt und im Backup.
 */

import type { ManualAsset, ManualAssetKind } from '@/lib/manual-asset-types';
import { getCurrentUserId } from './auth-service';
import {
  deleteLocalFinanceItem,
  mutateLocalFinanceList,
  readLocalFinanceList,
  upsertLocalFinanceItem,
} from './local-finance-store';
import { t } from '@/i18n/serviceT';

/** Symbole je Art — Bildschirm-Zierde, keine Fachlogik. */
export const MANUAL_ASSET_ICONS: Record<ManualAssetKind, string> = {
  property: '🏠',
  vehicle: '🚗',
  valuables: '💍',
  other: '📦',
};

export function getManualAssetKindLabels(): Record<ManualAssetKind, string> {
  return {
    property: t('manualAssets.kindProperty'),
    vehicle: t('manualAssets.kindVehicle'),
    valuables: t('manualAssets.kindValuables'),
    other: t('manualAssets.kindOther'),
  };
}

async function localUserId(): Promise<string> {
  return (await getCurrentUserId()) || 'local';
}

/** Alle Werte, der grösste zuerst. */
export async function getManualAssets(): Promise<ManualAsset[]> {
  const assets = await readLocalFinanceList<ManualAsset>('manualAssets');
  return assets.sort((a, b) => Number(b.value) - Number(a.value));
}

export async function upsertManualAsset(asset: Partial<ManualAsset>): Promise<ManualAsset> {
  const now = new Date().toISOString();
  return upsertLocalFinanceItem<ManualAsset>('manualAssets', {
    id: asset.id || crypto.randomUUID(),
    user_id: await localUserId(),
    name: asset.name || t('manualAssets.defaultName'),
    kind: asset.kind || 'other',
    value: asset.value ?? 0,
    // Ohne Stichtag KEIN Wert: Der Vorgabewert ist das heutige Datum, nicht
    // `null`. Ein Wert ohne Stichtag wäre genau die stille Falschaussage,
    // gegen die das Feld gebaut ist.
    valued_at: asset.valued_at || now.slice(0, 10),
    notes: asset.notes ?? null,
    created_at: asset.created_at ?? now,
    updated_at: now,
  });
}

export async function deleteManualAsset(id: string): Promise<void> {
  await deleteLocalFinanceItem('manualAssets', id);
}

/**
 * Nur den Wert und den Stichtag fortschreiben — der übliche Vorgang, wenn
 * jemand neu schätzt.
 *
 * Läuft über `mutateLocalFinanceList`, weil zwischen Lesen und Schreiben ein
 * echtes `await` liegt (AGENTS.md §2): Zwei gleichzeitige Aufrufe läsen
 * denselben Stand, und der zweite schriebe eine Fassung ohne den ersten.
 */
export async function reviseManualAssetValue(
  id: string,
  value: number,
  valuedAt: string,
): Promise<void> {
  await mutateLocalFinanceList<ManualAsset>('manualAssets', (items) =>
    items.map((item) =>
      item.id === id
        ? { ...item, value, valued_at: valuedAt, updated_at: new Date().toISOString() }
        : item,
    ),
  );
}
