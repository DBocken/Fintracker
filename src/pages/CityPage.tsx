import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import * as THREE from "three";
import { motion } from "framer-motion";
import { ArrowRight, Building2, ChevronRight, List, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useI18n } from "@/i18n/useI18n";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";
import EmptyState from "@/components/common/EmptyState";
import type { CityModel } from "@/features/finance-city/domain/city-model";
import { buildCityLayout, computeFocusBounds } from "@/features/finance-city/domain/city-layout";
import { selectCityLabels } from "@/features/finance-city/domain/city-labels";
import { selectCityContext, computeLatestPriceIncrease } from "@/features/finance-city/domain/city-context";
import { buildTransactionsHref } from "@/components/dashboard/filter-utils";
import { OTHER_MERCHANTS_FLOOR_ID } from "@/features/finance-city/domain/city-merchant-floors";
import { useCityNavigation } from "@/features/finance-city/application/use-city-navigation";
import { useCityBackNavigation } from "@/features/finance-city/application/use-city-back-navigation";
import { useCityModel, type CityModelTab } from "@/features/finance-city/application/use-city-model";
import { CityCanvas, type CityControlsApi } from "@/features/finance-city/presentation/CityCanvas";
import { CityLabels, type CityLabelsHandle } from "@/features/finance-city/presentation/CityLabels";
import { CityAccessibleList } from "@/features/finance-city/presentation/CityAccessibleList";
import { CAMERA_FOV_Y_DEG, type CitySceneHandle } from "@/features/finance-city/presentation/city-scene";
import {
  createCityCameraController,
  type CityCameraController,
  type CityCameraControllerConfig,
} from "@/features/finance-city/presentation/city-camera-controller";
import { useMotionSafe, useReducedMotion } from "@/hooks/useReducedMotion";
import { useIsWideDesktop } from "@/hooks/useIsWideDesktop";

/** WP-C5: Mobile 6 / Desktop 10 sichtbare Labels gleichzeitig (Kollisions-Cap, `CityLabels`/`resolveLabelCollisions`). */
const MAX_VISIBLE_LABELS_MOBILE = 6;
const MAX_VISIBLE_LABELS_DESKTOP = 10;

/**
 * Tab-Chrome der Stadt: "Ausgaben" und seit WP-D5 auch "Einnahmen" sind
 * erreichbar (eigener Adapter `buildCityModelFromIncomeStreams`). Ziele/
 * Übersicht bleiben bewusst disabled statt versteckt, damit die finale
 * Navigationsstruktur (README, "3 Ebenen") schon jetzt sichtbar ist.
 */
const CITY_TABS = [
  { value: "overview", labelKey: "city.tabOverview" },
  { value: "income", labelKey: "city.tabIncome" },
  { value: "expenses", labelKey: "city.tabExpenses" },
  { value: "goals", labelKey: "city.tabGoals" },
] as const;

const ENABLED_CITY_TABS: ReadonlySet<string> = new Set(["expenses", "income"]);

/**
 * WP-D3 (Klick-Affordanz): der Erst-Besuch-Hinweis „Tippe auf ein Viertel"
 * wird nach der ersten erfolgreichen Interaktion dauerhaft ausgeblendet —
 * reines UI-Flag, deshalb direkt localStorage (Präzedenzfall
 * `GentleModeProvider`/`SkinProvider`), kein Service-Umweg nötig.
 */
const TAP_HINT_DISMISSED_KEY = "fintracker.city.tap-hint-dismissed";

/** WP-D4: maximal so viele Buchungen kompakt im Vertrags-Sheet — Tiefe gehört auf die Buchungsseite (CTA darunter). */
const MAX_SHEET_BOOKINGS = 5;

