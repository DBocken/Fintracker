"use client";

import { LocalEncryptionLockedError, localEncryption } from './local-crypto';

export const LOCAL_FINANCE_KEYS = {
  transactions: 'ausgabentracker_transactions_v3',
  accounts: 'ausgabentracker_accounts_v1',
  debts: 'ausgabentracker_debts_v1',
  portfolios: 'ausgabentracker_portfolios_v1',
  portfolioPositions: 'ausgabentracker_portfolio_positions_v1',
  bankConnections: 'ausgabentracker_bank_connections_v1',
} as const;

export type LocalFinanceKey = keyof typeof LOCAL_FINANCE_KEYS;

function assertClientStorage() {
  if (typeof window === 'undefined') {
    throw new Error('Lokale Finanzdaten können nur im Client verarbeitet werden.');
  }
}

export async function readLocalFinanceList<T>(key: LocalFinanceKey): Promise<T[]> {
  assertClientStorage();
  if (localEncryption.isEnabled() && !localEncryption.isUnlocked()) {
    throw new LocalEncryptionLockedError();
  }

  const data = await localEncryption.loadAndMaybeDecrypt<T[]>(LOCAL_FINANCE_KEYS[key]);
  return Array.isArray(data) ? data : [];
}

export async function writeLocalFinanceList<T>(key: LocalFinanceKey, items: T[]): Promise<void> {
  assertClientStorage();
  if (localEncryption.isEnabled() && !localEncryption.isUnlocked()) {
    throw new LocalEncryptionLockedError();
  }

  await localEncryption.encryptAndStore(LOCAL_FINANCE_KEYS[key], items);
}

export async function upsertLocalFinanceItem<T extends { id?: string }>(
  key: LocalFinanceKey,
  item: T,
): Promise<T & { id: string }> {
  const items = await readLocalFinanceList<T & { id: string }>(key);
  const id = item.id || crypto.randomUUID();
  const now = new Date().toISOString();
  const nextItem = {
    ...item,
    id,
    updated_at: (item as any).updated_at ?? now,
    created_at: (item as any).created_at ?? now,
  } as T & { id: string };

  const index = items.findIndex((entry) => entry.id === id);
  if (index >= 0) {
    items[index] = { ...items[index], ...nextItem };
  } else {
    items.push(nextItem);
  }

  await writeLocalFinanceList(key, items);
  return nextItem;
}

export async function updateLocalFinanceItem<T extends { id?: string }>(
  key: LocalFinanceKey,
  id: string,
  updates: Partial<T>,
): Promise<T> {
  const items = await readLocalFinanceList<T>(key);
  const index = items.findIndex((entry) => entry.id === id);
  if (index < 0) throw new Error('Datensatz nicht gefunden');

  const updated = {
    ...items[index],
    ...updates,
    id,
    updated_at: new Date().toISOString(),
  } as T;
  items[index] = updated;
  await writeLocalFinanceList(key, items);
  return updated;
}

export async function deleteLocalFinanceItem<T extends { id?: string }>(
  key: LocalFinanceKey,
  id: string,
): Promise<void> {
  const items = await readLocalFinanceList<T>(key);
  await writeLocalFinanceList(key, items.filter((entry) => entry.id !== id));
}

export function hasPlaintextFinanceStorage(): boolean {
  if (typeof window === 'undefined') return false;

  return Object.values(LOCAL_FINANCE_KEYS).some((storageKey) => {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw);
      return parsed?.type !== 'ausgabentracker.enc';
    } catch {
      return true;
    }
  });
}

export function getLocalFinanceStorageStatus() {
  if (typeof window === 'undefined') {
    return { encrypted: false, unlocked: false, plaintextFound: false };
  }

  return {
    encrypted: localEncryption.isEnabled(),
    unlocked: localEncryption.isUnlocked(),
    plaintextFound: hasPlaintextFinanceStorage(),
  };
}
