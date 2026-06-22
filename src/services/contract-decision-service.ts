import { readLocalFinanceList, writeLocalFinanceList } from './local-finance-store';
import { safeAudit, redactForAudit } from './audit-log-service';
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

export async function getContractDecisions(): Promise<ContractDecision[]> {
  return readLocalFinanceList<ContractDecision>('contractDecisions');
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

  const now = new Date().toISOString();
  const decisions = await readLocalFinanceList<ContractDecision>('contractDecisions');
  const existing = decisions.find((d) => d.fingerprint === fp);
  const before = existing ? { ...existing } : null;
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

  const saved = decisions.find((d) => d.fingerprint === fp);
  await safeAudit({
    actor: 'user',
    entityType: 'contract',
    entityId: saved?.id ?? fp,
    action: existing ? 'update' : 'create',
    title: `Vertragsentscheidung: ${input.status}`,
    redactedBefore: redactForAudit(before, ['fingerprint', 'status', 'cycle_override']),
    redactedAfter: redactForAudit(saved, ['fingerprint', 'status', 'cycle_override']),
    reversible: true,
    reversal: saved ? { operation: 'update', targetCollection: 'contractDecisions', targetId: saved.id } : null,
  });
}

export async function deleteContractDecision(fingerprint: string): Promise<void> {
  const fp = fingerprint.trim();
  if (!fp) return;

  const decisions = await readLocalFinanceList<ContractDecision>('contractDecisions');
  const removed = decisions.find((d) => d.fingerprint === fp) ?? null;
  await writeLocalFinanceList(
    'contractDecisions',
    decisions.filter((d) => d.fingerprint !== fp),
  );

  await safeAudit({
    actor: 'user',
    entityType: 'contract',
    entityId: removed?.id ?? fp,
    action: 'delete',
    title: 'Vertragsentscheidung gelöscht',
    redactedBefore: redactForAudit(removed, ['fingerprint', 'status', 'cycle_override']),
    redactedAfter: null,
    reversible: true,
    reversal: removed ? { operation: 'restore', targetCollection: 'contractDecisions', targetId: removed.id } : null,
  });
}
