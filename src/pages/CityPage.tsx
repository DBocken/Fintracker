import { Building2, List } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useI18n } from "@/i18n/useI18n";

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

export default function CityPage() {
  const { t } = useI18n();

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
            <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
              {/* Wurzel-Breadcrumb der 3 Ebenen (Stadt → Distrikt → Gebäude,
                  siehe README). Drill-down-Pfad kommt erst mit WP-C1/C2. */}
              <span>{t("city.breadcrumbCity")}</span>
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

        {/* WP-C3: three.js-Renderer/-Kamera-Lifecycle kommt hier hinein,
            außerhalb des React-Render-Zyklus (siehe README, presentation/).
            Nimmt schon jetzt die finale Flex-Fläche ein, damit der spätere
            Canvas-Einbau keinen Layout-Sprung verursacht. */}
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-dashed border-border bg-muted/30">
          <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-muted-foreground">
            {t("city.canvasPlaceholder")}
          </div>
        </div>
      </div>
    </div>
  );
}
