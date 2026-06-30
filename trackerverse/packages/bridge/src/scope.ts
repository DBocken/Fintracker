import type { ParsedScope, Scope } from './types';

const SEGMENT = /^[a-z][a-z0-9-]*$/;

/**
 * Parst einen Scope-String strikt. Gibt null zurück, wenn er nicht exakt der
 * Form "<app>:<resource>:read" entspricht. Keine Wildcards, kein Whitespace,
 * nur Kleinbuchstaben — alles andere ist Default-deny.
 */
export function parseScope(scope: unknown): ParsedScope | null {
  if (typeof scope !== 'string') return null;
  const parts = scope.split(':');
  if (parts.length !== 3) return null;
  const [providerApp, resource, action] = parts;
  if (!SEGMENT.test(providerApp)) return null;
  if (!SEGMENT.test(resource)) return null;
  // Bewusst eng: in v1 ist ausschließlich "read" erlaubt.
  if (action !== 'read') return null;
  return { providerApp, resource, action };
}

export function scopeKey(scope: ParsedScope): Scope {
  return `${scope.providerApp}:${scope.resource}:${scope.action}`;
}
