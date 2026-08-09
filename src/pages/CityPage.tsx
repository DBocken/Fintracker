import { useRef, useState } from "react";
import { Building2 } from "lucide-react";
import { useI18n } from "@/i18n/useI18n";
import EmptyState from "@/components/common/EmptyState";
import FinanceErrorState from "@/components/common/FinanceErrorState";
import { useCityPageModel } from "@/features/finance-city/application/use-city-page-model";
import { CityChrome } from "@/features/finance-city/presentation/CityChrome";
import { CityStage } from "@/features/finance-city/presentation/CityStage";
import { CityContractSheet } from "@/features/finance-city/presentation/CityContractSheet";
import { CityAccessibleList } from "@/features/finance-city/presentation/CityAccessibleList";
import { CityLegend } from "@/features/finance-city/presentation/CityLegend";
import { CitySignatureMoment } from "@/features/finance-city/presentation/CityMoments";

/**
 * Routen-Einstieg der Finanzstadt (AGENTS.md §3: „dünne Routen-Einstiege").
 *
 * Die Seite hält seit WP 6.4 nur noch das, was ausschließlich sie betrifft:
 * die Umschaltung Canvas ↔ Listenansicht, die Legende und die Auswahl, WELCHER
 * der vier Anzeigezustände gezeigt wird. Alles Fachliche steht im ViewModel
 * (`features/finance-city/application/use-city-page-model.ts`, ohne WebGL
 * testbar), alles Räumliche in `presentation/CityStage.tsx`.
 *
 * **AppShell-Entscheidung** (README „AppShell-Entscheidung"): `AppShell`
 * umschließt jede Route mit einem scrollenden `<main>` und einem gepolsterten
 * Inner-Wrapper. Die Stadt braucht eine exakt bemessene, scrollfreie Fläche —
 * Sidebar/BottomNav bleiben erreichbar („Stadt läuft INNERHALB der
 * App-Navigation"), `AppShell` selbst wird NICHT verändert. Statt negativer
 * Margins (fragil bei künftigen AppShell-Änderungen) spannt DIESE Seite einen
 * eigenen `relative`-Container mit expliziter dvh-Höhe auf, die das
 * AppShell-Chrome abzieht (Header 3.5rem, Inner-Padding 2×1.5rem, auf Mobil
 * zusätzlich die BottomNav-Reserve 5rem + safe-area, byte-identisch zu
 * AppShells eigener Reservierung).
 */
export default function CityPage() {
  const { t, locale } = useI18n();
  const chromeRef = useRef<HTMLDivElement | null>(null);
  const [showList, setShowList] = useState(false);
  // WP-5.8: Legende der visuellen Sprache — bewusst NUR auf Abruf. Kein
  // Tutorial, kein automatisches Overlay: `docs/tutorial-progressive-disclosure.md`
  // legt dafür eine eigene Architektur fest, die hier nicht vorweggenommen wird.
  const [legendOpen, setLegendOpen] = useState(false);

  const city = useCityPageModel(t("city.breadcrumbCity"), locale);

  return (
    <div className="relative h-[calc(100dvh-3.5rem-3rem-5rem-env(safe-area-inset-bottom))] md:h-[calc(100dvh-3.5rem-3rem)]">
      <div className="flex h-full min-h-0 flex-col gap-3">
        <CityChrome
          chromeRef={chromeRef}
          breadcrumb={city.nav.breadcrumb}
          onNavigate={city.nav.actions.goTo}
          showList={showList}
          onToggleList={() => setShowList((prev) => !prev)}
          onOpenLegend={() => setLegendOpen(true)}
          tab={city.tab}
          onTabChange={city.setTab}
          timelineCursor={city.timeline.length > 0 ? city.timelineCursor : undefined}
        />

        <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-muted/30">
          {city.requestState === "loading" ? (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <p className="text-sm text-muted-foreground">{t("city.loading")}</p>
            </div>
          ) : city.requestState === "error" ? (
            // WP-9.6: VOR dem Leerzustand — die Rangfolge steckt seit WP 6.4 in
            // `deriveCityRequestState`, nicht mehr in dieser if/else-Kette.
            // Eine leere Stadt hiesse „du hast noch nichts erfasst"; bei einem
            // Lesefehler waere das die falscheste Aussage dieses Screens.
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <FinanceErrorState variant="transactions" onRetry={city.refetch} />
            </div>
          ) : city.requestState === "empty" ? (
            // Keine Daten → Hinweis-Karte statt Canvas (README-Akzeptanzkriterium
            // „nur echte Daten"); der WebGL-Kontext wird gar nicht erst geöffnet.
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <EmptyState
                icon={Building2}
                title={t(
                  city.tab === "goals"
                    ? "city.emptyStateGoals"
                    : city.tab === "income"
                      ? "city.emptyStateIncome"
                      : "city.emptyState",
                )}
              />
            </div>
          ) : (
            <>
              <CityStage
                city={city}
                chromeRef={chromeRef}
                showList={showList}
                onShowList={() => setShowList(true)}
              />

              {showList && (
                <div className="absolute inset-0 overflow-y-auto p-3">
                  <CityAccessibleList model={city.model} nav={city.nav} onBackToCanvas={() => setShowList(false)} />
                </div>
              )}

              <CitySignatureMoment active={city.canvasMounted} />
            </>
          )}
        </div>
      </div>

      <CityLegend
        open={legendOpen}
        onOpenChange={setLegendOpen}
        model={city.model}
        level={city.nav.level}
        hasFlowLines={city.geometry.flowLines.length > 0}
      />

      <CityContractSheet sheet={city.sheet} isIncomeWorld={city.tab === "income"} onClose={city.closeSheet} />
    </div>
  );
}
