import type {
  SpecialCategory,
  SpecialCategoryAssignment,
  Transaction,
} from '@/types';
import { buildSpecialCategoryTree } from '../domain/hierarchy';
import { computeEventTotals } from '../domain/event-totals';
import type {
  SpecialCategoryNode,
  SpecialCategoryTotal,
} from '../domain/special-category-types';

/** Baumknoten samt aggregierter Kosten – die Sicht-freundliche Anreicherung. */
export interface SpecialCategoryTreeNode extends SpecialCategoryNode {
  total: SpecialCategoryTotal;
  children: SpecialCategoryTreeNode[];
}

/** Rein abgeleitete Daten der Anlass-Übersicht (kein React, kein I/O). */
export interface SpecialCategoriesData {
  /** Wald der obersten Anlässe, jeder Knoten mit Summen angereichert. */
  tree: SpecialCategoryTreeNode[];
  /** Tiefen-first abgeflachte Liste (für Listen/Sheets). */
  flat: SpecialCategoryTreeNode[];
  byId: Map<string, SpecialCategoryTreeNode>;
  totalsById: Map<string, SpecialCategoryTotal>;
  /** Zuordnungen je Anlass-ID (nur direkt zugeordnete). */
  assignmentsByEvent: Map<string, SpecialCategoryAssignment[]>;
}

function attachTotals(
  nodes: SpecialCategoryNode[],
  totals: Map<string, SpecialCategoryTotal>,
): SpecialCategoryTreeNode[] {
  return nodes.map((node) => ({
    ...node,
    total: totals.get(node.id) ?? {
      specialCategoryId: node.id,
      ownMinor: 0,
      subtreeMinor: 0,
      transactionCount: 0,
    },
    children: attachTotals(node.children, totals),
  }));
}

function flattenDepthFirst(nodes: SpecialCategoryTreeNode[]): SpecialCategoryTreeNode[] {
  const out: SpecialCategoryTreeNode[] = [];
  for (const node of nodes) {
    out.push(node);
    out.push(...flattenDepthFirst(node.children));
  }
  return out;
}

/**
 * Baut aus den geladenen Anlässen, Zuordnungen und Buchungen die abgeleiteten
 * Sicht-Daten (Baum + Summen + Zuordnungs-Index). Pur und ohne Seiteneffekte,
 * damit desktop- wie mobil dasselbe ViewModel konsumieren.
 */
export function buildSpecialCategoriesData(
  cats: SpecialCategory[],
  assignments: SpecialCategoryAssignment[],
  transactions: Transaction[],
): SpecialCategoriesData {
  const totalsById = computeEventTotals(cats, assignments, transactions);
  const tree = attachTotals(buildSpecialCategoryTree(cats), totalsById);
  const flat = flattenDepthFirst(tree);

  const byId = new Map<string, SpecialCategoryTreeNode>();
  for (const node of flat) byId.set(node.id, node);

  const assignmentsByEvent = new Map<string, SpecialCategoryAssignment[]>();
  for (const cat of cats) assignmentsByEvent.set(cat.id, []);
  for (const assignment of assignments) {
    const list = assignmentsByEvent.get(assignment.special_category_id);
    if (list) list.push(assignment);
  }

  return { tree, flat, byId, totalsById, assignmentsByEvent };
}

/** UI-neutrales ViewModel der Anlass-Übersicht. */
export interface SpecialCategoriesOverviewViewModel extends SpecialCategoriesData {
  loading: boolean;
  isEmpty: boolean;
  /** Zeitfenster-Vorschläge für einen Anlass (leer, wenn kein Startdatum). */
  suggestionsFor: (eventId: string) => Transaction[];
  actions: {
    save: (input: Partial<SpecialCategory>) => Promise<SpecialCategory>;
    remove: (id: string, options?: { deleteChildren?: boolean }) => Promise<void>;
    assign: (input: {
      specialCategoryId: string;
      transactionId: string;
      amountMinor?: number | null;
      allocationId?: string | null;
      note?: string | null;
    }) => Promise<void>;
    unassign: (assignmentId: string) => Promise<void>;
    saving: boolean;
  };
}
