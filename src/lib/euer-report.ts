/**
 * Pure EÜR-Jahresauswertung (Einnahmenüberschussrechnung, §4 Abs. 3 EStG) für
 * Einzelunternehmer — v1 bewusst Kleinunternehmer (§19 UStG): Brutto-Beträge,
 * keine USt-Trennung. Deterministisch, ohne Seiteneffekte (Muster tax-report).
 *
 * Klassifikationsregeln (Reihenfolge ist fachlich bindend):
 * 1. Transfers sind NIE gewinnwirksam. Genau ein Bein auf einem Geschäftskonto
 *    ⇒ Info-Zeile Privatentnahme (raus) / Privateinlage (rein); sonst ignoriert.
 * 2. `euer_private` gewinnt IMMER (explizite Nutzer-Exklusion); Konflikt mit
 *    einer EÜR-Markierung ⇒ `markingConflict`-Warnung.
 * 3. EÜR-`tax_category_id` zählt auf JEDEM Konto; gegenläufiges Vorzeichen ist
 *    Erstattung/Minderung derselben Zeile (Netting OHNE Clamp ⇒ `negativeLine`).
 *    Nicht-EÜR-Steuermarkierungen (§35a & Co.) bleiben privat — sie werden im
 *    Steuer-Report verwertet, ein Mitzählen hier wäre Doppelverwertung.
 * 4. Unmarkiert auf Geschäftskonto ⇒ betrieblich: Einnahmen nach Hauptkategorie
 *    (`cat:<id>`), Ausgaben in „Sonstige Betriebsausgaben" + Warnung.
 * 5. Sonst privat. Selbständigen-Einnahmen auf Privatkonten werden NUR als
 *    Kandidaten gelistet (nie Auto-Zählung — private Verkäufe sind keine
 *    Betriebseinnahmen).
 *
 * Bewusste v1-Limitation: Splits zählen ganz (die Buchung, nicht die Allocation).
 * Jahreszuordnung strikt nach Buchungsdatum (Zu-/Abflussprinzip §11 EStG).
 */
import type { Account, Transaction } from '@/types';
import { asTransactionId } from '@/lib/ids';
import { getRubricForCategory, getTaxParams, taxCategoryById, type TaxYearParams } from '@/data/tax-catalog';
import { TAX_CATEGORIES } from '@/data/tax-catalog';
import { TAX_RELEVANT_MAIN_IDS } from '@/lib/tax-reserve';

export type EuerWarningKind =
  | 'markingConflict'
  | 'negativeLine'
  | 'unassignedExpenses'
  | 'paramsNotExact';

export interface EuerWarning {
  kind: EuerWarningKind;
  count?: number;
  amount?: number;
}

export interface EuerLine {
  /** EÜR-Blatt-ID (`tax-eur-*`) oder `cat:<Hauptkategorie>` für unmarkierte Einnahmen. */
  key: string;
  /** Bruttosumme der Seite (Kosten bzw. Einnahmen), positiv gehalten. */
  gross: number;
  /** Gegenläufige Beträge (Erstattung/Storno), positiv gehalten. */
  refunds: number;
  /** gross − refunds, OHNE Clamp (negativ ⇒ `negativeLine`-Warnung). */
  net: number;
  /** Abziehbar: net × Satz (Bewirtung 70 %), sonst = net. Einnahmen: = net. */
  deductible: number;
  txCount: number;
  transactionIds: string[];
}

export interface EuerReport {
  year: number;
  paramsExact: boolean;
  paramsUsedYear: number;
  einnahmen: { total: number; lines: EuerLine[] };
  /** grossTotal = Σ net (nach Erstattungs-Netting, VOR Abzugssatz); deductibleTotal = Σ deductible. */
  ausgaben: { grossTotal: number; deductibleTotal: number; lines: EuerLine[] };
  /** Einnahmen (netto) − abziehbare Ausgaben. */
  gewinn: number;
  /** Info-Zeilen, nie gewinnwirksam. */
  privatTransfers: { entnahmen: number; einlagen: number };
  warnings: EuerWarning[];
  /** Selbständigen-Einnahmen auf Privatkonten — nur Hinweis, nie gezählt. */
  candidateIncomeTxIds: string[];
  /** Unmarkierte Geschäftskonto-Ausgaben (in „Sonstige" gezählt). */
  unassignedExpenseTxIds: string[];
}

