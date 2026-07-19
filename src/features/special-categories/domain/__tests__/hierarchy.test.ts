import { describe, it, expect } from 'vitest';
import type { SpecialCategory } from '@/types';
import {
  buildSpecialCategoryTree,
  getAncestorIds,
  getDescendantIds,
  getSubtreeIds,
  wouldCreateCycle,
} from '../hierarchy';

function cat(id: string, name: string, parent_id: string | null = null): SpecialCategory {
  return { id, name, parent_id };
}

describe('Anlass-Hierarchie', () => {
  const cats: SpecialCategory[] = [
    cat('hochzeit', 'Hochzeit'),
    cat('flitter', 'Flitterwochen', 'hochzeit'),
    cat('feier', 'Feier', 'hochzeit'),
    cat('ausflug', 'Ausflug Kreta', 'flitter'),
    cat('umzug', 'Umzug'),
  ];

  it('sollte aus der flachen Liste einen Baum mit Kind-Anlässen bauen (S1)', () => {
    const tree = buildSpecialCategoryTree(cats);
    const roots = tree.map((n) => n.id);
    expect(roots).toEqual(['hochzeit', 'umzug']);
    const hochzeit = tree.find((n) => n.id === 'hochzeit')!;
    // Geschwister alphabetisch: Feier vor Flitterwochen.
    expect(hochzeit.children.map((c) => c.id)).toEqual(['feier', 'flitter']);
    expect(hochzeit.depth).toBe(0);
    const flitter = hochzeit.children.find((c) => c.id === 'flitter')!;
    expect(flitter.depth).toBe(1);
    expect(flitter.children.map((c) => c.id)).toEqual(['ausflug']);
    expect(flitter.children[0].depth).toBe(2);
  });

  it('sollte Vorfahren von unten nach oben liefern', () => {
    expect(getAncestorIds(cats, 'ausflug')).toEqual(['flitter', 'hochzeit']);
    expect(getAncestorIds(cats, 'hochzeit')).toEqual([]);
  });

  it('sollte alle Nachfahren liefern', () => {
    expect(getDescendantIds(cats, 'hochzeit').sort()).toEqual(['ausflug', 'feier', 'flitter']);
    expect(getSubtreeIds(cats, 'flitter').sort()).toEqual(['ausflug', 'flitter']);
  });

  describe('Zyklen-Guard (I1)', () => {
    it('sollte Selbst-Elternschaft ablehnen', () => {
      expect(wouldCreateCycle(cats, 'hochzeit', 'hochzeit')).toBe(true);
    });

    it('sollte das Unterordnen unter einen eigenen Nachfahren ablehnen', () => {
      expect(wouldCreateCycle(cats, 'hochzeit', 'ausflug')).toBe(true);
    });

    it('sollte gültiges Reparenting erlauben', () => {
      expect(wouldCreateCycle(cats, 'feier', 'umzug')).toBe(false);
      expect(wouldCreateCycle(cats, 'feier', null)).toBe(false);
    });
  });

  describe('Robustheit gegen fehlerhafte Daten', () => {
    it('sollte verwaiste parent_id als Wurzel behandeln', () => {
      const orphan = [cat('a', 'A', 'gibtsnicht')];
      const tree = buildSpecialCategoryTree(orphan);
      expect(tree.map((n) => n.id)).toEqual(['a']);
      expect(tree[0].depth).toBe(0);
    });

    it('sollte bei einem persistierten Zyklus nicht endlos laufen', () => {
      const cyclic = [cat('x', 'X', 'y'), cat('y', 'Y', 'x')];
      // Kein Stack Overflow, beide Knoten bleiben erreichbar.
      const tree = buildSpecialCategoryTree(cyclic);
      const ids = new Set<string>();
      const walk = (ns: typeof tree) => ns.forEach((n) => (ids.add(n.id), walk(n.children)));
      walk(tree);
      expect(ids).toEqual(new Set(['x', 'y']));
      expect(getAncestorIds(cyclic, 'x').length).toBeLessThanOrEqual(1);
    });
  });
});
