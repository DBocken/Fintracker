import { parseISO, format, differenceInDays } from "date-fns";
import type { Transaction, Category, Rhythmus } from "@/types";
import type { Cycle, ContractRow } from "@/components/contracts/contract-types";
import type { ContractDecision, ContractStatus } from "@/services/contract-decision-service";
import { merchantFingerprint } from "@/lib/merchant-fingerprint";

/**
 * Reine, testbare Ableitung von Verträgen aus Transaktionen. Verträge bleiben
 * abgeleitet, werden aber mit gespeicherten Nutzerentscheidungen (ContractDecision)
 * zusammengeführt: beendete/abgelehnte/archivierte/pausierte Verträge fließen NICHT
 * in aktuelle Fixkosten und Prognosen ein, und ein unbekannter Zyklus wird nicht
 * mehr still als „monatlich" hochgerechnet.
 */

export function getCycleFromDays(avgDays: number): Cycle {
  if (avgDays >= 6 && avgDays <= 9) return "Wöchentlich";
  if (avgDays >= 25 && avgDays <= 35) return "Monatlich";
  if (avgDays >= 80 && avgDays <= 110) return "Vierteljährlich";
  if (avgDays >= 160 && avgDays <= 200) return "Halbjährlich";
  if (avgDays >= 330 && avgDays <= 395) return "Jährlich";
  return "Unbekannt";
}

export function addDaysISO(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

/** Ungefähre Zyklus-Länge in Tagen (für Stale-Erkennung). */
function cycleLengthDays(cycle: Cycle): number | null {
  switch (cycle) {
    case "Wöchentlich":
      return 7;
    case "Monatlich":
      return 30;
    case "Vierteljährlich":
      return 91;
    case "Halbjährlich":
      return 182;
    case "Jährlich":
      return 365;
    default:
      return null;
  }
}

/** Monatsäquivalent. Unbekannter Zyklus → 0 (nicht raten). */
export function monthlyEquivalent(amount: number, cycle: Cycle): number {
  switch (cycle) {
    case "Wöchentlich":
      return amount * 4.3;
    case "Monatlich":
      return amount;
    case "Vierteljährlich":
      return amount / 3;
    case "Halbjährlich":
      return amount / 6;
    case "Jährlich":
      return amount / 12;
    default:
      return 0; // unbekannt → nicht in normierte Monatslast zwingen
  }
}

/** Jahresäquivalent. Unbekannter Zyklus → 0 (nicht konservativ als monatlich raten). */
export function yearlyEquivalent(amount: number, cycle: Cycle): number {
  switch (cycle) {
    case "Wöchentlich":
      return amount * 52;
    case "Monatlich":
      return amount * 12;
    case "Vierteljährlich":
      return amount * 4;
    case "Halbjährlich":
      return amount * 2;
    case "Jährlich":
      return amount;
    default:
      return 0;
  }
}

function rhythmusToCycle(r: Rhythmus | null | undefined, fallback: Cycle): Cycle {
  switch (r) {
    case "weekly":
      return "Wöchentlich";
    case "monthly":
      return "Monatlich";
    case "quarterly":
      return "Vierteljährlich";
    case "yearly":
      return "Jährlich";
    default:
      return fallback;
  }
}

function nextDateFromCycle(lastISO: string, cycle: Cycle): string | null {
  const days = cycleLengthDays(cycle);
  return days ? addDaysISO(lastISO, days) : null;
}

/** Status aus Entscheidung + abgeleitetem Zustand bestimmen. */
function resolveStatus(
  decision: ContractDecision | undefined,
  confirmed: boolean,
): ContractStatus {
  if (decision) return decision.status;
  if (confirmed) return "active";
  return "candidate";
}

export interface DeriveOptions {
  decisions?: Map<string, ContractDecision>;
  /** Referenzdatum für die Stale-Erkennung (Default: jetzt). */
  now?: Date;
}

export function computeContracts(
  transactions: Transaction[],
  categoryMap: Map<string, Category>,
  type: "Ausgabe" | "Einnahme",
  options: DeriveOptions = {},
): ContractRow[] {
  const { decisions, now = new Date() } = options;
  const isExpense = type === "Ausgabe";
  const filtered = transactions.filter((t) => (isExpense ? t.amount < 0 : t.amount > 0));
  if (!filtered.length) return [];

  // Gruppierung nach Händler-Fingerprint (IBAN → normalisierter Händler, + Richtung).
  const groups = new Map<string, Transaction[]>();
  filtered.forEach((t) => {
    const key = merchantFingerprint(t);
    const arr = groups.get(key) || [];
    arr.push(t);
    groups.set(key, arr);
  });

  const rows: ContractRow[] = [];

  groups.forEach((list, fingerprint) => {
    const firstCatId = list[0]?.category_id || null;
    const cat = firstCatId ? categoryMap.get(firstCatId) : undefined;
    const explicit = !!cat?.attributes?.ist_vertrag;
    const decision = decisions?.get(fingerprint);

    // Mindestanzahl nur verlangen, wenn weder explizit markiert noch entschieden.
    if (list.length < 3 && !explicit && !decision) return;

    const sorted = [...list].sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());

    const amounts = sorted.map((t) => Math.abs(t.amount));
    const sortedAmt = [...amounts].sort((a, b) => a - b);
    const mid = Math.floor(sortedAmt.length / 2);
    const median = sortedAmt.length % 2 === 0 ? (sortedAmt[mid - 1] + sortedAmt[mid]) / 2 : sortedAmt[mid];

    const avg = amounts.reduce((s, v) => s + v, 0) / amounts.length;
    const variance = amounts.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / amounts.length;
    const stddev = Math.sqrt(variance);

    const diffs: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      diffs.push(differenceInDays(parseISO(sorted[i].date), parseISO(sorted[i - 1].date)));
    }
    const avgDays = diffs.length ? Math.round(diffs.reduce((s, v) => s + v, 0) / diffs.length) : 0;
    let cycle = getCycleFromDays(avgDays);

    // Zyklus-Override: Entscheidung > Kategorie-Attribut > erkannt.
    if (decision?.cycle_override) {
      cycle = rhythmusToCycle(decision.cycle_override, cycle);
    } else if (explicit && cat?.attributes?.rhythmus) {
      cycle = rhythmusToCycle(cat.attributes.rhythmus, cycle);
    }

    const isLikelyContract = cycle !== "Unbekannt" && stddev <= Math.max(1, median * 0.03);
    if (!isLikelyContract && !explicit && !decision) return;

    const last = sorted[sorted.length - 1];
    const first = sorted[0];
    const lastAmount = Math.abs(last.amount);
    const changeAmount = Math.round((lastAmount - median) * 100) / 100;
    const changed = changeAmount > 0.5;
    const changeSinceLabel = changed ? format(parseISO(last.date), "MMM yyyy") : null;

    const cycleKnown = cycle !== "Unbekannt";
    const nextDateISO = nextDateFromCycle(last.date, cycle);

    const confirmed = sorted.some((t) => t.is_contract === true);
    const transactionIds = sorted.map((t) => t.id || "").filter(Boolean);

    // Stale: letzte Buchung älter als 2× Zyklus zurück.
    const cycleDays = cycleLengthDays(cycle);
    const daysSinceLast = differenceInDays(now, parseISO(last.date));
    const stale = cycleDays != null && daysSinceLast > cycleDays * 2;

    const status = resolveStatus(decision, confirmed);

    rows.push({
      key: fingerprint,
      type,
      payee: (cat?.attributes?.merchant_alias || last.payee || "").trim() || "Unbekannt",
      categoryName: cat?.name || "Unkategorisiert",
      categoryId: firstCatId,
      amountTypical: median,
      amountLast: lastAmount,
      cycle,
      lastDateISO: last.date,
      firstDateISO: first.date,
      nextDateISO,
      changed,
      changeAmount,
      changeSinceLabel,
      confirmed,
      transactionIds,
      fingerprint,
      status,
      stale,
      cycleKnown,
    });
  });

  return rows;
}

