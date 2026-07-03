import type { Account, AccountType } from "@/types";

/**
 * Reine Präsentationsdaten für Konten — Labels, Icons, Farben und die
 * menschenlesbare Sync-Statuszeile. Bewusst getrennt vom `account-service`
 * (Datenschicht): Services bleiben frei von UI-Konstanten, damit die
 * Präsentationsschicht unabhängig darauf zugreifen kann (auch in mehreren
 * Darstellungsmodi). IO-frei, framework-frei.
 */

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: "Girokonto",
  credit_card: "Kreditkarte",
  savings: "Tagesgeld/Sparkonto",
  wallet: "Wallet (PayPal, Revolut, etc.)",
  cash: "Bargeld",
  other: "Sonstiges",
};

export const ACCOUNT_TYPE_ICONS: Record<AccountType, string> = {
  checking: "🏦",
  credit_card: "💳",
  savings: "🐷",
  wallet: "📱",
  cash: "💵",
  other: "💰",
};

/* Ruhige Petrol-Abstufungen statt Regenbogen (#54) */
export const ACCOUNT_TYPE_COLORS: Record<AccountType, string> = {
  checking: "#1d5c54",
  credit_card: "#5c7a99",
  savings: "#4a9a8d",
  wallet: "#a8845c",
  cash: "#8a9a3c",
  other: "#7d8a87",
};

/**
 * Menschenlesbarer Sync-Status eines Kontos (deutsch). Bleibt bewusst als
 * fertiger String (kein i18n-Scope-Creep in diesem Schritt).
 */
export function formatSyncStatus(account: Account): string {
  if (!account.gocardless_account_id) return "Nicht verbunden";
  if (!account.sync_enabled) return "Synchronisation deaktiviert";
  if (!account.last_sync_at) return "Noch nie synchronisiert";

  const lastSync = new Date(account.last_sync_at);
  const now = new Date();
  const diffMs = now.getTime() - lastSync.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Gerade eben";
  if (diffMins < 60) return `Vor ${diffMins} Min.`;
  if (diffHours < 24) return `Vor ${diffHours} Std.`;
  if (diffDays < 7) return `Vor ${diffDays} Tagen`;
  return lastSync.toLocaleDateString("de-DE");
}
