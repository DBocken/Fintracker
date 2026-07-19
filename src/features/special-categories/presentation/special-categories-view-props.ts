import type { SpecialCategoriesOverviewViewModel } from '../application/special-categories-view-model';

/** Gemeinsame Props für Desktop- und Mobile-Sicht (identisches ViewModel). */
export interface SpecialCategoriesViewProps {
  model: SpecialCategoriesOverviewViewModel;
  className?: string;
  /** Öffnet den „Neuer Anlass"-Dialog (Interaktionszustand lebt in der Page). */
  onCreate?: () => void;
  /** Löscht einen Anlass (Bestätigung liegt in der Page). */
  onDelete?: (id: string) => void;
}
