/**
 * Steuerrücklage je Veranlagungsjahr (Einzelunternehmer-Modus). Lokal-first in
 * der `taxReserves`-Kollektion (Registry ⇒ Verschlüsselung/Backup inklusive),
 * stabile ID `tax-reserve-<year>`. Nur Bewegungen und der optionale
 * Prozent-Override werden gespeichert — das Ziel leitet computeTaxTank ab.
 */
import type { TaxReserveMovement, TaxReserveState } from '../types';
import { getCurrentUserId } from './auth-service';
import { readLocalFinanceList, upsertLocalFinanceItem } from './local-finance-store';
import { t } from '../i18n/serviceT';

const KEY = 'taxReserves' as const;

function reserveId(year: number): string {
  return `tax-reserve-${year}`;
}

async function localUserId(): Promise<string> {
  return (await getCurrentUserId()) || 'local';
}

export async function getTaxReserveState(year: number): Promise<TaxReserveState | null> {
  const all = await readLocalFinanceList<TaxReserveState>(KEY);
  return all.find((s) => s.id === reserveId(year)) ?? null;
}

async function upsertState(year: number, patch: Partial<TaxReserveState>): Promise<TaxReserveState> {
  const existing = await getTaxReserveState(year);
  return upsertLocalFinanceItem<TaxReserveState>(KEY, {
    id: reserveId(year),
    user_id: existing?.user_id ?? (await localUserId()),
    year,
    movements: existing?.movements ?? [],
    percent_override: existing?.percent_override ?? null,
    account_id: existing?.account_id ?? null,
    ...patch,
  });
}

/** Bewegung anhängen: + zurückgelegt, − Steuer gezahlt. Betrag ≠ 0 erforderlich. */
export async function addTaxReserveMovement(
  year: number,
  movement: Pick<TaxReserveMovement, 'date' | 'amount' | 'note'>,
): Promise<TaxReserveState> {
  if (!Number.isFinite(movement.amount) || movement.amount === 0) {
    throw new Error(t('taxReserveService.invalidAmount', 'Ungültiger Betrag für die Steuerrücklage.'));
  }
  const existing = await getTaxReserveState(year);
  const next: TaxReserveMovement = {
    id: crypto.randomUUID(),
    date: movement.date,
    amount: movement.amount,
    note: movement.note ?? null,
  };
  return upsertState(year, { movements: [...(existing?.movements ?? []), next] });
}

export async function deleteTaxReserveMovement(year: number, movementId: string): Promise<TaxReserveState> {
  const existing = await getTaxReserveState(year);
  return upsertState(year, {
    movements: (existing?.movements ?? []).filter((m) => m.id !== movementId),
  });
}

/** Jahres-Override des Rücklage-Prozentsatzes; null = Settings-Wert gilt. */
export async function setTaxReservePercentOverride(
  year: number,
  percent: number | null,
): Promise<TaxReserveState> {
  return upsertState(year, { percent_override: percent });
}
