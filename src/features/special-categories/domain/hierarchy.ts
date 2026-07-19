import type { SpecialCategory } from '@/types';
import type { SpecialCategoryNode } from './special-category-types';

/**
 * Reine Hierarchie-Operationen über Anlässen (Sonderkategorien). Kein I/O,
 * kein React. Robust gegen fehlerhafte Daten (verwaiste `parent_id`, bereits
 * persistierte Zyklen) – keine Endlosschleifen.
 */

function byId(cats: SpecialCategory[]): Map<string, SpecialCategory> {
  const map = new Map<string, SpecialCategory>();
  for (const cat of cats) map.set(cat.id, cat);
  return map;
}

/**
 * Liefert die IDs aller Vorfahren von `id` (Eltern, Großeltern, …), von unten
 * nach oben. Verwaiste/zyklische `parent_id`-Ketten werden defensiv abgebrochen.
 */
export function getAncestorIds(cats: SpecialCategory[], id: string): string[] {
  const map = byId(cats);
  const out: string[] = [];
  const seen = new Set<string>([id]);
  let current = map.get(id)?.parent_id ?? null;
  while (current && map.has(current) && !seen.has(current)) {
    out.push(current);
    seen.add(current);
    current = map.get(current)?.parent_id ?? null;
  }
  return out;
}

/**
 * Liefert die IDs aller Nachfahren von `id` (Kinder, Enkel, …). Reihenfolge:
 * Breitensuche. Zyklen werden über ein Besucht-Set abgefangen.
 */
export function getDescendantIds(cats: SpecialCategory[], id: string): string[] {
  const childrenOf = new Map<string, string[]>();
  for (const cat of cats) {
    const parent = cat.parent_id ?? null;
    if (!parent) continue;
    const list = childrenOf.get(parent) ?? [];
    list.push(cat.id);
    childrenOf.set(parent, list);
  }
  const out: string[] = [];
  const seen = new Set<string>([id]);
  const queue = [...(childrenOf.get(id) ?? [])];
  while (queue.length > 0) {
    const next = queue.shift()!;
    if (seen.has(next)) continue;
    seen.add(next);
    out.push(next);
    queue.push(...(childrenOf.get(next) ?? []));
  }
  return out;
}

/** IDs des Teilbaums (`id` selbst plus alle Nachfahren). */
export function getSubtreeIds(cats: SpecialCategory[], id: string): string[] {
  return [id, ...getDescendantIds(cats, id)];
}

/**
 * Prüft, ob es einen Zyklus erzeugen würde, `cat[id].parent_id` auf
 * `newParentId` zu setzen. Selbst-Elternschaft und das Unterordnen unter einen
 * eigenen Nachfahren sind verboten. `null` (oberste Ebene) ist immer erlaubt.
 */
export function wouldCreateCycle(
  cats: SpecialCategory[],
  id: string,
  newParentId: string | null | undefined,
): boolean {
  if (!newParentId) return false;
  if (newParentId === id) return true;
  return getDescendantIds(cats, id).includes(newParentId);
}

/**
 * Baut aus der flachen Liste einen Wald von {@link SpecialCategoryNode}.
 * Anlässe mit verwaister `parent_id` (Ziel existiert nicht) werden defensiv als
 * Wurzeln behandelt. In einem persistierten Zyklus gefangene Knoten werden
 * ebenfalls auf die oberste Ebene gehoben, statt verloren zu gehen. Geschwister
 * werden stabil nach `name` (dann `id`) sortiert.
 */
export function buildSpecialCategoryTree(cats: SpecialCategory[]): SpecialCategoryNode[] {
  const map = byId(cats);
  const nodes = new Map<string, SpecialCategoryNode>();
  for (const cat of cats) nodes.set(cat.id, { ...cat, children: [], depth: 0 });

  const roots: SpecialCategoryNode[] = [];
  for (const cat of cats) {
    const node = nodes.get(cat.id)!;
    const parentId = cat.parent_id ?? null;
    // Als Wurzel behandeln, wenn kein Parent, Parent unbekannt (verwaist) oder
    // der Parent in Wahrheit ein Nachfahre ist (persistierter Zyklus).
    const parentIsAncestorLoop = parentId ? getDescendantIds(cats, cat.id).includes(parentId) : false;
    if (!parentId || !map.has(parentId) || parentIsAncestorLoop) {
      roots.push(node);
    } else {
      nodes.get(parentId)!.children.push(node);
    }
  }

  const sortNodes = (list: SpecialCategoryNode[]) =>
    list.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));

  const assignDepth = (list: SpecialCategoryNode[], depth: number) => {
    sortNodes(list);
    for (const node of list) {
      node.depth = depth;
      assignDepth(node.children, depth + 1);
    }
  };
  assignDepth(roots, 0);
  return roots;
}
