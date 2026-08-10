/**
 * Bündelt Werte, Setter und Zubehördaten für `TransactionFilters` in EINEM
 * Objekt (WP 5.4, KOMP-2). Vorher nahm die Komponente 25 flache Props
 * entgegen, und die identische Verdrahtung stand wortgleich zweimal
 * (`Dashboard.tsx`, `TransactionsListPane.tsx`) — die frühere Desktop/
 * Mobile-Duplikation war damit nur eine Ebene tiefer gewandert. Beide
 * Aufrufer bauen jetzt EIN `FilterViewModel` und reichen es durch; ein
 * vertauschtes Feld (`contract`-Wert an `essential`-Setter) ist damit ein
 * Compile-Fehler statt eines stillen Laufzeit-Bugs, weil beide Literal-Union-
 * Typen sich nicht überschneiden.
 *
 * Eigene Datei statt Erweiterung von `dashboard-filters.ts`: Letztere wird
 * von `period-options.ts` importiert (`DashboardRange`); ein `FilterViewModel`
 * dort hätte `PeriodOption` gebraucht und einen Typ-Zirkel zwischen beiden
 * Dateien erzeugt. Diese Datei hängt von beiden ab, keine der beiden von ihr.
 *
 * Liegt in `features/shared/domain`, weil fachlicher Zustand, den ≥ 2 Slices
 * lesen (Dashboard-Vorschau UND `/transactions`), laut AGENTS.md §3 („Wohin
 * ein Typ gehört") dorthin gehört — nicht in eine einzelne Slice-`domain/`.
 *
 * Enthält bewusst auch die Setter, nicht nur die Werte: `TransactionFilters`
 * ist eine kontrollierte Komponente, der Zustand bleibt beim jeweiligen
 * ViewModel (`useFinanceOverview`/`useTransactionsOverview`) — dieses Objekt
 * ist nur die Lese-/Schreib-Fassade dorthin, keine dritte Zustandsquelle.
 */
import type { Account, Category } from '@/types';
import type {
  AusgabenklasseFilter,
  ContractFilter,
  DashboardGranularity,
  DashboardRange,
  EssentialFilter,
} from './dashboard-filters';
import type { PeriodOption } from './period-options';

export interface FilterViewModel {
  values: {
    category: string;
    account: string;
    contract: ContractFilter;
    essential: EssentialFilter;
    ausgabenklasse: AusgabenklasseFilter;
    search: string;
    range: DashboardRange;
    customDays: number;
    customGranularity: DashboardGranularity;
    /** Konkrete Periode für Jahr/Quartal/Monat (z. B. `2026-Q2`); sonst `''`. */
    customPeriod: string;
  };
  set: {
    category(v: string): void;
    account(v: string): void;
    contract(v: ContractFilter): void;
    essential(v: EssentialFilter): void;
    ausgabenklasse(v: AusgabenklasseFilter): void;
    search(v: string): void;
    range(v: DashboardRange): void;
    customDays(v: number): void;
    customGranularity(v: DashboardGranularity): void;
    customPeriod(v: string): void;
  };
  /** Nur bei Perioden-Ranges (Jahr/Quartal/Monat) befüllt, sonst leer. */
  periodOptions: PeriodOption[];
  categories: Category[];
  accounts: Account[];
}
