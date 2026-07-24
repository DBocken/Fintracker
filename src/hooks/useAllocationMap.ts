import { useQuery } from '@tanstack/react-query';
import { getAllocationMap } from '@/services/transaction-allocation-service';
import { financeKeys } from '@/features/shared/data/finance-query-keys';
import type { TransactionAllocation } from '@/types';

/**
 * Stabile Leer-Referenz: eine neue `Map()` pro Render würde jede darauf
 * aufbauende Memo-Kette (Charts, Stadt-Modell) unnötig invalidieren.
 */
const EMPTY_ALLOCATIONS = new Map<string, TransactionAllocation[]>();

/**
 * Aufteilungen aller Buchungen als Map `transaction_id → Aufteilungen`.
 *
 * Einziger React-Einstieg für Split-Buchungen: Wer Beträge nach Kategorien
 * auswertet (Sunburst, Sankey, Finanzstadt, Kennzahlen), reicht diese Map an
 * die Aggregation weiter, damit ein Anteil in SEINER Kategorie zählt — eine
 * auf „Lebensmittel" gebuchte Aldi-Zahlung mit Kleidungs-Anteil taucht dann
 * anteilig unter Kleidung auf statt vollständig unter Lebensmitteln
 * (`getCategoryContributions`, `@/lib/analysis-data`).
 *
 * Geteilter Query-Key (`financeKeys.allocationMap`) — alle Aufrufer nutzen
 * denselben Cache, das Split-Panel invalidiert ihn über die Wurzel
 * `['allocations']`.
 */
export function useAllocationMap(): Map<string, TransactionAllocation[]> {
  const { data = EMPTY_ALLOCATIONS } = useQuery({
    queryKey: financeKeys.allocationMap,
    queryFn: getAllocationMap,
  });
  return data;
}
