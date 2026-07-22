import { z } from 'zod';
import { t } from '@/i18n/serviceT';

/**
 * Gemeinsame zod-Grundlage für neue Datengrenzen (IndexedDB, Backup, Vault,
 * Import), gefordert von `docs/coding-guide.md` §6. Ein einziger Parse-Helfer
 * übersetzt zod-Fehler einheitlich in eine verständliche deutsche Meldung und
 * weist ungültige Eingaben VOLLSTÄNDIG ab — kein partielles Übernehmen, kein
 * stilles Speichern als Nullwert (Invariante 18, `docs/domain-invariants.md`).
 */

export interface BoundaryIssue {
  /** Punkt-Pfad des betroffenen Feldes (leer für die Wurzel). */
  path: string;
  message: string;
}

/**
 * Fehler an einer Datengrenze. Trägt die strukturierten `issues` (für Logs /
 * konsumierende UI) und eine deutsche `message` (für Anzeige).
 */
export class BoundaryValidationError extends Error {
  readonly resource: string;
  readonly issues: BoundaryIssue[];

  constructor(resource: string, error: z.ZodError) {
    super(
      t('schemaBoundary.rejected', 'Ungültige Daten an einer Datengrenze wurden abgewiesen.').replace(
        '{resource}',
        resource,
      ),
    );
    this.name = 'BoundaryValidationError';
    this.resource = resource;
    this.issues = error.issues.map((issue) => ({
      path: issue.path.map((segment) => String(segment)).join('.'),
      message: issue.message,
    }));
  }
}

/**
 * Parst `value` gegen `schema`. Gültige Eingaben werden typisiert zurückgegeben;
 * ungültige werfen `BoundaryValidationError` (nichts wird teilweise übernommen).
 */
export function parseAtBoundary<T>(schema: z.ZodType<T>, value: unknown, resource: string): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw new BoundaryValidationError(resource, result.error);
}

/** Nicht-werfende Variante: liefert ein Ergebnisobjekt statt einer Ausnahme. */
export function safeParseAtBoundary<T>(
  schema: z.ZodType<T>,
  value: unknown,
  resource: string,
): { ok: true; data: T } | { ok: false; error: BoundaryValidationError } {
  const result = schema.safeParse(value);
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, error: new BoundaryValidationError(resource, result.error) };
}
