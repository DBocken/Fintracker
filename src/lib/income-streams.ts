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
import { detectSalarySeries, addOneMonthISO } from "@/lib/salary-detection";
import { normalizeMerchantName } from "@/lib/merchant-normalization";

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
  /** Nächste erwartete Zahlung (ISO yyyy-MM-dd) — null bei unregelmäßigen Strömen. */
  nextDateISO: string | null;
  /** Erwarteter Betrag der nächsten Zahlung — null bei unregelmäßigen Strömen. */
  nextAmount: number | null;
  /** Summe je Monat (yyyy-MM) im Fenster — Basis für Payout-Radar & Wrapped. */
  monthlyTotals: Record<string, number>;
  /**
   * Einzelzahlungen des Stroms im Fenster, nach Datum absteigend (neueste
   * zuerst). Additiv ergänzt für die Finanzstadt (Einnahmen-Tab: Etagen +
   * Sheet-Buchungsliste) — `txId` fehlt nur bei Transaktionen ohne id.
   */
  payments: IncomeStreamPayment[];
}

export interface IncomeStreamPayment {
  txId?: string;
  /** ISO yyyy-MM-dd. */
  dateISO: string;
  amount: number;
  payee: string;
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

    // Projektion der nächsten Auszahlung: Gehalt nutzt die Serien-Vorhersage,
    // andere regelmäßige Ströme extrapolieren „letzter Eingang + 1 Monat".
    // Unregelmäßige Ströme werden bewusst NICHT vorhergesagt (kein Scheinwert).
    let nextDateISO: string | null = null;
    let nextAmount: number | null = null;
    if (isSalary) {
      nextDateISO = salarySeries!.nextDateISO;
      nextAmount = salarySeries!.amountRecentTypical;
    } else if (cadence === "regelmaessig") {
      nextDateISO = addOneMonthISO(last.date.slice(0, 10));
      nextAmount = last.amount;
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
      nextDateISO,
      nextAmount,
      monthlyTotals: Object.fromEntries(g.monthlyTotals),
      payments: [...sortedTx]
        .reverse() // sortedTx ist aufsteigend — Anzeige-Konvention ist neueste zuerst.
        .map((t) => ({ txId: t.id, dateISO: t.date.slice(0, 10), amount: t.amount, payee: t.payee })),
    };
  });

  streams.sort((a, b) => b.totalInWindow - a.totalInWindow);

  const largestShare = streams.length > 0 ? streams[0].share : 0;
  const diversification: IncomeStreamsResult["diversification"] =
    largestShare > 0.75 ? "concentrated" : largestShare > 0.4 ? "moderate" : "diversified";

  return { streams, totalIncome, largestShare, diversification, windowMonths };
}

// -----------------------------------------------------------------------------
// Payout-Radar — „Wann kommt das nächste Geld?" aus den Strom-Projektionen.
// -----------------------------------------------------------------------------

export interface PayoutRadarEntry {
  key: string;
  label: string;
  nextDateISO: string;
  nextAmount: number;
  confidence: number;
  isSalary: boolean;
  /** true, wenn die erwartete Zahlung vor `now` liegt (überfällig). */
  overdue: boolean;
}

/**
 * Baut den Payout-Radar aus den Strömen: nur Ströme mit vorhersagbarer nächster
 * Zahlung (`nextDateISO !== null`), aufsteigend nach Datum sortiert, auf `limit`
 * begrenzt (Default 5). Überfällige Zahlungen werden markiert.
 */
export function buildPayoutRadar(
  streams: IncomeStream[],
  options?: { now?: Date; limit?: number },
): PayoutRadarEntry[] {
  const now = options?.now ?? new Date();
  const limit = options?.limit ?? 5;
  const nowISO = format(now, "yyyy-MM-dd");

  return streams
    .filter((s): s is IncomeStream & { nextDateISO: string; nextAmount: number } =>
      s.nextDateISO !== null && s.nextAmount !== null,
    )
    .map((s) => ({
      key: s.key,
      label: s.label,
      nextDateISO: s.nextDateISO,
      nextAmount: s.nextAmount,
      confidence: s.confidence,
      isSalary: s.isSalary,
      overdue: s.nextDateISO < nowISO,
    }))
    .sort((a, b) => a.nextDateISO.localeCompare(b.nextDateISO))
    .slice(0, limit);
}
