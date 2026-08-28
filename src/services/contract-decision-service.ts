import { mutateLocalFinanceList, readLocalFinanceList } from './local-finance-store';
import { safeAudit, redactForAudit } from './audit-log-service';
import { t } from '@/i18n/serviceT';
import type { Rhythmus } from '@/types';
import type { ContractDecision, ContractStatus } from '@/lib/contract-types';
import { indexContractDecisions } from '@/lib/contract-decision-index';

export function getContractStatusLabels(): Record<ContractStatus, string> {
  return {
    candidate: t('contracts.statusLabels.candidate'),
    active: t('contracts.statusLabels.active'),
    ended: t('contracts.statusLabels.ended'),
    rejected: t('contracts.statusLabels.rejected'),
    paused: t('contracts.statusLabels.paused'),
    archived: t('contracts.statusLabels.archived'),
  };
}

export async function getContractDecisions(): Promise<ContractDecision[]> {
  return readLocalFinanceList<ContractDecision>('contractDecisions');
}

/**
 * Liefert eine Map fingerprint -> Entscheidung für schnellen Lookup beim Ableiten.
 *
 * Der Index läuft über `indexContractDecisions`, damit eine Entscheidung auch
 * unter ihrem HEUTIGEN Fingerprint gefunden wird, wenn sie vor der
 * verschärften Händler-Normalisierung gespeichert wurde. Ohne das käme eine
 * ausdrücklich abgelehnte Vertragsfamilie still zurück — die Entscheidung
 * stünde weiter im Speicher, sie würde nur nicht mehr gefunden.
 */
export async function getContractDecisionMap(): Promise<Map<string, ContractDecision>> {
  return indexContractDecisions(await getContractDecisions());
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
  // Halter-Objekt statt `let` — siehe merchant-rules-service: TypeScript
  // verwirft die Typinformation einer in einem Callback gesetzten Variablen.
  const vorher: { entscheidung: ContractDecision | null; bestand: boolean } = {
    entscheidung: null,
    bestand: false,
  };

  // Serialisiert (Issue #311): Der Vertragsbildschirm bestätigt Entscheidungen
  // in Folge; ohne Lock überschrieb die zweite die erste.
  const decisions = await mutateLocalFinanceList<ContractDecision>('contractDecisions', (aktuell) => {
    const existing = aktuell.find((d) => d.fingerprint === fp);
    vorher.entscheidung = existing ? { ...existing } : null;
    vorher.bestand = Boolean(existing);
    if (existing) {
      return aktuell.map((d) =>
        d.fingerprint === fp
          ? {
              ...d,
              status: input.status,
              cycle_override: input.cycle_override ?? null,
              ended_at: input.ended_at ?? null,
              note: input.note ?? null,
              updated_at: now,
            }
          : d,
      );
    }
    return [
      ...aktuell,
      {
        id: crypto.randomUUID(),
        user_id: 'local',
        fingerprint: fp,
        status: input.status,
        cycle_override: input.cycle_override ?? null,
        ended_at: input.ended_at ?? null,
        note: input.note ?? null,
        created_at: now,
        updated_at: now,
      },
    ];
  });

  const saved = decisions.find((d) => d.fingerprint === fp);
  await safeAudit({
    actor: 'user',
    entityType: 'contract',
    entityId: saved?.id ?? fp,
    action: vorher.bestand ? 'update' : 'create',
    title: `Vertragsentscheidung: ${input.status}`,
    redactedBefore: redactForAudit(vorher.entscheidung, ['fingerprint', 'status', 'cycle_override']),
    redactedAfter: redactForAudit(saved, ['fingerprint', 'status', 'cycle_override']),
    reversible: true,
    reversal: saved ? { operation: 'update', targetCollection: 'contractDecisions', targetId: saved.id } : null,
  });
}

export async function deleteContractDecision(fingerprint: string): Promise<void> {
  const fp = fingerprint.trim();
  if (!fp) return;

  const geloescht: { entscheidung: ContractDecision | null } = { entscheidung: null };
  await mutateLocalFinanceList<ContractDecision>('contractDecisions', (decisions) => {
    geloescht.entscheidung = decisions.find((d) => d.fingerprint === fp) ?? null;
    return decisions.filter((d) => d.fingerprint !== fp);
  });
  const removed = geloescht.entscheidung;

  await safeAudit({
    actor: 'user',
    entityType: 'contract',
    entityId: removed?.id ?? fp,
    action: 'delete',
    title: t('contractDecisionServiceLib.decisionDeletedTitle', 'Vertragsentscheidung gelöscht'),
    redactedBefore: redactForAudit(removed, ['fingerprint', 'status', 'cycle_override']),
    redactedAfter: null,
    reversible: true,
    reversal: removed ? { operation: 'restore', targetCollection: 'contractDecisions', targetId: removed.id } : null,
  });
}
