/**
 * Reiner Kern der Einstellungs-Slice (WP 6.5b, ARCH-1).
 *
 * Kein React, kein I/O — nur die Formen, die das ViewModel nach oben reicht,
 * und die drei Auflösungen, die bis WP 6.5b als Ausdrücke mitten in
 * `EnhancedSettings.tsx` standen (`settings?.retention_months || 36`).
 */
import type {
  Category,
  CategorySuggestion,
  HierarchicalCategory,
  Transaction,
  UserSettings,
} from '@/types';

/**
 * Aufbewahrungsdauer, solange nichts gespeichert ist. Der Wert stammt
 * unverändert aus `EnhancedSettings.tsx`/`TimeRangeSettings`.
 */
export const DEFAULT_RETENTION_MONTHS = 36;

/**
 * Aufbewahrungsdauer in Monaten.
 *
 * Bewusst `||` und nicht `??`: `0` war nie eine wählbare Dauer, sondern der
 * Zustand vor der ersten Speicherung — Bestandsverhalten, das die Fläche seit
 * jeher zeigt. Ein `??` würde daraus „0 Monate Aufbewahrung" machen und damit
 * eine Aussage, die niemand getroffen hat.
 */
export function resolveRetentionMonths(settings: UserSettings | null | undefined): number {
  return settings?.retention_months || DEFAULT_RETENTION_MONTHS;
}

/** Automatische Bestätigung der Kategorie-Zuordnung; ohne Einstellungen aus. */
export function resolveAutoConfirmMapping(settings: UserSettings | null | undefined): boolean {
  return settings?.auto_confirm_mapping || false;
}

/**
 * Sucht eine Kategorie über ihre **stabile ID** im Hierarchiebaum.
 *
 * Nicht über den Anzeigenamen: Der ändert sich beim Umbenennen und ist je
 * Sprache ein anderer (AGENTS.md §6, letzte Zeile der Fallen-Tabelle). Der
 * Baum aus `getHierarchicalCategories` trägt Unterkategorien als `children`,
 * und die Auswahl in der Verwaltung kann jede Ebene treffen — deshalb rekursiv.
 *
 * Findet sie die ID nicht mehr (gelöscht), ist die Antwort `null` und nicht
 * ein veralteter Stand.
 */
export function findCategoryById(
  categories: HierarchicalCategory[],
  id: string | null,
): HierarchicalCategory | null {
  if (!id) return null;
  for (const category of categories) {
    if (category.id === id) return category;
    const treffer = findCategoryById(category.children ?? [], id);
    if (treffer) return treffer;
  }
  return null;
}

/** Lauf der Sammel-Neukategorisierung. */
export type BulkCategorizationStatus = 'idle' | 'processing' | 'completed';

/** Ergebnis eines abgeschlossenen Laufs. */
export interface BulkCategorizationResults {
  total: number;
  assigned: number;
  unassigned: number;
}

export interface BulkCategorizationState {
  status: BulkCategorizationStatus;
  results: BulkCategorizationResults | null;
  /** Ein Lauf ist unterwegs — die Fläche sperrt ihre Auslöser. */
  isRunning: boolean;
  /** Es liegen Vorwerte für ein echtes Undo bereit (F-UX-1). */
  canUndo: boolean;
}

/** Auswirkung der ausgewählten Kategorie auf den Bestand — vor dem Anwenden. */
export interface CategoryPreviewState {
  /** Über die ID aufgelöst; `null`, sobald die Kategorie fehlt oder keine gewählt ist. */
  category: HierarchicalCategory | null;
  transactions: Transaction[];
  isLoading: boolean;
}

/**
 * Was die Einstellungsfläche über ihre Daten weiss — und nur das. Keine Farben,
 * keine Kartengrössen, kein JSX (Kochrezept, `application/`).
 */
export interface SettingsOverviewModel {
  categories: HierarchicalCategory[];
  categoryCount: number;
  retentionMonths: number;
  autoConfirmMapping: boolean;
  categorySuggestion: CategorySuggestion | null;
  /**
   * EINE Aussage für die ganze Fläche: Ohne Kategorien zeigte sie „0
   * Kategorien" und eine leere Verwaltung — wer daraufhin neu anlegt, erzeugt
   * Duplikate zu Kategorien, die es längst gibt. Eine Einstellungsseite ohne
   * ihre Einstellungen ist ausserdem nicht bedienbar.
   */
  hasLoadError: boolean;
  retry: () => void;
  preview: CategoryPreviewState;
  bulk: BulkCategorizationState;
  selectCategory: (id: string | null) => void;
  loadPreview: () => Promise<void>;
  saveCategory: (category: Partial<Category> & { name: string }) => void;
  deleteCategory: (id: string) => void;
  setRetentionMonths: (months: number) => void;
  setAutoConfirmMapping: (enabled: boolean) => void;
  recategorize: () => void;
  undoRecategorization: () => void;
}
