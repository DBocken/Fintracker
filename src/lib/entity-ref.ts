/**
 * EntityRef — die kleinste tragfähige Konvention, um nutzereigene Entitäten
 * modulübergreifend zu verknüpfen, OHNE Daten zu kopieren
 * (Roadmap-Entscheidung AD7, siehe `docs/architecture/entity-references.md`).
 *
 * Kern-Eigenschaften:
 * - **Geschlossene Union `EntityKind`:** Der Compiler erzwingt die Behandlung
 *   jedes Kinds. Zukünftige Module (Car, Wealth, …) ergänzen genau einen Wert
 *   plus einen Resolver — keine Migration bestehender Daten.
 * - **Dangling-Toleranz:** Ein gelöschtes Ziel liefert `{ status: 'missing' }`,
 *   niemals eine Ausnahme und niemals eine veraltete Kopie.
 * - **Kein globaler Singleton-State:** Der Resolver erhält seine Registry als
 *   Argument (pure Funktion), passend zur Trackerverse-Modularität
 *   (`docs/coding-guide.md` §13).
 *
 * Typisierte FK-Felder bleiben die Regel, wo das Ziel statisch ist
 * (z. B. `SharedExpenseSplit.transaction_id`). `EntityRef` ist ausschließlich
 * für GENERISCHE Verweise auf wechselnde Ziel-Arten gedacht.
 */

/** Geschlossene Union — neue Module ergänzen hier genau einen Wert. */
export type EntityKind = 'transaction' | 'contract_record' | 'replacement_plan';

export interface EntityRef {
  kind: EntityKind;
  id: string;
}

/**
 * Stabile, nicht-lokalisierte Kennung je Kind. Das `Record<EntityKind, …>`
 * erzwingt zur Compile-Zeit Vollständigkeit: ein neues Kind ohne Eintrag ist
 * ein Typfehler (der „exhaustive"-Check der geschlossenen Union).
 */
export const ENTITY_KIND_KEYS: Record<EntityKind, string> = {
  transaction: 'transaction',
  contract_record: 'contract_record',
  replacement_plan: 'replacement_plan',
};

/** Laufzeit-Guard — verteidigt gegen fremde/ältere Daten mit unbekanntem Kind. */
export function isEntityKind(value: unknown): value is EntityKind {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(ENTITY_KIND_KEYS, value)
  );
}

export function makeEntityRef(kind: EntityKind, id: string): EntityRef {
  return { kind, id };
}

/** Auflösung eines Ziels: entweder vorhanden oder bewusst „nicht mehr vorhanden". */
export type ResolvedEntity<T = unknown> =
  | { status: 'resolved'; kind: EntityKind; id: string; value: T }
  | { status: 'missing'; kind: EntityKind; id: string };

/**
 * Ein Resolver bildet eine ID auf ihr Zielobjekt ab — oder `undefined`, wenn
 * das Ziel (nicht mehr) existiert. Er wird nie geworfen behandelt: `resolveEntityRef`
 * fängt Ausnahmen ab, damit ein defekter Resolver die Auflösung nicht zum
 * Absturz bringt.
 */
export type EntityResolver<T = unknown> = (id: string) => T | undefined;

export type EntityResolverRegistry = Partial<Record<EntityKind, EntityResolver>>;

/**
 * Löst eine `EntityRef` gegen eine explizit übergebene Registry auf.
 *
 * Dangling-tolerant: fehlt der Resolver, ist `kind` unbekannt, ist die `id`
 * leer oder liefert der Resolver `undefined`/`null`/wirft, ist das Ergebnis
 * `{ status: 'missing' }` — nie eine Ausnahme, nie eine veraltete Kopie.
 */
export function resolveEntityRef<T = unknown>(
  ref: EntityRef,
  registry: EntityResolverRegistry,
): ResolvedEntity<T> {
  const missing: ResolvedEntity<T> = { status: 'missing', kind: ref.kind, id: ref.id };

  if (!isEntityKind(ref.kind) || typeof ref.id !== 'string' || ref.id.length === 0) {
    return missing;
  }

  const resolver = registry[ref.kind] as EntityResolver<T> | undefined;
  if (!resolver) return missing;

  try {
    const value = resolver(ref.id);
    if (value === undefined || value === null) return missing;
    return { status: 'resolved', kind: ref.kind, id: ref.id, value };
  } catch {
    // Dangling ist ein erwarteter Zustand, kein Fehler — ein werfender
    // Resolver darf die Auflösung nicht abstürzen lassen.
    return missing;
  }
}
