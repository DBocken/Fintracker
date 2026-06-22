import type { Account } from "@/types";

/**
 * Datenqualitäts-Service pro Konto.
 *
 * Leitidee aus den Reviews: Wenn Nutzer den Zahlen nicht trauen, sind Dashboards,
 * Forecasts und Automatik wertlos. Dieser Service leitet aus den bereits
 * vorhandenen Konto-Rohdaten (Sync-Status, letzter Sync, manuelles vs. Live-Konto)
 * einen verständlichen Qualitätsstatus ab.
 *
 * Bewusst eine reine Funktion: keine Netzwerkcalls, keine React-Abhängigkeit,
 * isoliert testbar.
 */

export type AccountDataQualityStatus =
  | "good"
  | "warning"
  | "critical"
  | "manual"
  | "unknown";

export interface AccountDataQualityIssue {
  code:
    | "manual_account"
    | "sync_disabled"
    | "never_synced"
    | "sync_stale"
    | "consent_expired"
    | "missing_live_connection"
    | "missing_opening_balance"
    | "unknown";
  severity: "info" | "warning" | "critical";
  message: string;
  ctaLabel?: string;
  ctaTo?: string;
}

export interface AccountDataQuality {
  accountId: string;
  status: AccountDataQualityStatus;
  score: number;
  label: string;
  description: string;
  lastSyncAt?: string | null;
  issues: AccountDataQualityIssue[];
}

const STALE_WARNING_DAYS = 7;
const STALE_CRITICAL_DAYS = 30;

const STATUS_LABELS: Record<AccountDataQualityStatus, string> = {
  good: "Sehr gut",
  warning: "Eingeschränkt",
  critical: "Kritisch",
  manual: "Manuell",
  unknown: "Unbekannt",
};

/** Volle Tage zwischen zwei Zeitpunkten (>= 0, nie negativ). */
function daysSince(iso: string, now: Date): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return Number.POSITIVE_INFINITY;
  const diffMs = now.getTime() - then;
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Leitet den Datenqualitätsstatus für ein Konto ab.
 *
 * Grundsatz: Manuelle Konten sind nicht „schlechter“, sie hängen nur von den
 * Eingaben der Nutzer ab – der Text bleibt deshalb freundlich.
 */
export function deriveAccountDataQuality(
  account: Account,
  now: Date = new Date()
): AccountDataQuality {
  const issues: AccountDataQualityIssue[] = [];
  const isLiveAccount = !!account.gocardless_account_id;
  const lastSyncAt = account.last_sync_at ?? null;

  // Manuell gepflegtes Konto (keine Bankanbindung)
  if (!isLiveAccount) {
    issues.push({
      code: "manual_account",
      severity: "info",
      message: "Manuell gepflegt – Prognose hängt von deinen Eingaben ab.",
    });

    if (account.opening_balance == null) {
      issues.push({
        code: "missing_opening_balance",
        severity: "info",
        message:
          "Kein Startsaldo hinterlegt – Saldo basiert nur auf erfassten Transaktionen.",
        ctaLabel: "Startsaldo ergänzen",
      });
    }

    return {
      accountId: account.id,
      status: "manual",
      score: 65,
      label: STATUS_LABELS.manual,
      description:
        "Manuell gepflegtes Konto. Die Datenqualität hängt von deinen Eingaben ab.",
      lastSyncAt,
      issues,
    };
  }

  // Ab hier: Live-Konto mit Bankanbindung.

  // Sync deaktiviert
  if (account.sync_enabled === false) {
    issues.push({
      code: "sync_disabled",
      severity: "warning",
      message:
        "Automatische Synchronisierung ist deaktiviert – neue Buchungen fehlen evtl.",
      ctaLabel: "Synchronisierung aktivieren",
    });
    return {
      accountId: account.id,
      status: "warning",
      score: 50,
      label: STATUS_LABELS.warning,
      description:
        "Die automatische Synchronisierung ist deaktiviert. Die Daten können veraltet sein.",
      lastSyncAt,
      issues,
    };
  }

  // Nie synchronisiert
  if (!lastSyncAt) {
    issues.push({
      code: "never_synced",
      severity: "critical",
      message: "Konto wurde noch nie synchronisiert.",
      ctaLabel: "Jetzt synchronisieren",
    });
    return {
      accountId: account.id,
      status: "critical",
      score: 20,
      label: STATUS_LABELS.critical,
      description:
        "Dieses Konto wurde noch nie synchronisiert. Es liegen keine aktuellen Daten vor.",
      lastSyncAt,
      issues,
    };
  }

  const ageDays = daysSince(lastSyncAt, now);

  // Sync älter als 30 Tage
  if (ageDays > STALE_CRITICAL_DAYS) {
    issues.push({
      code: "sync_stale",
      severity: "critical",
      message: `Letzter Sync vor ${ageDays} Tagen – Prognose kann unvollständig sein.`,
      ctaLabel: "Jetzt synchronisieren",
    });
    return {
      accountId: account.id,
      status: "critical",
      score: 30,
      label: STATUS_LABELS.critical,
      description: `Der letzte erfolgreiche Sync war vor ${ageDays} Tagen. Die Daten sind veraltet.`,
      lastSyncAt,
      issues,
    };
  }

  // Sync älter als 7 Tage
  if (ageDays > STALE_WARNING_DAYS) {
    issues.push({
      code: "sync_stale",
      severity: "warning",
      message: `Letzter Sync vor ${ageDays} Tagen – Prognose kann unvollständig sein.`,
      ctaLabel: "Jetzt synchronisieren",
    });
    return {
      accountId: account.id,
      status: "warning",
      score: 60,
      label: STATUS_LABELS.warning,
      description: `Der letzte Sync war vor ${ageDays} Tagen. Neuere Buchungen könnten fehlen.`,
      lastSyncAt,
      issues,
    };
  }

  // Frisch synchronisiert
  return {
    accountId: account.id,
    status: "good",
    score: 95,
    label: STATUS_LABELS.good,
    description: "Konto ist aktuell synchronisiert.",
    lastSyncAt,
    issues,
  };
}
