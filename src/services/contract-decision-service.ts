import { supabase } from '../integrations/supabase/client';
import { getCurrentUserId } from './auth-service';
import { readLocalFinanceList, writeLocalFinanceList } from './local-finance-store';
import type { Rhythmus } from '@/types';

/**
 * Dauerhafte Vertrags-Entscheidung des Nutzers, gebunden an einen normalisierten
 * Händler-Fingerprint (siehe lib/merchant-fingerprint). Verträge selbst werden aus
 * den Transaktionen abgeleitet; diese Entscheidung überschreibt nur den Status,
 * damit beendete/abgelehnte Verträge die aktuellen Fixkosten nicht verfälschen.
 */
export type ContractStatus =
  | 'candidate'
  | 'active'
  | 'ended'
  | 'rejected'
  | 'paused'
  | 'archived';

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  candidate: 'Kandidat',
  active: 'Aktiv',
  ended: 'Beendet',
  rejected: 'Kein Vertrag',
  paused: 'Pausiert',
  archived: 'Archiviert',
};

export interface ContractDecision {
  id: string;
  user_id: string;
  fingerprint: string;
  status: ContractStatus;
  cycle_override?: Rhythmus | null;
  ended_at?: string | null;
  note?: string | null;
  created_at?: string;
  updated_at?: string;
}

type DbRow = {
  id: string;
  user_id: string;
  fingerprint: string;
  status: string;
  cycle_override: string | null;
  ended_at: string | null;
  note: string | null;
  created_at?: string;
  updated_at?: string;
};

function fromDbRow(row: DbRow): ContractDecision {
  return {
    id: row.id,
    user_id: row.user_id,
    fingerprint: row.fingerprint,
    status: (row.status as ContractStatus) || 'candidate',
    cycle_override: (row.cycle_override as Rhythmus | null) ?? null,
    ended_at: row.ended_at,
    note: row.note,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getContractDecisions(): Promise<ContractDecision[]> {
  const maybeUid = await getCurrentUserId();
  if (!maybeUid) return readLocalFinanceList<ContractDecision>('contractDecisions');

  const { data, error } = await supabase
    .from('user_contract_decisions')
    .select('*')
    .eq('user_id', maybeUid);

  if (error) throw new Error(error.message);
  return (data || []).map((r) => fromDbRow(r as DbRow));
}

/** Liefert eine Map fingerprint -> Entscheidung für schnellen Lookup beim Ableiten. */
export async function getContractDecisionMap(): Promise<Map<string, ContractDecision>> {
  const decisions = await getContractDecisions();
  const map = new Map<string, ContractDecision>();
  decisions.forEach((d) => map.set(d.fingerprint, d));
  return map;
}

export interface ContractDecisionInput {
  status: ContractStatus;
  cycle_override?: Rhythmus | null;
  ended_at?: string | null;
  note?: string | null;
}

export async function upsertContractDecision(
  fingerprint: string,
  input: ContractDecisionInput,
): Promise<void> {
  const fp = fingerprint.trim();
  if (!fp) return;

  const maybeUid = await getCurrentUserId();
  const now = new Date().toISOString();

  if (!maybeUid) {
    const decisions = await readLocalFinanceList<ContractDecision>('contractDecisions');
    const existing = decisions.find((d) => d.fingerprint === fp);
    if (existing) {
      existing.status = input.status;
      existing.cycle_override = input.cycle_override ?? null;
      existing.ended_at = input.ended_at ?? null;
      existing.note = input.note ?? null;
      existing.updated_at = now;
    } else {
      decisions.push({
        id: crypto.randomUUID(),
        user_id: 'local',
        fingerprint: fp,
        status: input.status,
        cycle_override: input.cycle_override ?? null,
        ended_at: input.ended_at ?? null,
        note: input.note ?? null,
        created_at: now,
        updated_at: now,
      });
    }
    await writeLocalFinanceList('contractDecisions', decisions);
    return;
  }

  const { error } = await supabase.from('user_contract_decisions').upsert(
    {
      user_id: maybeUid,
      fingerprint: fp,
      status: input.status,
      cycle_override: input.cycle_override ?? null,
      ended_at: input.ended_at ?? null,
      note: input.note ?? null,
      updated_at: now,
    },
    { onConflict: 'user_id,fingerprint' },
  );

  if (error) throw new Error(error.message);
}

export async function deleteContractDecision(fingerprint: string): Promise<void> {
  const fp = fingerprint.trim();
  if (!fp) return;

  const maybeUid = await getCurrentUserId();

  if (!maybeUid) {
    const decisions = await readLocalFinanceList<ContractDecision>('contractDecisions');
    await writeLocalFinanceList(
      'contractDecisions',
      decisions.filter((d) => d.fingerprint !== fp),
    );
    return;
  }

  const { error } = await supabase
    .from('user_contract_decisions')
    .delete()
    .eq('fingerprint', fp)
    .eq('user_id', maybeUid);

  if (error) throw new Error(error.message);
}
