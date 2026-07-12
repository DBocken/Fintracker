/**
 * Navigations-ViewModel der Finanzstadt (WP-C2, `src/features/finance-city/README.md`
 * §"Die 3 Ebenen" + Kamera-Regeln 1–7). UI-neutrale Zustandsmaschine für den
 * Ebenenwechsel Stadt → Distrikt → Unterkategorie/Gebäude — VERBOTEN: three.js,
 * TanStack Query, react-router (Architektur-Tabelle im README, `application/`-Zeile).
 *
 * `CityLevel` gehört fachlich nach `domain/city-layout.ts` (WP-C1, läuft
 * parallel zu diesem Work Package). Zum Zeitpunkt dieses Auftrags existierte
 * die Datei noch nicht (geprüft), daher lokale Definition hier.
 * TODO(WP-C1): sobald `domain/city-layout.ts` den `CityLevel`-Typ exportiert,
 * diese lokale Definition entfernen und von dort importieren:
 * `import type { CityLevel } from '../domain/city-layout';`
 */
export type CityLevel = 'city' | 'district' | 'subcategory';

/** Ein einzelnes Gebäude innerhalb einer Unterkategorie (z. B. ein Streaming-Abo). Kein eigenes Navigations-Level — nur Sheet-Ziel via `tapContract`. */
export interface CityContractModel {
  id: string;
  /** Bereits aufgelöstes Label (Demo-Fixture-Inhalt bzw. Domain-Daten, kein i18n-Key — siehe `data/city-demo-data.ts`). */
  label: string;
}

/** Eine Unterkategorie (Ebene 3, "Gebäude-Ebene" im README) innerhalb eines Distrikts. */
export interface CitySubcategoryModel {
  id: string;
  label: string;
  /** Optionale verschachtelte Verträge (z. B. "Streaming" bündelt Netflix/Spotify/…). */
  contracts?: CityContractModel[];
}

/** Ein Distrikt (Ebene 2) mit seinen Unterkategorien. */
export interface CityDistrictModel {
  id: string;
  label: string;
  subcategories: CitySubcategoryModel[];
}

/** Wurzel-Datenstruktur, die der Navigations-Hook konsumiert — Projektion aus `data/city-demo-data.ts` bzw. später der echten Aggregation (README "Folgeschritte"). */
export interface CityModel {
  districts: CityDistrictModel[];
}

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
