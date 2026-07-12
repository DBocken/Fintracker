import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Building2, ChevronRight, List } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useI18n } from "@/i18n/useI18n";
import { formatCurrency } from "@/lib/utils";
import { cityDemoModel } from "@/features/finance-city/data/city-demo-data";
import type { CityModel } from "@/features/finance-city/domain/city-model";
import { buildCityLayout, computeFocusBounds } from "@/features/finance-city/domain/city-layout";
import { useCityNavigation } from "@/features/finance-city/application/use-city-navigation";
import { CityCanvas, type CityControlsApi } from "@/features/finance-city/presentation/CityCanvas";
import { CAMERA_FOV_Y_DEG, type CitySceneHandle } from "@/features/finance-city/presentation/city-scene";
import {
  createCityCameraController,
  type CityCameraController,
  type CityCameraControllerConfig,
} from "@/features/finance-city/presentation/city-camera-controller";
import { useReducedMotion } from "@/hooks/useReducedMotion";

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

/** Fallback-Seitenverhältnis, solange die Canvas-Größe noch nicht messbar ist (0 Höhe während Layout-Übergängen). */
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

/** Plain-`Vec3`-Kopie einer three.js-`Vector3` (o. ä. `{x,y,z}`-Quelle) — der Kamera-Controller ist bewusst three.js-frei (`presentation/city-camera-controller.ts`), bekommt also nie eine echte `THREE.Vector3`-Instanz gereicht. */
function toVec3(v: { x: number; y: number; z: number }) {
  return { x: v.x, y: v.y, z: v.z };
}