/** Datumsformat je App-Locale (kein zentrales formatDate im Repo; `toLocaleDateString` ist die bestehende Konvention, z. B. NotificationsBell). */
const DATE_LOCALE_BY_APP_LOCALE: Record<string, string> = {
  de: "de-DE",
  en: "en-GB",
  tlh: "de-DE",
  ru: "ru-RU",
};

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
  const { t, locale } = useI18n();
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

  // WP-C5: A11y-Parallelstruktur (README-Akzeptanzkriterium: 3D ist nie der
  // einzige Zugriffsweg). Der Canvas bleibt permanent gemountet (kein
  // WebGL-Kontext-Neuaufbau bei jedem Toggle) — im Listen-Modus wird er nur
  // visuell ausgeblendet + `aria-hidden`, siehe JSX unten.
  const [showList, setShowList] = useState(false);
  const cityLabelsRef = useRef<CityLabelsHandle | null>(null);
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const isWideDesktop = useIsWideDesktop();
  const maxVisibleLabels = isWideDesktop ? MAX_VISIBLE_LABELS_DESKTOP : MAX_VISIBLE_LABELS_MOBILE;

  // WP-C8: echte Daten statt Fixture (`cityDemoModel` bleibt nur als
  // Test-Fixture erhalten, README "Folgeschritte") — `useCityModel` teilt
  // dieselben `financeKeys`-Query-Keys wie das Dashboard (kein Query-
  // Duplikat, AGENTS.md §4/§7). `model` ist `{ districts: [] }` solange
  // geladen wird ODER es keine Ausgabendaten gibt; `useCityNavigation` bleibt
  // damit unbedingt aufrufbar (React-Hook-Regel) und ist mit einem leeren
  // Modell bereits crash-frei (Taps sind No-ops, siehe `use-city-navigation.ts`).
  // WP-D5: aktive Welt der Stadt (Ausgaben/Einnahmen) — gleiche Pipeline,
  // anderer Adapter (`useCityModel(tab)`).
  const [activeTab, setActiveTab] = useState<CityModelTab>("expenses");
  const { model, isLoading, isEmpty } = useCityModel(activeTab);
  // Canvas/Labels/Liste mounten NUR mit geladenen, nicht-leeren Daten — spart
  // den WebGL-Kontext während des Ladens/bei leeren Daten (kein Demo-Fallback).
  const canvasMounted = !isLoading && !isEmpty;

  const nav = useCityNavigation(model, { city: t("city.breadcrumbCity") });
  // README-Akzeptanzkriterium "Android-Hardware-Back": Drill-down zuerst eine
  // Ebene zurück (Distrikt→Stadt, Gebäude→Distrikt), erst danach Standard-
  // Navigation. Inert im Web (kein Capacitor-Listener).
  useCityBackNavigation(nav);

  // buildCityLayout ist die EINZIGE Geometrie-Quelle (README) — `presentation/`
  // trifft keine eigenen Layout-Entscheidungen. `focusDistrictId` bedeutet je
  // nach Ebene etwas anderes: auf city-Ebene der (noch nicht betretene)
  // Fokus-Tap, ab district-Ebene der bereits betretene Distrikt.
  const layout = useMemo(() => {
    const focusDistrictId = (nav.level === "city" ? nav.focusDistrictId : nav.activeDistrictId) ?? undefined;
    const focusSubcategoryId = nav.activeSubcategoryId ?? undefined;
    return buildCityLayout(model, { level: nav.level, focusDistrictId, focusSubcategoryId });
  }, [model, nav.level, nav.focusDistrictId, nav.activeDistrictId, nav.activeSubcategoryId]);

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

  // WP-C5: HTML-Overlay-Labels — dieselbe Layout-Quelle wie die 3D-Boxen
  // (`layout`), Text/Beträge kommen aus dem Model (`selectCityLabels`,
  // `domain/city-labels.ts`). Reine Auswahl, KEINE Screen-Projektion hier —
  // die übernimmt `CityLabels.reproject()` pro `onFrame`-Tick (Perf-Vorgabe).
  const labels = useMemo(
    () => selectCityLabels(model, layout, nav.level),
    [model, layout, nav.level],
  );

  // WP-D3: Kontext-Chip der aktuellen Ebene (Was betrachte ich? Wie groß?
  // Welcher Anteil an der Gesamtausgabe?) — reine Domain-Auswahl, keine
  // komponenten-lokale Aggregation (AGENTS.md §8).
  const cityContext = useMemo(
    () =>
      selectCityContext(
        model,
        nav.level,
        nav.level === "city" ? undefined : nav.activeDistrictId,
        nav.activeSubcategoryId,
      ),
    [model, nav.level, nav.activeDistrictId, nav.activeSubcategoryId],
  );

  // WP-D3 (Hover-Kopplung Label↔Box): EIN gemeinsamer Hover-Zustand, gespeist
  // aus beiden Richtungen (Canvas-Raycast über `onHoverBox`, Label-Hover über
  // `onLabelHover`) — gespiegelt als Szenen-Highlight + Label-Ring.
  const [hoveredBoxId, setHoveredBoxId] = useState<string | null>(null);
  const handleHoverBox = useCallback((id: string | null) => setHoveredBoxId(id), []);

  useEffect(() => {
    sceneRef.current?.setHighlight(hoveredBoxId);
    // Highlight ändert nur Material — der Render-on-Demand-Loop schläft ggf.,
    // deshalb explizit einen Frame anfordern.
    controlsApiRef.current?.invalidate();
  }, [hoveredBoxId]);

  // Ebenenwechsel: die gehoverte Box existiert im neuen Layout evtl. nicht
  // mehr — Hover-Zustand zurücksetzen statt ein totes Highlight zu halten.
  useEffect(() => {
    setHoveredBoxId(null);
  }, [nav.level]);

  // WP-D5: Tab-Wechsel = Weltwechsel — Navigation auf die Stadt-Ebene
  // zurücksetzen (Fokus-Ids der alten Welt existieren im neuen Modell nicht)
  // und Hover aufheben. `nav.actions` ist referenzstabil
  // (use-city-navigation.ts), bewusst nicht in den Deps.
  useEffect(() => {
    nav.actions.goTo("city");
    setHoveredBoxId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // WP-D3 (Klick-Affordanz): Erst-Besuch-Hinweis, bis zum ersten erfolgreichen
  // Drill-down (Tap auf ein Viertel ODER Navigation über die Listenansicht).
  const [showTapHint, setShowTapHint] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(TAP_HINT_DISMISSED_KEY) !== "1";
    } catch {
      return true; // Storage blockiert (z. B. Privacy-Modus): Hinweis nur sessionweise.
    }
  });
  const dismissTapHint = useCallback(() => {
    setShowTapHint((prev) => {
      if (!prev) return prev;
      try {
        window.localStorage.setItem(TAP_HINT_DISMISSED_KEY, "1");
      } catch {
        // Storage blockiert: Hinweis verschwindet trotzdem für diese Session.
      }
      return false;
    });
  }, []);
  useEffect(() => {
    if (nav.level !== "city") dismissTapHint();
  }, [nav.level, dismissTapHint]);

  const tapHintMotion = useMotionSafe({
    // Datengetriebener Aufbau statt Aufpoppen (docs/design-principles.md §2):
    // der Hinweis gleitet dezent von unten ein, verzögert, damit er erst nach
    // dem Balken-Aufbau die Aufmerksamkeit bekommt.
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: 0.8, duration: 0.35 },
  });

  // Misst die reale Canvas-Fläche für die Label-Reprojektion (NDC ->
  // Bildschirm-Pixel, `CityLabels`). Bewusst über einen EIGENEN Container-Ref
  // statt über `scene.domElement` (WP-C4-Messeffekt unten): bleibt so auch
  // funktionsfähig, wenn WebGL nicht verfügbar ist (`webglUnavailable`-
  // Fallback in `CityCanvas.tsx`) — die Fläche existiert so oder so.
  // Abhängigkeit von `canvasMounted` (WP-C8): der Container-Div existiert erst,
  // sobald Laden/Leer-Zustand vorbei sind — ohne diese Dep würde der Effekt
  // beim allerersten (leeren) Render laufen, `el` wäre `null`, und der
  // ResizeObserver würde nie nachträglich angehängt.
  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      setCanvasSize({ width: rect.width, height: rect.height });
    };
    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(el);
    return () => resizeObserver.disconnect();
  }, [canvasMounted]);

  // Sobald die Canvas-Fläche bekannt ist / sich ändert, EINEN Frame anfordern:
  // `CityLabels.reproject` läuft ausschließlich über `onFrame` (Perf-Vorgabe),
  // und `onFrame` feuert nur in tatsächlich gerenderten Frames. Ohne diesen
  // Anstoß bliebe die Reprojektion aus, wenn der einzige bisherige Frame noch
  // mit `canvasSize {0,0}` lief (reproject bricht dann früh ab) und die Kamera
  // danach still steht — insbesondere unter `prefers-reduced-motion`, wo der
  // Eröffnungs-Intent nur einen Sofort-Schnitt (ein Frame) statt eines Fluges
  // auslöst. Der erzwungene Frame reprojiziert mit korrekter Größe UND frischen
  // Kamera-Matrizen (onFrame läuft direkt nach `render()`).
  useEffect(() => {
    if (canvasSize.width > 0 && canvasSize.height > 0) {
      controlsApiRef.current?.invalidate();
    }
  }, [canvasSize]);

  // WP-C5-Andockpunkt der Perf-Vorgabe: `CityCanvas` feuert `onFrame` NUR in
  // Frames, in denen tatsächlich gerendert wurde (siehe CityCanvas.tsx) — die
  // Labels reprojizieren sich exakt darüber, OHNE eigenen Timer.
  const handleFrame = useCallback((camera: THREE.PerspectiveCamera) => {
    cityLabelsRef.current?.reproject(camera);
  }, []);

  // Tap-Ergebnis (box.id aus city-scene.ts#pick) auf die passende Navigations-
  // Aktion abbilden: Hüllen-id = "districtId", Balken-id = "districtId/subId",
  // Etagen-id = "districtId/subId/contractId" (city-layout.ts-Id-Konvention).
  // `null` (Boden/Leere) macht bewusst nichts.
  const handleTapBox = useCallback(
    (id: string | null) => {
      if (!id) return;
      dismissTapHint();
      const parts = id.split("/");
      if (parts.length === 1) {
        nav.actions.tapDistrict(parts[0]);
      } else if (parts.length === 2) {
        nav.actions.tapSubcategory(parts[1]);
      } else if (parts.length >= 3) {
        nav.actions.tapContract(parts[2]);
      }
    },
    [nav.actions, dismissTapHint],
  );

  // WP-C4: Kamera-Controller-Lifecycle. Läuft NACH `CityCanvas`s eigenem
  // Mount-Effekt im selben Commit (Kind-Effekte vor Eltern-Effekten,
  // React-Garantie) — `sceneRef.current`/`controlsApiRef.current` sind daher
  // beim ersten Durchlauf bereits befüllt. `setCameraController` propagiert
  // die Instanz als Prop nach unten (Ref-Zuweisung allein würde CityCanvas'
  // eigenen `[]`-Mount-Effekt nicht erneut ausführen, ABER CityCanvas
  // spiegelt den Prop selbst per Ref bei jedem Render — ein einziges
  // Re-Render nach der Erstellung reicht).
  //
  // WP-C8: `CityCanvas` mountet jetzt erst mit `canvasMounted` (Laden/Leer-
  // Zustand zeigen keinen Canvas) — dieser Effekt muss deshalb auf
  // `canvasMounted` reagieren, sonst liefe er beim allerersten (Canvas-losen)
  // Render mit `sceneRef.current === null` und würde nie erneut versuchen.
  useEffect(() => {
    // Reiner Mount-Guard: `CityCanvas` hat seine Refs im eigenen Mount-Effekt
    // gesetzt (Kind-Effekte vor Eltern-Effekten). Die Instanzen werden hier
    // bewusst NICHT in die deps-Closures gecaptured — siehe Kommentar unten.
    if (!sceneRef.current || !controlsApiRef.current) return;

    // [REGRESSION] StrictMode-/Remount-Robustheit: Alle deps lösen die Refs
    // LIVE beim Aufruf auf, statt die aktuelle Instanz einmalig zu capturen.
    // Grund (Dev-Befund, rAF-Sonde): React-StrictMode remountet CityCanvas
    // (Mount A → Cleanup → Mount B) NACH diesem Effekt — eine gecapturte
    // Instanz A wäre danach tot: ihr Loop-Closure behält ein gecanceltes
    // rafHandle, `invalidate()` dort ist für immer ein No-op, und kein
    // Kamera-Intent (Fokus/Eintauchen/Reset) weckt den lebenden Loop B —
    // Flüge starten nie, die Szene friert auf dem alten Frame ein.
    const controller = createCityCameraController({
      getCameraPose: () => {
        const scene = sceneRef.current;
        if (!scene) return { position: { x: 0, y: 0, z: 0 }, target: { x: 0, y: 0, z: 0 } };
        return { position: toVec3(scene.camera.position), target: toVec3(scene.target) };
      },
      applyCameraPose: (pose) => sceneRef.current?.applyCameraPose(pose),
      setControlLimits: (opts) => controlsApiRef.current?.setLimits(opts.minDistance, opts.maxDistance),
      setFog: (near, far) => sceneRef.current?.setFog(near, far),
      invalidate: () => controlsApiRef.current?.invalidate(),
      onZoomOutThreshold: () => nav.actions.zoomOutStep(),
    });

    const measure = () => {
      const scene = sceneRef.current;
      if (!scene) return;
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
    // (z. B. Breadcrumb-Umbruch auf schmalen Viewports). Das beobachtete
    // Canvas-DOM-Element ist über einen Remount hinweg dasselbe (React
    // erhält den Knoten, nur der WebGL-Lifecycle drumherum wird neu erzeugt).
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(sceneRef.current.domElement);
    if (chromeRef.current) resizeObserver.observe(chromeRef.current);

    return () => {
      resizeObserver.disconnect();
      controller.dispose();
      setCameraController(null);
    };
    // `canvasMounted` ist die einzige echte Dependency: `sceneRef`/
    // `controlsApiRef` sind für die gesamte Lebensdauer EINES `CityCanvas`-
    // Mounts stabil; `nav.actions` ist laut `use-city-navigation.ts`
    // referenzstabil (reine `useCallback`s ohne externe deps), `reducedMotion`
    // wird separat unten reaktiv gepflegt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasMounted]);

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
    model,
    nav.activeDistrictId,
    nav.activeSubcategoryId,
    nav.selectedContractId,
  );

  // WP-D4 (Sheet als Absprungpunkt, Nutzer-Wunsch): Betrag/Anteile stehen
  // inzwischen an den Labels — das Sheet zeigt stattdessen NEUE Information:
  // die letzten Buchungen des Händlers (kompakt, je Zeile klickbar → exakte
  // Buchung via `?tx=`), einen Preis-Trend-Hinweis und den Deep-Link auf die
  // gefilterte Buchungsseite (gleiches Muster wie Sunburst/Sankey-Klicks,
  // `buildTransactionsHref`). Die Stadt aggregiert über ALLE geladenen
  // Buchungen (`useCityModel`, kein Zeitraum-Filter) — der Default-Range
  // 'Gesamt' des Deep-Links deckt sich damit, Summen bleiben konsistent.
  const sheetBookings = selectedContract?.contract.bookings ?? [];
  const sheetRecentBookings = sheetBookings.slice(0, MAX_SHEET_BOOKINGS);
  // Preis-Trend nur in der Ausgaben-Welt: bei Einnahmen wäre "teurer geworden"
  // eine GUTE Nachricht (Gehaltserhöhung) — der Warnhinweis passt dort nicht.
  const sheetPriceIncrease =
    activeTab === "expenses" ? computeLatestPriceIncrease(selectedContract?.contract.bookings) : null;
  const sheetIsOtherFloor = selectedContract?.contract.id === OTHER_MERCHANTS_FLOOR_ID;
  // WP-D5: Deep-Link-Semantik kommt aus dem Domain-Modell (`contract.filter`,
  // vom jeweiligen Adapter gesetzt) — die Page kennt keine Tab-Sonderfälle.
  const sheetFilter = selectedContract?.contract.filter;
  const sheetAllBookingsHref = selectedContract
    ? buildTransactionsHref({
        category: sheetFilter?.categoryId ?? "all",
        search: sheetFilter?.search ?? "",
      })
    : "";
  const sheetNextPayment = selectedContract?.subcategory.nextPayment;
  const sheetBookingHref = (txId: string) =>
    `${sheetAllBookingsHref}${sheetAllBookingsHref.includes("?") ? "&" : "?"}tx=${encodeURIComponent(txId)}`;
  const sheetDateFormatter = useMemo(
    () => new Intl.DateTimeFormat(DATE_LOCALE_BY_APP_LOCALE[locale] ?? "de-DE", { dateStyle: "medium" }),
    [locale],
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
                  {nav.breadcrumb.map((entry, index) => {
                    const isCurrent = index === nav.breadcrumb.length - 1;
                    return (
                      <span key={`${entry.level}:${entry.id ?? "root"}`} className="flex items-center">
                        {index > 0 && (
                          <ChevronRight
                            className="mx-0.5 h-3.5 w-3.5 text-muted-foreground"
                            aria-hidden="true"
                          />
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-current={isCurrent ? "page" : undefined}
                          className="h-11 min-w-11 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground"
                          onClick={() => nav.actions.goTo(entry.level, entry.id ?? undefined)}
                        >
                          {entry.label}
                        </Button>
                      </span>
                    );
                  })}
                </nav>
              </div>

              {/* A11y-Fallback für die 3D-Ansicht (README, Akzeptanzkriterium
                  zur nicht-visuellen Alternative): Listenansicht-Toggle
                  (WP-C5) — schaltet zwischen Canvas- und Listenansicht um,
                  teilt denselben `nav`-State (kein Parallel-State). */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-pressed={showList}
                aria-label={showList ? t("city.listView.backToCanvas") : t("city.a11yListToggle")}
                onClick={() => setShowList((prev) => !prev)}
              >
                <List className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-foreground">{t("city.title")}</h1>
              <Badge variant="secondary">{t("city.betaBadge")}</Badge>
            </div>
          </header>

          <Tabs
            value={activeTab}
            onValueChange={(value) => {
              if (ENABLED_CITY_TABS.has(value)) setActiveTab(value as CityModelTab);
            }}
            className="shrink-0"
          >
            <TabsList aria-label={t("city.title")}>
              {CITY_TABS.map((tab) => {
                const enabled = ENABLED_CITY_TABS.has(tab.value);
                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    disabled={!enabled}
                    aria-disabled={!enabled}
                  >
                    {t(tab.labelKey)}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-muted/30">
          {/* WP-C8: solange geladen wird, zeigt die Fläche nur einen dezenten
              Lade-Hinweis — Canvas/Labels/Liste mounten erst mit echten Daten
              (kein Fixture-Fallback, kein unnötiger WebGL-Kontext). */}
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <p className="text-sm text-muted-foreground">{t("city.loading")}</p>
            </div>
          ) : isEmpty ? (
            // WP-C8: keine Ausgabendaten -> Hinweis-Karte statt Canvas (README/
            // Akzeptanzkriterium "nur echte Daten"). Canvas/Labels/Liste
            // mounten hier bewusst NICHT (spart den WebGL-Kontext).
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <EmptyState
                icon={Building2}
                title={t(activeTab === "income" ? "city.emptyStateIncome" : "city.emptyState")}
              />
            </div>
          ) : (
            <>
              {/* Canvas bleibt gemountet, solange Daten vorhanden sind (kein
                  WebGL-Kontext-Neuaufbau bei jedem Listen-Toggle, siehe
                  Kommentar bei `showList` oben) — im Listen-Modus nur visuell
                  ausgeblendet + `aria-hidden`, damit Screenreader nicht zwei
                  konkurrierende Ansichten sehen. */}
              <div
                ref={canvasContainerRef}
                aria-hidden={showList}
                role={showList ? undefined : "img"}
                aria-label={showList ? undefined : t("city.canvasAriaLabel")}
                className={cn("absolute inset-0", showList && "invisible")}
              >
                <CityCanvas
                  layout={layout}
                  onTapBox={handleTapBox}
                  onHoverBox={handleHoverBox}
                  onControlsStart={() => cameraController?.cancelFlight()}
                  onControlsChange={() => cameraController?.onControlsChange()}
                  cameraController={cameraController}
                  onFrame={handleFrame}
                  controlsApiRef={controlsApiRef}
                  sceneRef={sceneRef}
                  className="absolute inset-0"
                />
                {/* WP-D6 (Premium-Look): dezente Vignette rahmt die Szene und
                    zieht den Blick zur Stadt — reines CSS-Overlay (kein
                    Post-Processing/GPU-Pass), liegt UNTER den Labels. */}
                <div
                  aria-hidden="true"
                  data-testid="city-vignette"
                  className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(2,6,12,0.22)_100%)] dark:bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.45)_100%)]"
                />
                <CityLabels
                  ref={cityLabelsRef}
                  labels={labels}
                  canvasSize={canvasSize}
                  maxVisible={maxVisibleLabels}
                  // WP-D1 (Nutzer-Befund "wo würde Streaming auftauchen?"):
                  // Stadt-Ebene hat nur wenige Distrikte -> ALLE Distrikt-
                  // Labels sichtbar (kein Kollisions-Culling/Cap). Ab der
                  // Distrikt-Ebene (Unterkategorien/Etagen) gibt es
                  // potenziell viele Gebäude -> dort bleibt entzerrt.
                  declutter={nav.level !== "city"}
                  // WP-D2/D3 (Nutzer-Befund "Labels verdecken kleine Etagen"):
                  // ab der Distrikt-Ebene die Labels seitlich versetzen und per
                  // farbiger Führungslinie mit ihrer Etage/ihrem Gebäude
                  // verbinden, statt sie mittig auf die Baukörper zu setzen.
                  // Stadt-Ebene bleibt beim bisherigen Verhalten (wenige
                  // Distrikt-Hüllen, Label über der Hülle verdeckt nichts).
                  connectors={nav.level !== "city"}
                  // WP-D3 (Hover-Kopplung + Tap-Fläche): Label-Hover spiegelt
                  // das Szenen-Highlight, Label-Tap wirkt wie ein Tap auf die
                  // Box (gleiche Navigations-Semantik wie der Canvas-Raycast).
                  highlightedId={hoveredBoxId}
                  onLabelHover={handleHoverBox}
                  onLabelTap={handleTapBox}
                  // WP-D1: Fade-in nur bei echtem Ebenen-/Weltwechsel (Balken
                  // wachsen neu), NICHT bei jedem Query-Refetch — sonst
                  // flackern alle Labels, sobald eine Kategorie-Zuweisung/ein
                  // Fensterfokus die Stadt-Query neu lädt. Tab im Key (WP-D5):
                  // auch der Tab-Wechsel baut die Stadt neu auf.
                  fadeKey={`${activeTab}:${nav.level}`}
                  className="absolute inset-0"
                />

                {/* WP-D3: Kontext-Chip der aktuellen Ebene (reines Readout,
                    bewusst ohne Karten-Chrome/Rahmen — kein Klickziel,
                    docs/design-principles.md §8 greift daher nicht). */}
                {cityContext && (
                  <div
                    data-testid="city-context-chip"
                    className="pointer-events-none absolute bottom-3 left-3 max-w-[70%] truncate rounded bg-background/80 px-2 py-1 text-xs text-muted-foreground"
                  >
                    {cityContext.kind === "city" ? (
                      <>
                        {t(activeTab === "income" ? "city.contextTotalIncomeLabel" : "city.contextTotalLabel")} ·{" "}
                        <span className="font-medium text-foreground">{formatCurrency(cityContext.amount)}</span>
                      </>
                    ) : (
                      <>
                        <span className="font-medium text-foreground">{cityContext.label}</span>
                        {" · "}
                        {formatCurrency(cityContext.amount)}
                        {cityContext.kind === "district" && (
                          <>
                            {" · "}
                            {t("city.contextBuildingCount").replace("{count}", String(cityContext.buildingCount))}
                          </>
                        )}
                        {cityContext.kind === "subcategory" && cityContext.contractCount > 0 && (
                          <>
                            {" · "}
                            {/* WP-D5: Einnahmen-Etagen sind MONATE, Ausgaben-Etagen Verträge/Händler. */}
                            {t(activeTab === "income" ? "city.contextMonthCount" : "city.contextContractCount").replace(
                              "{count}",
                              String(cityContext.contractCount),
                            )}
                          </>
                        )}
                        {typeof cityContext.share === "number" && (
                          <>
                            {" · "}
                            {t(
                              activeTab === "income" ? "city.contextShareOfTotalIncome" : "city.contextShareOfTotal",
                            ).replace("{percent}", formatPercent(cityContext.share, 0))}
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* WP-D3: Erst-Besuch-Hinweis (Klick-Affordanz) — verschwindet
                    dauerhaft nach dem ersten Drill-down. Bewusst über dem
                    Kontext-Chip (bottom-12), damit sich beide auf schmalen
                    Viewports nicht überlagern. */}
                {showTapHint && nav.level === "city" && (
                  <motion.div
                    {...tapHintMotion}
                    data-testid="city-tap-hint"
                    className="pointer-events-none absolute inset-x-0 bottom-12 flex justify-center"
                  >
                    <span className="rounded-full bg-background/80 px-3 py-1.5 text-xs text-muted-foreground shadow-sm">
                      {t("city.tapHint")}
                    </span>
                  </motion.div>
                )}
              </div>

              {showList && (
                <div className="absolute inset-0 overflow-y-auto p-3">
                  <CityAccessibleList
                    model={model}
                    nav={nav}
                    onBackToCanvas={() => setShowList(false)}
                  />
                </div>
              )}
            </>
          )}
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
                  {t(activeTab === "income" ? "city.sheetIncomeTitle" : "city.sheetContractTitle")} ·{" "}
                  {selectedContract.district.label} → {selectedContract.subcategory.label}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 flex items-center justify-between rounded-lg bg-muted/50 p-3 text-sm">
                <span className="text-muted-foreground">{t("city.sheetMonthlyAmountLabel")}</span>
                <span className="font-semibold">{formatCurrency(selectedContract.contract.amount)}</span>
              </div>

              {/* WP-D4: Preis-Trend — nur bei VERTEUERUNG gegenüber der
                  vorletzten Buchung (schleichende Abo-Preiserhöhung), siehe
                  `computeLatestPriceIncrease`. */}
              {sheetPriceIncrease !== null && (
                <p
                  data-testid="city-sheet-price-increase"
                  className="mt-2 flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-500"
                >
                  <TrendingUp className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {t("city.sheetPriceIncrease").replace("{amount}", formatCurrency(sheetPriceIncrease))}
                </p>
              )}

              {/* WP-D5 (Einnahmen): nächste erwartete Zahlung des Stroms —
                  nur regelmäßige Quellen tragen eine Projektion (Adapter). */}
              {sheetNextPayment && (
                <p data-testid="city-sheet-next-payment" className="mt-2 text-xs text-muted-foreground">
                  {t("city.sheetNextPayment")
                    .replace("{date}", sheetDateFormatter.format(new Date(sheetNextPayment.dateISO)))
                    .replace("{amount}", formatCurrency(sheetNextPayment.amount))}
                </p>
              )}

              {/* WP-D4: kompakte Buchungsliste — jede Zeile ist als Ganzes ein
                  Link auf GENAU diese Buchung (`?tx=`-Deep-Link der
                  Buchungsseite), gefiltert auf Kategorie + Händler, damit die
                  Zielliste kurz ist und die Buchung sicher enthält. */}
              {sheetRecentBookings.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {t("city.sheetRecentBookings")}
                  </h3>
                  <ul className="mt-1">
                    {sheetRecentBookings.map((booking) => (
                      <li key={booking.txId}>
                        <Link
                          to={sheetBookingHref(booking.txId)}
                          data-testid="city-sheet-booking"
                          className="flex min-h-11 items-center justify-between gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50"
                        >
                          <span className="text-muted-foreground">{sheetDateFormatter.format(new Date(booking.date))}</span>
                          {/* Payee nur bei der "Sonstige"-Etage — dort mischen
                              sich mehrere Händler, sonst wäre er redundant zum
                              Sheet-Titel. */}
                          {sheetIsOtherFloor && <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{booking.payee}</span>}
                          <span className="font-medium tabular-nums">{formatCurrency(booking.amount)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>

                  <Button asChild variant="outline" className="mt-3 w-full">
                    <Link to={sheetAllBookingsHref} data-testid="city-sheet-all-bookings">
                      {t("city.sheetViewAllBookings").replace("{count}", String(sheetBookings.length))}
                      <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
                    </Link>
                  </Button>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
