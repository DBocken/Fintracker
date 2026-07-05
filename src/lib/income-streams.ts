/**
 * Einkommensstrom-Ableitung ("Woher kommt mein Geld?") — gruppiert positive,
 * transferbereinigte Buchungen nach Einkommens-Hauptkategorie + normalisiertem
 * Zahler und leitet Kadenz (regelmäßig/unregelmäßig), Trend und Diversifikation
 * ab. Reine Funktion, baut bewusst auf bestehender Infrastruktur auf statt sie
 * zu duplizieren: `detectSalarySeries` für Gehaltserkennung, `resolveHierarchy`/
 * `resolveAusgabenklasse` für die Kategorie-Hierarchie, `normalizeMerchantName`
 * für die Zahler-Normalisierung.
 */
import { parseISO, format, subMonths, differenceInCalendarMonths } from "date-fns";
import type { Category, Transaction } from "@/types";
import { resolveAusgabenklasse, resolveHierarchy } from "@/lib/analysis-data";
import { detectSalarySeries } from "@/lib/salary-detection";
import { normalizeMerchantName } from "@/services/merchant-normalization";

export type StreamCadence = "regelmaessig" | "unregelmaessig";

export interface IncomeStream {
  /** `${mainId}|${counterparty}` — stabile Gruppierungs-ID. */
  key: string;
  /** Zuletzt gesehener Zahler (Anzeige). */
  label: string;
  /** Normalisierter Zahler (Gruppierungsgrundlage). */
  counterparty: string;
  mainCategoryId: string | null;
  mainCategoryName: string;
  isSalary: boolean;
  cadence: StreamCadence;
  monthlyAverage: number;
  totalInWindow: number;
  lastDateISO: string;
  lastAmount: number;
  /** Anzahl unterschiedlicher Monate (yyyy-MM) mit Einnahmen im Fenster. */
  monthsActive: number;
  trend: "up" | "down" | "flat";
  confidence: number;
  /** Anteil an totalIncome (0..1). */
  share: number;
  transactionCount: number;
}

export interface IncomeStreamsResult {
  /** Absteigend nach totalInWindow sortiert. */
  streams: IncomeStream[];
  totalIncome: number;
  largestShare: number;
  diversification: "concentrated" | "moderate" | "diversified";
  windowMonths: number;
}

const DEFAULT_WINDOW_MONTHS = 12;

interface StreamAccumulator {
  key: string;
  counterparty: string;
  mainCategoryId: string | null;
  mainCategoryName: string;
  transactions: Transaction[];
  monthlyTotals: Map<string, number>;
}

function counterpartyFor(t: Transaction): string {
  return normalizeMerchantName(t.payee) || `konto-${t.account_id ?? "unbekannt"}`;
}

/**
 * Leitet Einkommensströme aus Transaktionen der letzten `windowMonths` Monate
 * ab. Positive Buchungen in einer bekannten Nicht-Einkommens-Kategorie (z. B.
 * eine Versicherungserstattung) werden ausgeschlossen — ein Strom bildet eine
 * Einkommensquelle ab, kein einmaliges Ausgaben-Backfill.
 */
