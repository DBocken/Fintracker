/**
 * Übersicht der aktiven Planungs-Annahmen ("Aktive Änderungen").
 *
 * Ersetzt den früheren Szenario-Vergleich: Statt vorgefertigte Was-wäre-wenn-
 * Vorlagen zu wählen, trägt der Nutzer seine Annahmen direkt ein. Diese Funktion
 * verdichtet die rohen Overrides zu einer lesbaren Chip-Liste, damit der Nutzer
 * jederzeit sieht, welche Annahmen die Prognose gerade vom Ist-Zustand entfernen
 * – und jede einzeln zurücknehmen kann.
 */
import type { ForecastOverrides } from '@/services/forecast-overrides-service';
import type { RecurringFlow } from '@/lib/forecast-types';

export type OverrideChangeKind =
  | 'flow-disabled'
  | 'flow-amount'
  | 'flow-enddate'
  | 'budget'
  | 'event'
  | 'transfer'
  | 'fund'
  | 'interest';

export type OverrideSource =
  | 'recurringFlowOverrides'
  | 'categoryBudgets'
  | 'plannedEvents'
  | 'transfers'
  | 'sinkingFunds'
  | 'accountInterest';

export interface OverrideChange {
  /** Eindeutiger React-Key. */
  id: string;
  kind: OverrideChangeKind;
  /** Anzeigetext, z. B. „Miete bis 31.12.2026“. */
  label: string;
  /** Sammlung, in der die Änderung lebt (für gezieltes Entfernen). */
  source: OverrideSource;
  /** Schlüssel innerhalb der Sammlung (flowId, Kategorie, Event-id, accountId). */
  key: string;
  /**
   * Feinkörniges Feld bei zusammengesetzten Overrides (ein Vertrag kann zugleich
   * Betrag UND End-Datum überschreiben). Erlaubt, genau einen Aspekt zu lösen.
   */
  field?: 'enabled' | 'amount' | 'endDate';
}

const eur = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

/** Signierter Betrag mit explizitem Plus für Zuflüsse. */
function signed(amount: number): string {
  return `${amount >= 0 ? '+' : '−'}${eur.format(Math.abs(amount))}`;
}

/**
 * Formatiert ein ISO-Datum (yyyy-mm-dd) als d.m.yyyy. Bewusst ohne date-fns/TZ –
 * reine String-Umstellung, damit ein Tagesdatum nie durch Zeitzonen verrutscht.
 * Unerwartete Eingaben werden unverändert durchgereicht (robust statt werfend).
 */
function fmtDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const [, y, mo, d] = m;
  return `${d}.${mo}.${y}`;
}

interface SummaryOptions {
  flows?: RecurringFlow[];
  accountName?: (id: string) => string;
}

/**
 * Verdichtet die Overrides zu einer Liste lesbarer Änderungs-Chips. Jeder Chip
 * trägt genug Information (source/key/field), damit die UI ihn gezielt löschen
 * kann, ohne die Formatierung erneut interpretieren zu müssen.
 */
export function summarizeOverrides(
  overrides: ForecastOverrides,
  opts: SummaryOptions = {},
): OverrideChange[] {
  const flowName = (id: string) => opts.flows?.find((f) => f.id === id)?.name ?? id;
  const accountName = opts.accountName ?? ((id: string) => id);
  const changes: OverrideChange[] = [];

  // Verträge: deaktiviert / Betrag / End-Datum – je als eigener Chip.
  for (const [flowId, ov] of Object.entries(overrides.recurringFlowOverrides ?? {})) {
    const name = flowName(flowId);
    if (ov.enabled === false) {
      changes.push({
        id: `flow-${flowId}-enabled`,
        kind: 'flow-disabled',
        label: `${name} deaktiviert`,
        source: 'recurringFlowOverrides',
        key: flowId,
        field: 'enabled',
      });
    }
    if (ov.amount != null) {
      changes.push({
        id: `flow-${flowId}-amount`,
        kind: 'flow-amount',
        label: `${name}: ${signed(ov.amount)}`,
        source: 'recurringFlowOverrides',
        key: flowId,
        field: 'amount',
      });
    }
    if (ov.endDate != null) {
      changes.push({
        id: `flow-${flowId}-enddate`,
        kind: 'flow-enddate',
        label: `${name} bis ${fmtDate(ov.endDate)}`,
        source: 'recurringFlowOverrides',
        key: flowId,
        field: 'endDate',
      });
    }
  }

  // Variable Budgets.
  for (const [category, amount] of Object.entries(overrides.categoryBudgets ?? {})) {
    changes.push({
      id: `budget-${category}`,
      kind: 'budget',
      label: `Budget ${category}: ${eur.format(amount)}`,
      source: 'categoryBudgets',
      key: category,
    });
  }

  // Geplante Einmalposten.
  for (const ev of overrides.plannedEvents ?? []) {
    changes.push({
      id: `event-${ev.id}`,
      kind: 'event',
      label: `${ev.name}: ${signed(ev.amount)} am ${fmtDate(ev.date)}`,
      source: 'plannedEvents',
      key: ev.id,
    });
  }

  // Transfers (einmalig oder wiederkehrend).
  for (const t of overrides.transfers ?? []) {
    const when = t.date ? `am ${fmtDate(t.date)}` : 'wiederkehrend';
    changes.push({
      id: `transfer-${t.id}`,
      kind: 'transfer',
      label: `${t.name ? `${t.name}: ` : 'Transfer '}${eur.format(t.amount)} ${when}`,
      source: 'transfers',
      key: t.id,
    });
  }

  // Rücklagen.
  for (const f of overrides.sinkingFunds ?? []) {
    changes.push({
      id: `fund-${f.id}`,
      kind: 'fund',
      label: `Rücklage ${f.name}: ${eur.format(f.targetAmount)} bis ${fmtDate(f.dueDate)}`,
      source: 'sinkingFunds',
      key: f.id,
    });
  }

  // Tagesgeld-Zinsen.
  for (const [accountId, pct] of Object.entries(overrides.accountInterest ?? {})) {
    changes.push({
      id: `interest-${accountId}`,
      kind: 'interest',
      label: `${accountName(accountId)}: ${pct}% Zinsen`,
      source: 'accountInterest',
      key: accountId,
    });
  }

  return changes;
}
