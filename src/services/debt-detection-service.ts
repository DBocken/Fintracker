import type { DebtPriority, DebtType, Transaction } from "../types";
import { getTransactions } from "./transaction-service";
import { normalizeMerchantName } from "./merchant-normalization";
import { BNPL_PROVIDERS, getDebts, suggestDebtPriority } from "./debt-service";

export type DebtSuggestionKind = "dunning" | "bnpl_recurring" | "overdraft_fee";

export interface DebtSuggestion {
  key: string;
  kind: DebtSuggestionKind;
  payee: string;
  occurrences: number;
  totalAmount: number;
  suggestedType: DebtType;
  suggestedPriority: DebtPriority;
  description: string;
}

const DUNNING_RE = /mahnung|inkasso|r[üu]cklastschrift|verzugszinsen|mahngeb[üu]hr|vollstreckung|gerichtsvollzieher/i;
const OVERDRAFT_RE = /[üu]berziehungszinsen|sollzinsen|dispozinsen/i;

function transactionText(t: Transaction): string {
  return `${t.payee || ""} ${t.description || ""} ${t.original_text || ""}`;
}

function isExistingDebt(name: string, existingNames: Set<string>): boolean {
  return existingNames.has(normalizeMerchantName(name));
}

export async function detectPotentialDebts(): Promise<DebtSuggestion[]> {
  const transactions = await getTransactions(2000);
  const debts = await getDebts();
  const existingNames = new Set<string>();
  debts.forEach((d) => {
    existingNames.add(normalizeMerchantName(d.name));
    if (d.provider) existingNames.add(normalizeMerchantName(d.provider));
  });

  const suggestions: DebtSuggestion[] = [];

  // 1. Mahnung/Inkasso/Rücklastschrift
  const dunningGroups = new Map<string, Transaction[]>();
  transactions.forEach((t) => {
    if (t.amount >= 0) return;
    if (!DUNNING_RE.test(transactionText(t))) return;
    const normalized = normalizeMerchantName(t.payee) || normalizeMerchantName(t.description) || "unbekannt";
    const arr = dunningGroups.get(normalized) || [];
    arr.push(t);
    dunningGroups.set(normalized, arr);
  });
  dunningGroups.forEach((group, normalized) => {
    const payee = group[0].payee || group[0].description || "Unbekannt";
    if (isExistingDebt(payee, existingNames)) return;
    suggestions.push({
      key: `dunning:${normalized}`,
      kind: "dunning",
      payee,
      occurrences: group.length,
      totalAmount: Math.round(group.reduce((s, t) => s + Math.abs(t.amount), 0) * 100) / 100,
      suggestedType: "other",
      suggestedPriority: suggestDebtPriority(payee),
      description: `Wir haben ${group.length} Buchung${group.length === 1 ? "" : "en"} mit Hinweis auf Mahnung/Inkasso bei "${payee}" gefunden.`,
    });
  });

  // 2. Wiederkehrende BNPL-Abbuchungen
  const bnplGroups = new Map<string, Transaction[]>();
  transactions.forEach((t) => {
    if (t.amount >= 0) return;
    const normalized = normalizeMerchantName(t.payee);
    if (!normalized) return;
    const provider = BNPL_PROVIDERS.find((p) => normalized.includes(p));
    if (!provider) return;
    const arr = bnplGroups.get(provider) || [];
    arr.push(t);
    bnplGroups.set(provider, arr);
  });
  bnplGroups.forEach((group, provider) => {
    if (group.length < 3) return;
    const payee = group[0].payee || provider;
    if (isExistingDebt(payee, existingNames) || isExistingDebt(provider, existingNames)) return;
    suggestions.push({
      key: `bnpl:${provider}`,
      kind: "bnpl_recurring",
      payee,
      occurrences: group.length,
      totalAmount: Math.round(group.reduce((s, t) => s + Math.abs(t.amount), 0) * 100) / 100,
      suggestedType: "bnpl",
      suggestedPriority: suggestDebtPriority(payee),
      description: `Wir haben ${group.length} wiederkehrende Abbuchungen von "${payee}" (Buy Now, Pay Later) gefunden.`,
    });
  });

  // 3. Dispo/Überziehungszinsen
  const overdraftGroups = new Map<string, Transaction[]>();
  transactions.forEach((t) => {
    if (t.amount >= 0) return;
    if (!OVERDRAFT_RE.test(transactionText(t))) return;
    const normalized = normalizeMerchantName(t.payee) || "dispo";
    const arr = overdraftGroups.get(normalized) || [];
    arr.push(t);
    overdraftGroups.set(normalized, arr);
  });
  overdraftGroups.forEach((group, normalized) => {
    const payee = group[0].payee || "Dispokredit";
    if (isExistingDebt(payee, existingNames)) return;
    suggestions.push({
      key: `overdraft:${normalized}`,
      kind: "overdraft_fee",
      payee,
      occurrences: group.length,
      totalAmount: Math.round(group.reduce((s, t) => s + Math.abs(t.amount), 0) * 100) / 100,
      suggestedType: "overdraft",
      suggestedPriority: suggestDebtPriority(payee),
      description: `Wir haben ${group.length} Buchung${group.length === 1 ? "" : "en"} mit Überziehungs-/Dispozinsen gefunden.`,
    });
  });

  return suggestions;
}