export function deriveIncomeStreams(
  transactions: Transaction[],
  categories: Category[],
  options?: { now?: Date; windowMonths?: number },
): IncomeStreamsResult {
  const now = options?.now ?? new Date();
  const windowMonths = options?.windowMonths ?? DEFAULT_WINDOW_MONTHS;
  const cutoff = subMonths(now, windowMonths);

  const byId = new Map<string, Category>();
  for (const c of categories) byId.set(c.id, c);

  const salaryByEmployer = new Map(
    detectSalarySeries(transactions, now).map((series) => [series.employer, series]),
  );

  const windowTransactions = transactions.filter((t) => {
    if (t.is_transfer) return false;
    if (!(t.amount > 0)) return false;
    const parsed = parseISO(t.date);
    if (Number.isNaN(parsed.getTime())) return false;
    if (parsed < cutoff || parsed > now) return false;
    const assignedId = t.subcategory_id ?? t.category_id ?? null;
    const klasse = resolveAusgabenklasse(byId, assignedId);
    if (klasse && klasse !== "einkommen") return false;
    return true;
  });

  const groups = new Map<string, StreamAccumulator>();
  for (const t of windowTransactions) {
    const assignedId = t.subcategory_id ?? t.category_id ?? null;
    const { mainId, mainName } = resolveHierarchy(byId, assignedId);
    const counterparty = counterpartyFor(t);
    const key = `${mainId}|${counterparty}`;

    const group = groups.get(key) ?? {
      key,
      counterparty,
      mainCategoryId: mainId,
      mainCategoryName: mainName,
      transactions: [],
      monthlyTotals: new Map<string, number>(),
    };

    group.transactions.push(t);

    const month = format(parseISO(t.date), "yyyy-MM");
    group.monthlyTotals.set(month, (group.monthlyTotals.get(month) ?? 0) + t.amount);

    groups.set(key, group);
  }

  const totalIncome = windowTransactions.reduce((sum, t) => sum + t.amount, 0);

  const streams: IncomeStream[] = [...groups.values()].map((g) => {
    const sortedTx = [...g.transactions].sort((a, b) => a.date.localeCompare(b.date));
    const last = sortedTx[sortedTx.length - 1];
    const totalInWindow = g.transactions.reduce((sum, t) => sum + t.amount, 0);
    const monthsActive = g.monthlyTotals.size;
    const monthlyAverage = totalInWindow / Math.max(1, monthsActive);

    const salarySeries = salaryByEmployer.get(g.counterparty);
    const isSalary = Boolean(salarySeries);

    const sortedMonths = [...g.monthlyTotals.keys()].sort();
    const firstMonth = parseISO(`${sortedMonths[0]}-01`);
    const lastMonth = parseISO(`${sortedMonths[sortedMonths.length - 1]}-01`);
    const spanMonths = Math.max(1, differenceInCalendarMonths(lastMonth, firstMonth) + 1);

    let cadence: StreamCadence;
    let confidence: number;
    if (isSalary) {
      cadence = "regelmaessig";
      confidence = salarySeries!.confidence;
    } else if (monthsActive >= 3 && monthsActive / spanMonths >= 0.7) {
      cadence = "regelmaessig";
      confidence = Math.min(1, monthsActive / 6);
    } else {
      cadence = "unregelmaessig";
      confidence = 0.3;
    }

    let trend: "up" | "down" | "flat" = "flat";
    if (monthsActive >= 4) {
      const recentMonths = sortedMonths.slice(-3);
      const priorMonths = sortedMonths.slice(0, -3).slice(-3);
      if (priorMonths.length > 0) {
        const recentAvg = recentMonths.reduce((s, m) => s + (g.monthlyTotals.get(m) ?? 0), 0) / recentMonths.length;
        const priorAvg = priorMonths.reduce((s, m) => s + (g.monthlyTotals.get(m) ?? 0), 0) / priorMonths.length;
        if (recentAvg > priorAvg * 1.1) trend = "up";
        else if (recentAvg < priorAvg * 0.9) trend = "down";
      }
    }

    return {
      key: g.key,
      label: last.payee?.trim() || g.counterparty,
      counterparty: g.counterparty,
      mainCategoryId: g.mainCategoryId,
      mainCategoryName: g.mainCategoryName,
      isSalary,
      cadence,
      monthlyAverage,
      totalInWindow,
      lastDateISO: last.date.slice(0, 10),
      lastAmount: last.amount,
      monthsActive,
      trend,
      confidence,
      share: totalIncome > 0 ? totalInWindow / totalIncome : 0,
      transactionCount: g.transactions.length,
    };
  });

  streams.sort((a, b) => b.totalInWindow - a.totalInWindow);

  const largestShare = streams.length > 0 ? streams[0].share : 0;
  const diversification: IncomeStreamsResult["diversification"] =
    largestShare > 0.75 ? "concentrated" : largestShare > 0.4 ? "moderate" : "diversified";

  return { streams, totalIncome, largestShare, diversification, windowMonths };
}
