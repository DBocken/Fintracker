/**
 * Navigations-ViewModel der Finanzstadt (WP-C2, `src/features/finance-city/README.md`
 * §"Die 3 Ebenen" + Kamera-Regeln 1–7). UI-neutrale Zustandsmaschine für den
 * Ebenenwechsel Stadt → Distrikt → Unterkategorie/Gebäude — VERBOTEN: three.js,
 * TanStack Query, react-router (Architektur-Tabelle im README, `application/`-Zeile).
 *
 * Typen kommen kanonisch aus der Domain (`domain/city-model.ts` /
 * `domain/city-layout.ts`) — hier nur Aliase, damit application/ eine stabile
 * eigene Oberfläche behält (Muster der übrigen Slices).
 */
import type { CityLevel } from '../domain/city-layout';
import type { CityContract, CityDistrict, CityModel, CitySubcategory } from '../domain/city-model';

export type { CityLevel, CityModel };
/** Ein einzelnes Gebäude innerhalb einer Unterkategorie (z. B. ein Streaming-Abo). Kein eigenes Navigations-Level — nur Sheet-Ziel via `tapContract`. */
export type CityContractModel = CityContract;
/** Eine Unterkategorie (Ebene 3, "Gebäude-Ebene" im README) innerhalb eines Distrikts. */
export type CitySubcategoryModel = CitySubcategory;
/** Ein Distrikt (Ebene 2) mit seinen Unterkategorien. */
export type CityDistrictModel = CityDistrict;

export type CityBreadcrumbEntry = { level: CityLevel; id: string | null; label: string };

export type CityCameraIntentKind = 'fit-city' | 'focus-district' | 'enter-district' | 'enter-subcategory' | 'reset';

export type CityCameraIntent = { seq: number; kind: CityCameraIntentKind; targetId: string | null };

export type CityNavigationViewModel = {
  level: CityLevel;
  /** Ebene 1: getapptes Viertel (Fokus OHNE Eintauchen). */
  focusDistrictId: string | null;
  /** Ebene 2: betretenes Viertel. */
  activeDistrictId: string | null;
  /** Ebene 3. */
  activeSubcategoryId: string | null;
  /** BottomSheet-Auswahl (Ebene 3). */
  selectedContractId: string | null;
  /** [Stadt] | [Stadt, Freizeit] | [Stadt, Freizeit, Streaming]. */
  breadcrumb: CityBreadcrumbEntry[];
  /**
   * `seq` erhöht sich bei JEDEM neuen Intent — der Kamera-Controller (WP-C4)
   * reagiert auf `seq`-Änderungen; manuelle Orbit-Eingriffe konsumieren den
   * Intent NICHT (er bleibt letzter Wunsch, wird aber nur einmal geflogen).
   * Nur Fokuswechsel/Eintauchen/Zoom-Out-Stufen und Reset erhöhen `seq` — reine
   * Sheet-Interaktionen (`tapContract`/`closeContract`) und No-ops nicht.
   */
  cameraIntent: CityCameraIntent;
  actions: {
    /** Nicht fokussiert → Fokus (Ebene bleibt city, cameraIntent focus-district); bereits fokussiert → eintauchen (level district, intent enter-district). */
    tapDistrict(id: string): void;
    /** Nur in level district: → level subcategory + intent enter-subcategory. */
    tapSubcategory(id: string): void;
    /** Nur in level subcategory: selectedContractId setzen (Sheet öffnet in Presentation). */
    tapContract(id: string): void;
    closeContract(): void;
    /** Breadcrumb-Navigation (Stadt/Viertel/Unterkategorie anspringen). */
    goTo(level: CityLevel, id?: string): void;
    /** Vom Kamera-Controller gemeldet: Heraus-Zoomen über Schwelle → eine Ebene hoch (subcategory→district→city[Fokus lösen]) + passender Intent. */
    zoomOutStep(): void;
    /** Zurück zur Stadt, Fokus weg, intent reset. */
    reset(): void;
  };
};
