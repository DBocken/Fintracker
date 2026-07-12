import { useCallback, useEffect, useMemo, useRef } from "react";
import { Building2, ChevronRight, List } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useI18n } from "@/i18n/useI18n";
import { formatCurrency } from "@/lib/utils";
import { cityDemoModel } from "@/features/finance-city/data/city-demo-data";
import type { CityModel } from "@/features/finance-city/domain/city-model";
import { buildCityLayout } from "@/features/finance-city/domain/city-layout";
import { fitCameraDistance, sphericalPose } from "@/features/finance-city/domain/camera-math";
import { useCityNavigation } from "@/features/finance-city/application/use-city-navigation";
import { CityCanvas } from "@/features/finance-city/presentation/CityCanvas";
import { CAMERA_FOV_Y_DEG, type CitySceneHandle } from "@/features/finance-city/presentation/city-scene";

/**
 * Kompakte Tab-Chrome der Stadt (WP-C0-Platzhalter): nur "Ausgaben" ist
 * aktuell erreichbar (dieses WP liefert nur den Ausgaben-Distrikt-Fixture,
 * `src/features/finance-city/data/city-demo-data.ts`). Einnahmen/Ziele/
 * Übersicht sind bewusst disabled statt versteckt, damit die finale
 * Navigationsstruktur (siehe README, "3 Ebenen") schon jetzt sichtbar ist.
 */
const CITY_TABS = [
  { value: "overview", labelKey: "city.tabOverview" },
  { value: "income", labelKey: "city.tabIncome" },
  { value: "expenses", labelKey: "city.tabExpenses" },
  { value: "goals", labelKey: "city.tabGoals" },
] as const;

const ACTIVE_CITY_TAB = "expenses";

// Kamera-Regel 1 (README, Auto-Frame): statische Startpose, solange WP-C4
// (Kamera-Controller mit gedämpften Flügen) noch nicht existiert. 45°-Azimut
// vermeidet einen Blick exakt entlang einer Distrikt-Grenze; 55° Polarwinkel
// liegt in der erlaubten Halbraum-Spanne (15°–80°, Kamera-Regel 2) und
// bleibt eine erkennbare "Vogelperspektive", ohne Gebäudehöhen unlesbar zu
// machen (reine Top-Down-Sicht wäre 0°).
const CITY_DEFAULT_AZIMUTH_RAD = Math.PI / 4;
const CITY_DEFAULT_POLAR_RAD = (55 * Math.PI) / 180;
const FALLBACK_ASPECT = 16 / 9;

/** Löst die für das BottomSheet nötigen Objekte aus den (bereits vom Tap validierten) IDs auf. */
function findSelectedContract(model: CityModel, districtId: string | null, subcategoryId: string | null, contractId: string | null) {
  if (!districtId || !subcategoryId || !contractId) return null;
  const district = model.districts.find((d) => d.id === districtId);
  const subcategory = district?.subcategories.find((s) => s.id === subcategoryId);
  const contract = subcategory?.contracts?.find((c) => c.id === contractId);
  if (!district || !subcategory || !contract) return null;
  return { district, subcategory, contract };
}

