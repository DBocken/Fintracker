import { t } from '@/i18n/serviceT';
import { ERROR_CODES } from '@/lib/constants';

/**
 * Erkennt eine Quota-Erschöpfung (RES-6). Modernе Browser werfen eine
 * `DOMException` mit `name === 'QuotaExceededError'`; ältere/abweichende
 * Implementierungen (u. a. Safari) setzen stattdessen nur den Legacy-Code 22
 * (`QUOTA_EXCEEDED_ERR`). Bewusst duck-typed statt `instanceof DOMException`,
 * damit auch nicht-standardkonforme Fehlerobjekte erkannt werden.
 */
export function isQuotaExceededError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { name?: unknown; code?: unknown };
  return candidate.name === 'QuotaExceededError' || candidate.code === 22;
}

/**
 * Der typisierte Ersatz für die rohe `DOMException`, die ein voller
 * IndexedDB-Speicher bisher ungefiltert bis zur Oberfläche durchreichte
 * (RES-6). `ERROR_CODES.STORAGE_QUOTA_EXCEEDED` war bis hierher toter Code —
 * diese Klasse ist seine erste Verwendung. Die Meldung nennt eine
 * Handlungsoption (Backup exportieren / Daten aufräumen), nicht nur das
 * Problem.
 */
export class StorageQuotaExceededError extends Error {
  readonly code = ERROR_CODES.STORAGE_QUOTA_EXCEEDED;
  override name = 'StorageQuotaExceededError';

  constructor(cause?: unknown) {
    super(
      t(
        'storage.quotaExceeded',
        'Der Speicher ist voll und konnte nicht geschrieben werden. Exportiere ein Backup oder räume Daten auf, bevor du weiterarbeitest.',
      ),
    );
    if (cause !== undefined) {
      // `cause` ist erst ab ES2022 Teil des `Error`-Konstruktors selbst;
      // hier über eine explizite Zuweisung gesetzt, damit die
      // TypeScript-Zielkonfiguration keine Rolle spielt.
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}