const SONSTIGE_ID = 'tax-eur-betriebsausgabe';
const EINNAHME_ID = 'tax-eur-betriebseinnahme';

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function isEuerCategory(taxCategoryId: string | null | undefined): boolean {
  return Boolean(taxCategoryId && getRubricForCategory(taxCategoryId)?.anlage === 'euer');
}

function isEuerIncomeCategory(taxCategoryId: string): boolean {
  return getRubricForCategory(taxCategoryId)?.kind === 'income';
}

/**
 * Betriebseinnahme im Sinne der Rücklage/Waterfall: EÜR-markierte Einnahme auf
 * jedem Konto oder unmarkierte Einnahme auf einem Geschäftskonto. Transfers und
 * `euer_private` nie.
 */
export function isBusinessIncomeTx(tx: Transaction, businessAccountIds: ReadonlySet<string>): boolean {
  if (tx.is_transfer || tx.euer_private || tx.amount <= 0) return false;
  if (tx.tax_category_id && isEuerCategory(tx.tax_category_id)) {
    return isEuerIncomeCategory(tx.tax_category_id);
  }
  // Nicht-EÜR-Steuermarkierungen bleiben privat (Regel 3).
  if (tx.tax_category_id) return false;
  return Boolean(tx.account_id && businessAccountIds.has(tx.account_id));
}

interface LineAccu {
  key: string;
  gross: number;
  refunds: number;
  txCount: number;
  transactionIds: string[];
}

function accumulate(map: Map<string, LineAccu>, key: string, tx: Transaction, isRefund: boolean): void {
  const entry = map.get(key) ?? { key, gross: 0, refunds: 0, txCount: 0, transactionIds: [] };
  if (isRefund) entry.refunds += Math.abs(tx.amount);
  else entry.gross += Math.abs(tx.amount);
  entry.txCount += 1;
  if (tx.id) entry.transactionIds.push(tx.id);
  map.set(key, entry);
}

function finalizeLine(accu: LineAccu, params: TaxYearParams, warnings: EuerWarning[]): EuerLine {
  const net = round2(accu.gross - accu.refunds);
  if (net < 0) warnings.push({ kind: 'negativeLine', amount: round2(-net) });
  const rateParam = taxCategoryById.get(accu.key)?.rule?.rateParam;
  const deductible = rateParam ? round2(net * params[rateParam]) : net;
  return {
    key: accu.key,
    gross: round2(accu.gross),
    refunds: round2(accu.refunds),
    net,
    deductible,
    txCount: accu.txCount,
    transactionIds: accu.transactionIds,
  };
}

/** Katalog-Reihenfolge der EÜR-Ausgaben-Blätter (Anlage-EÜR-orientiert). */
const EXPENSE_ORDER = new Map(
  TAX_CATEGORIES.filter((c) => c.rubricId === 'betriebsausgaben').map((c, i) => [c.id, i]),
);

