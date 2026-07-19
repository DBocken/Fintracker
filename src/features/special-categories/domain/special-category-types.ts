import type { SpecialCategory } from '@/types';

/**
 * Ein Anlass als Baumknoten. `children` sind die direkten Kind-Anlässe,
 * `depth` ist die 0-basierte Tiefe (Wurzeln = 0). Rein abgeleitet aus der
 * flachen {@link SpecialCategory}-Liste – nie persistiert.
 */
export interface SpecialCategoryNode extends SpecialCategory {
  children: SpecialCategoryNode[];
  depth: number;
}

/**
 * Aggregierte Kosten eines Anlasses in Integer-Cent. `ownMinor` sind die direkt
 * zugeordneten Kosten, `subtreeMinor` schließt alle Kind-Anlässe ein. Kosten
 * sind vorzeichenbehaftet als „Geld raus": Ausgaben erhöhen, Erstattungen
 * (zugeordnete Gutschriften) mindern den Wert (kann negativ werden).
 */
export interface SpecialCategoryTotal {
  specialCategoryId: string;
  ownMinor: number;
  subtreeMinor: number;
  /** Anzahl verschiedener direkt zugeordneter Buchungen. */
  transactionCount: number;
}