export default function CityPage() {
  const { t } = useI18n();
  const sceneRef = useRef<CitySceneHandle | null>(null);
  const initialCameraPoseAppliedRef = useRef(false);

  const nav = useCityNavigation(cityDemoModel, { city: t("city.breadcrumbCity") });

  // buildCityLayout ist die EINZIGE Geometrie-Quelle (README) — `presentation/`
  // trifft keine eigenen Layout-Entscheidungen. `focusDistrictId` bedeutet je
  // nach Ebene etwas anderes: auf city-Ebene der (noch nicht betretene)
  // Fokus-Tap, ab district-Ebene der bereits betretene Distrikt.
  const layout = useMemo(() => {
    const focusDistrictId = (nav.level === "city" ? nav.focusDistrictId : nav.activeDistrictId) ?? undefined;
    const focusSubcategoryId = nav.activeSubcategoryId ?? undefined;
    return buildCityLayout(cityDemoModel, { level: nav.level, focusDistrictId, focusSubcategoryId });
  }, [nav.level, nav.focusDistrictId, nav.activeDistrictId, nav.activeSubcategoryId]);

  // Tap-Ergebnis (box.id aus city-scene.ts#pick) auf die passende Navigations-
  // Aktion abbilden: Hüllen-id = "districtId", Balken-id = "districtId/subId",
  // Etagen-id = "districtId/subId/contractId" (city-layout.ts-Id-Konvention).
  // `null` (Boden/Leere) macht bewusst nichts.
  const handleTapBox = useCallback(
    (id: string | null) => {
      if (!id) return;
      const parts = id.split("/");
      if (parts.length === 1) {
        nav.actions.tapDistrict(parts[0]);
      } else if (parts.length === 2) {
        nav.actions.tapSubcategory(parts[1]);
      } else if (parts.length >= 3) {
        nav.actions.tapContract(parts[2]);
      }
    },
    [nav.actions],
  );

  // Statische Startpose (siehe Kommentar oben) — läuft genau EINMAL, sobald
  // `sceneRef` durch den `CityCanvas`-Mount-Effekt befüllt ist (Kind-Effekte
  // laufen vor denen des Elternteils innerhalb desselben Commits, deshalb ist
  // `sceneRef.current` beim ersten Durchlauf bereits gesetzt). WP-C4 ersetzt
  // dies durch einen Kamera-Controller, der auf `nav.cameraIntent` reagiert.
  useEffect(() => {
    if (initialCameraPoseAppliedRef.current) return;
    const scene = sceneRef.current;
    if (!scene || layout.boundingRadius <= 0) return;

    const rect = scene.domElement.getBoundingClientRect();
    const aspect = rect.height > 0 ? rect.width / rect.height : FALLBACK_ASPECT;
    const distance = fitCameraDistance(layout.boundingRadius, CAMERA_FOV_Y_DEG, aspect);
    scene.applyCameraPose(sphericalPose(layout.center, distance, CITY_DEFAULT_AZIMUTH_RAD, CITY_DEFAULT_POLAR_RAD));
    initialCameraPoseAppliedRef.current = true;
  }, [layout]);

  const selectedContract = findSelectedContract(
    cityDemoModel,
    nav.activeDistrictId,
    nav.activeSubcategoryId,
    nav.selectedContractId,
  );

  return (
    // AppShell (`src/components/layout/AppShell.tsx`) umschließt jede Route
    // mit einem scrollenden `<main class="overflow-y-auto … pb-[calc(5rem+
    // env(safe-area-inset-bottom))] md:pb-0">` und einem gepolsterten Inner-
    // Wrapper (`<div class="px-4 py-6 …"><Outlet/></div>`, Z. 97–104 dort).
    // Die Stadt braucht eine exakt bemessene, scrollfreie Fläche — Entscheidung
    // (siehe README "AppShell-Entscheidung"): Sidebar/BottomNav bleiben
    // erreichbar ("Stadt läuft INNERHALB der App-Navigation"), AppShell selbst
    // wird NICHT verändert. Statt negativer Margins (fragil bei künftigen
    // AppShell-Änderungen) spannt DIESE Seite einen eigenen `relative`-
    // Container mit expliziter dvh-Höhe auf, die das AppShell-Chrome abzieht
    // (Header 3.5rem = h-14, Inner-Padding 2×1.5rem = 3rem, auf Mobil
    // zusätzlich die BottomNav-Reserve 5rem+safe-area, byte-identisch zu
    // AppShells eigener Reservierung). Die Canvas-Fläche darunter (WP-C3)
    // wird per `absolute inset-0` in einem `flex-1`-Container positioniert
    // ("absolute Positionierung im Content-Bereich" statt negativer Margins).
    <div className="relative h-[calc(100dvh-3.5rem-3rem-5rem-env(safe-area-inset-bottom))] md:h-[calc(100dvh-3.5rem-3rem)]">
      <div className="flex h-full min-h-0 flex-col gap-3">
        <header className="flex shrink-0 flex-col gap-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {/* Breadcrumb der 3 Ebenen (Stadt → Distrikt → Unterkategorie,
                  siehe README) — jeder Eintrag ist per `goTo` direkt anspringbar. */}
              <nav aria-label={t("city.breadcrumbNavLabel")} className="flex flex-wrap items-center">
                {nav.breadcrumb.map((entry, index) => (
                  <span key={`${entry.level}:${entry.id ?? "root"}`} className="flex items-center">
                    {index > 0 && <ChevronRight className="mx-0.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-11 min-w-11 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
                      onClick={() => nav.actions.goTo(entry.level, entry.id ?? undefined)}
                    >
                      {entry.label}
                    </Button>
                  </span>
                ))}
              </nav>
            </div>

            {/* A11y-Fallback für die 3D-Ansicht (README, Akzeptanzkriterium
                zur nicht-visuellen Alternative): Listenansicht-Toggle. Noch
                ohne Funktion (keine Listenansicht existiert vor WP-C3),
                deshalb disabled statt versteckt — finale Struktur, kein
                totes UI. */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled
              aria-disabled="true"
              aria-label={t("city.a11yListToggle")}
            >
              <List className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-foreground">{t("city.title")}</h1>
            <Badge variant="secondary">{t("city.betaBadge")}</Badge>
          </div>
        </header>

        <Tabs defaultValue={ACTIVE_CITY_TAB} className="shrink-0">
          <TabsList aria-label={t("city.title")}>
            {CITY_TABS.map((tab) => {
              const active = tab.value === ACTIVE_CITY_TAB;
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  disabled={!active}
                  aria-disabled={!active}
                >
                  {t(tab.labelKey)}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        <div
          className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-muted/30"
          role="img"
          aria-label={t("city.canvasAriaLabel")}
        >
          <CityCanvas layout={layout} onTapBox={handleTapBox} sceneRef={sceneRef} className="absolute inset-0" />
        </div>
      </div>

      <Sheet
        open={selectedContract !== null}
        onOpenChange={(open) => {
          if (!open) nav.actions.closeContract();
        }}
      >
        <SheetContent side="bottom" className="max-h-[70dvh] rounded-t-2xl">
          {selectedContract && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedContract.contract.label}</SheetTitle>
                <SheetDescription>
                  {t("city.sheetContractTitle")} · {selectedContract.district.label} → {selectedContract.subcategory.label}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 flex items-center justify-between rounded-lg bg-muted/50 p-3 text-sm">
                <span className="text-muted-foreground">{t("city.sheetMonthlyAmountLabel")}</span>
                <span className="font-semibold">{formatCurrency(selectedContract.contract.amount)}</span>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