/** Verträge, die in aktuelle Fixkosten/Prognosen einfließen dürfen. */
export function isActiveForTotals(row: ContractRow): boolean {
  return row.status === "active" && !row.stale && row.cycleKnown;
}

/**
 * Zentrale Vertragsauflösung für eine einzelne Buchung. Single Source of Truth für
 * Filter, Dashboard und Vertragsübersicht. Reihenfolge der Signale:
 *   1. Gespeicherte Nutzerentscheidung (ContractDecision) am Händler-Fingerprint –
 *      eine ausdrücklich beendete/abgelehnte Familie bleibt beendet/abgelehnt, auch
 *      wenn alte Buchungen oder Kategorie-Attribute etwas anderes nahelegen.
 *   2. Buchung explizit als Vertrag markiert (is_contract).
 *   3. Legacy: Kategorie-Attribut ist_vertrag.
 * Ohne jedes Signal gilt die Buchung als "candidate" (noch kein bestätigter Vertrag).
 */
export function resolveContractStatus(
  transaction: Transaction,
  decisions: Map<string, ContractDecision>,
  category?: Category,
): ContractStatus {
  const decision = decisions.get(merchantFingerprint(transaction));
  if (decision) return decision.status;
  if (transaction.is_contract === true) return "active";
  if (category?.attributes?.ist_vertrag === true) return "active";
  return "candidate";
}

/** Gilt eine Buchung mit diesem Status als (aktueller) Vertrag? */
export function isContractStatus(status: ContractStatus): boolean {
  return status === "active" || status === "paused";
}
