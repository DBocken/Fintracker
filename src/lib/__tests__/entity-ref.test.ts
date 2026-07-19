import { describe, it, expect } from 'vitest';
import {
  resolveEntityRef,
  makeEntityRef,
  isEntityKind,
  type EntityRef,
  type EntityResolverRegistry,
} from '../entity-ref';

describe('EntityRef-Auflösung', () => {
  const registry: EntityResolverRegistry = {
    transaction: (id) => (id === 'tx-1' ? { id: 'tx-1', label: 'Miete' } : undefined),
  };

  it('sollte ein vorhandenes Ziel über den passenden Resolver auflösen', () => {
    const result = resolveEntityRef(makeEntityRef('transaction', 'tx-1'), registry);
    expect(result.status).toBe('resolved');
    if (result.status === 'resolved') {
      expect(result.value).toEqual({ id: 'tx-1', label: 'Miete' });
    }
  });

  it('sollte bei gelöschtem Ziel „nicht mehr vorhanden" liefern statt zu werfen', () => {
    const result = resolveEntityRef(makeEntityRef('transaction', 'tx-geloescht'), registry);
    expect(result.status).toBe('missing');
  });

  it('sollte bei fehlendem Resolver definiert auf „nicht vorhanden" fallen', () => {
    const result = resolveEntityRef(makeEntityRef('replacement_plan', 'rp-1'), registry);
    expect(result.status).toBe('missing');
  });

  it('sollte bei leerer id nicht auflösen', () => {
    const result = resolveEntityRef(makeEntityRef('transaction', ''), registry);
    expect(result.status).toBe('missing');
  });

  it('sollte bei unbekanntem kind definiert auf „nicht vorhanden" fallen statt zu werfen', () => {
    const badRef = { kind: 'auto', id: 'x' } as unknown as EntityRef;
    const result = resolveEntityRef(badRef, registry);
    expect(result.status).toBe('missing');
  });

  it('sollte einen werfenden Resolver abfangen und als „nicht vorhanden" behandeln', () => {
    const throwing: EntityResolverRegistry = {
      transaction: () => {
        throw new Error('Datenbank nicht erreichbar');
      },
    };
    const result = resolveEntityRef(makeEntityRef('transaction', 'tx-1'), throwing);
    expect(result.status).toBe('missing');
  });

  it('sollte NIE Zieldaten in die Referenz kopieren (Referenz hält nur kind + id)', () => {
    const ref = makeEntityRef('transaction', 'tx-1');
    expect(Object.keys(ref).sort()).toEqual(['id', 'kind']);
  });

  it('sollte gültige und ungültige EntityKind-Werte erkennen', () => {
    expect(isEntityKind('transaction')).toBe(true);
    expect(isEntityKind('contract_record')).toBe(true);
    expect(isEntityKind('replacement_plan')).toBe(true);
    expect(isEntityKind('nope')).toBe(false);
    expect(isEntityKind(42)).toBe(false);
    expect(isEntityKind(null)).toBe(false);
  });
});