export default function CityPage() {
  const { t } = useI18n();
  const sceneRef = useRef<CitySceneHandle | null>(null);
  const controlsApiRef = useRef<CityControlsApi | null>(null);
  // Umschließt Header + Tabs (den kompletten "Chrome" oberhalb der Canvas) —
  // seine gerenderte Höhe ist `chromeTopPx` für die Sichtzentrums-Korrektur
  // des Kamera-Controllers (`camera-math.ts#visualCenterOffset`).
  const chromeRef = useRef<HTMLDivElement | null>(null);
  const [cameraController, setCameraController] = useState<CityCameraController | null>(null);
  const reducedMotion = useReducedMotion();
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;
  // Letzte per DOM-Messung ermittelte (Nicht-reducedMotion-)Konfiguration —
  // der separate reducedMotion-Reaktivitäts-Effekt unten braucht sie, um bei
  // einer System-Einstellungsänderung erneut zu konfigurieren, ohne selbst
  // neu zu messen.
  const lastMeasuredConfigRef = useRef<Omit<CityCameraControllerConfig, "reducedMotion"> | null>(null);

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

  // WP-C4: Fokus-Bounding-Sphere für den Kamera-Controller (Distrikt-Fokus/
  // -Eintauchen bzw. Unterkategorie-Eintauchen) — `computeFocusBounds` liest
  // ausschließlich das bereits gebaute `layout` (README: `presentation/`/der
  // Controller trifft keine eigenen Geometrie-Entscheidungen). Die
  // Balken-/Etagen-Id-Konvention (`districtId/subcategoryId`) verlangt für
  // `enter-subcategory` den zusammengesetzten Schlüssel.
  const focusLayout = useMemo(() => {
    const intent = nav.cameraIntent;
    if (intent.kind === "focus-district" || intent.kind === "enter-district") {
      return intent.targetId ? computeFocusBounds(layout, intent.targetId) : null;
    }
    if (intent.kind === "enter-subcategory") {
      const districtId = nav.activeDistrictId ?? nav.focusDistrictId;
      return districtId && intent.targetId ? computeFocusBounds(layout, `${districtId}/${intent.targetId}`) : null;
    }
    return null;
  }, [layout, nav.cameraIntent, nav.activeDistrictId, nav.focusDistrictId]);

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

  // WP-C4: Kamera-Controller-Lifecycle. Läuft NACH `CityCanvas`s eigenem
  // Mount-Effekt im selben Commit (Kind-Effekte vor Eltern-Effekten,
  // React-Garantie) — `sceneRef.current`/`controlsApiRef.current` sind daher
  // beim ersten Durchlauf bereits befüllt. `setCameraController` propagiert
  // die Instanz als Prop nach unten (Ref-Zuweisung allein würde CityCanvas'
  // eigenen `[]`-Mount-Effekt nicht erneut ausführen, ABER CityCanvas
  // spiegelt den Prop selbst per Ref bei jedem Render — ein einziges
  // Re-Render nach der Erstellung reicht).
  useEffect(() => {
    const scene = sceneRef.current;
    const controlsApi = controlsApiRef.current;
    if (!scene || !controlsApi) return;

    const controller = createCityCameraController({
      getCameraPose: () => ({ position: toVec3(scene.camera.position), target: toVec3(scene.target) }),
      applyCameraPose: (pose) => scene.applyCameraPose(pose),
      setControlLimits: (opts) => controlsApi.setLimits(opts.minDistance, opts.maxDistance),
      setFog: (near, far) => scene.setFog(near, far),
      invalidate: () => controlsApi.invalidate(),
      onZoomOutThreshold: () => nav.actions.zoomOutStep(),
    });

    const measure = () => {
      const chromeTopPx = chromeRef.current?.getBoundingClientRect().height ?? 0;
      const canvasRect = scene.domElement.getBoundingClientRect();
      const aspect = canvasRect.height > 0 ? canvasRect.width / canvasRect.height : FALLBACK_ASPECT;
      const viewportHeightPx = chromeTopPx + canvasRect.height;
      lastMeasuredConfigRef.current = { fovYDeg: CAMERA_FOV_Y_DEG, aspect, chromeTopPx, viewportHeightPx };
      controller.configure({ ...lastMeasuredConfigRef.current, reducedMotion: reducedMotionRef.current });
    };

    measure();
    setCameraController(controller);

    // Reagiert auf Resize/Orientierungswechsel UND Chrome-Höhenänderungen
    // (z. B. Breadcrumb-Umbruch auf schmalen Viewports).
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(scene.domElement);
    if (chromeRef.current) resizeObserver.observe(chromeRef.current);

    return () => {
      resizeObserver.disconnect();
      controller.dispose();
      setCameraController(null);
    };
    // Bewusst `[]`: läuft genau einmal pro `CityCanvas`-Mount (`sceneRef`/
    // `controlsApiRef` sind für die gesamte Lebensdauer stabil); `nav.actions`
    // ist laut `use-city-navigation.ts` referenzstabil (reine `useCallback`s
    // ohne externe deps), `reducedMotion` wird separat unten reaktiv gepflegt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // `prefers-reduced-motion` kann sich zur Laufzeit ändern — ohne neu zu
  // messen, einfach mit der zuletzt gemessenen Konfiguration erneut
  // konfigurieren (gleiches Muster wie `CityCanvas`s eigener reducedMotion-Effekt).
  useEffect(() => {
    if (!cameraController || !lastMeasuredConfigRef.current) return;
    cameraController.configure({ ...lastMeasuredConfigRef.current, reducedMotion });
  }, [cameraController, reducedMotion]);

  // WP-C4 Regel 4: NUR Fokuswechsel/Eintauchen und Reset (= `cameraIntent.seq`-
  // Änderung) starten eine neue Kamerafahrt — der Controller selbst entscheidet
  // per `seq`-Vergleich, ob ein Intent bereits geflogen wurde (Regel 4).
  useEffect(() => {
    if (!cameraController) return;
    cameraController.onIntent(nav.cameraIntent, { layout, focusLayout });
  }, [cameraController, nav.cameraIntent, layout, focusLayout]);

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
        <div ref={chromeRef} className="flex shrink-0 flex-col gap-3">
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
        </div>

        <div
          className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-muted/30"
          role="img"
          aria-label={t("city.canvasAriaLabel")}
        >
          <CityCanvas
            layout={layout}
            onTapBox={handleTapBox}
            onControlsStart={() => cameraController?.cancelFlight()}
            onControlsChange={() => cameraController?.onControlsChange()}
            cameraController={cameraController}
            controlsApiRef={controlsApiRef}
            sceneRef={sceneRef}
            className="absolute inset-0"
          />
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