export function buildEuerReport(
  transactions: Transaction[],
  accounts: Account[],
  year: number,
): EuerReport {
  const { params, exact } = getTaxParams(year);
  const from = `${year}-01-01`;
  const to = `${year}-12-31`;

  const businessAccountIds = new Set(accounts.filter((a) => a.is_business).map((a) => a.id));
  const txById = new Map(transactions.filter((t) => t.id).map((t) => [t.id!, t]));

  const inYear = transactions.filter(
    (tx) => typeof tx.date === 'string' && tx.date >= from && tx.date <= to,
  );

  const warnings: EuerWarning[] = [];
  const incomeMap = new Map<string, LineAccu>();
  const expenseMap = new Map<string, LineAccu>();
  const candidateIncomeTxIds: string[] = [];
  const unassignedExpenseTxIds: string[] = [];
  let entnahmen = 0;
  let einlagen = 0;
  let markingConflicts = 0;

  for (const tx of inYear) {
    const onBusiness = Boolean(tx.account_id && businessAccountIds.has(tx.account_id));

    // Regel 1: Transfers — nie gewinnwirksam; nur das Geschäftskonto-Bein
    // erzeugt die Info-Zeile (verhindert Doppelzählung über das Gegen-Bein).
    if (tx.is_transfer) {
      if (!onBusiness) continue;
      const pair = tx.transfer_pair_id ? txById.get(asTransactionId(tx.transfer_pair_id)) : undefined;
      const pairOnBusiness = Boolean(pair?.account_id && businessAccountIds.has(pair.account_id));
      if (pairOnBusiness) continue; // Geschäft↔Geschäft: rein intern.
      if (tx.amount < 0) entnahmen += Math.abs(tx.amount);
      else if (tx.amount > 0) einlagen += tx.amount;
      continue;
    }

    // Regel 2: explizite Exklusion gewinnt.
    if (tx.euer_private) {
      if (isEuerCategory(tx.tax_category_id)) markingConflicts += 1;
      continue;
    }

    // Regel 3: EÜR-Markierung zählt auf jedem Konto.
    if (tx.tax_category_id && isEuerCategory(tx.tax_category_id)) {
      if (isEuerIncomeCategory(tx.tax_category_id)) {
        accumulate(incomeMap, tx.tax_category_id, tx, tx.amount < 0);
      } else {
        accumulate(expenseMap, tx.tax_category_id, tx, tx.amount > 0);
      }
      continue;
    }

    // Nicht-EÜR-Steuermarkierung (§35a, Werbungskosten, …) ⇒ privat verwertet.
    if (tx.tax_category_id) continue;

    // Regel 4: unmarkiert auf Geschäftskonto ⇒ betrieblich.
    if (onBusiness) {
      if (tx.amount > 0) {
        accumulate(incomeMap, `cat:${tx.category_id ?? 'none'}`, tx, false);
      } else if (tx.amount < 0) {
        accumulate(expenseMap, SONSTIGE_ID, tx, false);
        if (tx.id) unassignedExpenseTxIds.push(tx.id);
      }
      continue;
    }

    // Regel 5: privat — Selbständigen-Einnahmen nur als Kandidaten.
    if (
      tx.amount > 0 &&
      tx.id &&
      tx.category_id &&
      (TAX_RELEVANT_MAIN_IDS as readonly string[]).includes(tx.category_id)
    ) {
      candidateIncomeTxIds.push(tx.id);
    }
  }

  if (!exact) warnings.push({ kind: 'paramsNotExact' });
  if (markingConflicts > 0) warnings.push({ kind: 'markingConflict', count: markingConflicts });
  if (unassignedExpenseTxIds.length > 0) {
    warnings.push({ kind: 'unassignedExpenses', count: unassignedExpenseTxIds.length });
  }

  const incomeLines = [...incomeMap.values()]
    .map((a) => finalizeLine(a, params, warnings))
    // Markiertes Einnahmen-Blatt zuerst, dann Kategorien nach Betrag.
    .sort((a, b) => (a.key === EINNAHME_ID ? -1 : b.key === EINNAHME_ID ? 1 : b.net - a.net));

  const expenseLines = [...expenseMap.values()]
    .map((a) => finalizeLine(a, params, warnings))
    .sort(
      (a, b) =>
        (EXPENSE_ORDER.get(a.key) ?? Number.MAX_SAFE_INTEGER) -
        (EXPENSE_ORDER.get(b.key) ?? Number.MAX_SAFE_INTEGER),
    );

  const einnahmenTotal = round2(incomeLines.reduce((s, l) => s + l.net, 0));
  const grossTotal = round2(expenseLines.reduce((s, l) => s + l.net, 0));
  const deductibleTotal = round2(expenseLines.reduce((s, l) => s + l.deductible, 0));

  return {
    year,
    paramsExact: exact,
    paramsUsedYear: params.vz,
    einnahmen: { total: einnahmenTotal, lines: incomeLines },
    ausgaben: { grossTotal, deductibleTotal, lines: expenseLines },
    gewinn: round2(einnahmenTotal - deductibleTotal),
    privatTransfers: { entnahmen: round2(entnahmen), einlagen: round2(einlagen) },
    warnings,
    candidateIncomeTxIds,
    unassignedExpenseTxIds,
  };
}
