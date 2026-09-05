import { Outlet, useLocation } from "react-router-dom";
import { SeitennameProvider } from "@/features/shared/presentation/SeitennameContext";
import { Search } from "lucide-react";
import { withErrorBoundary } from "@/components/ErrorBoundary";
import SideNav from "@/components/layout/SideNav";
import MobileNav from "@/components/layout/MobileNav";
import BottomNav from "@/components/layout/BottomNav";
import CommandPalette from "@/components/CommandPalette";
import TutorialHost from "@/components/tutorial/TutorialHost";
import PendingTutorialStarter from "@/features/onboarding/presentation/PendingTutorialStarter";
import ThemeToggle from "@/components/ThemeToggle";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import PrivacyIndicator from "@/components/PrivacyIndicator";
import OfflineIndicator from "@/features/shared/presentation/OfflineIndicator";
import TutorialLauncher from "@/features/tutorials/presentation/TutorialLauncher";
import DemoDataBanner from "@/components/DemoDataBanner";
import NotificationsBell from "@/components/NotificationsBell";
import UserQuickProfile from "@/components/UserQuickProfile";
import { AtmosphereLayer } from "@/features/shared/presentation/AtmosphereLayer";
import { useGlobalAtmosphere } from "@/hooks/useGlobalAtmosphere";
import { Button } from "@/components/ui/button";
import { NAV_GROUPS } from "@/components/layout/nav-config";
import { useI18n } from "@/i18n/useI18n";

// Route-Level-Fehlergrenze (RES-7 / WP 1.6): faengt einen Render-Crash EINER
// Flaeche ab, ohne die AppShell-Navigation (SideNav/BottomNav/Header) mit
// abzureissen — vorher gab es nur den globalen ErrorBoundary in main.tsx, der
// beim Absturz die gesamte App inklusive Navigation ersetzte. `withErrorBoundary`
// hatte bis hierher keinen Aufrufer (KOMP-6).
const SafeOutlet = withErrorBoundary(Outlet);

/**
 * Findet den Navigationseintrag zu einer Route. `null`, wenn die Route
 * ausserhalb der Navigation liegt (etwa die Abrechnung).
 */
function navEintrag(pathname: string) {
  for (const g of NAV_GROUPS) {
    for (const item of g.items) {
      if (item.path === pathname) return item;
    }
  }
  return null;
}

/**
 * Die EINE Stelle, an der ein Navigationstext aufgeloest wird.
 *
 * Bewusst nur einmal: `call-site-keys.test.ts` haelt die Zahl dynamisch
 * gebauter Schluessel als Ratsche fest, weil ein Schluessel aus einer Variablen
 * von der Aufrufstellen-Pruefung nicht mehr gegen den Sprachbaum gehalten
 * werden kann. Zwei Aufloeser fuer dieselbe Sache haetten die Zahl gehoben,
 * ohne dass ein einziger neuer Text hinzukommt.
 */
function navText(
  key: string | undefined,
  fallback: string,
  t: (key: string, fallback?: string) => string,
) {
  return t(key ?? "", fallback);
}

function getTitle(pathname: string, t: (key: string, fallback?: string) => string) {
  const item = navEintrag(pathname);
  if (!item) return t("shell.appName");
  const label = navText(item.labelKey, item.label, t);
  return item.requiredTier === "premium" ? `${label} (${t("shell.premium")})` : label;
}

/**
 * Der Seitenname in seiner LANGFORM — oder `null`, wenn die Route keinen
 * kanonischen Namen hat.
 *
 * Unterschied zu `getTitle`: Jenes liefert die Kurzform der Navigation und
 * haengt den Premium-Zusatz an, weil beides in eine schmale Leiste gehoert.
 * Als Ueberschrift im Inhalt waere die Kurzform eine Verschlechterung —
 * gemessen heissen drei Ziele dort anders und laenger ("Verfuegbares Geld"
 * statt "Verfuegbar"). Der Premium-Zusatz entfaellt: Er ist eine Auskunft
 * ueber die Berechtigung, kein Teil des Namens.
 *
 * `null` fuer Routen ausserhalb der Navigation (etwa die Abrechnung): Dort
 * gibt es keine Quelle fuer den Namen, und die Flaeche bleibt zustaendig.
 */
function getSeitenname(pathname: string, t: (key: string, fallback?: string) => string) {
  const item = navEintrag(pathname);
  if (!item) return null;
  return navText(item.titleKey ?? item.labelKey, item.label, t);
}

export default function AppShell() {
  const location = useLocation();
  const { t } = useI18n();
  const title = getTitle(location.pathname, t);
  const seitenname = getSeitenname(location.pathname, t);
  // Datengetriebene Grundstimmung. Vorher stand hier ein festes
  // `{ temperature: 'neutral', intensity: 0, pulse: 'steady' }` — die Schicht
  // war eingebaut, aber dauerhaft unsichtbar. Der Hook laedt nichts nach,
  // sondern liest den vorhandenen Query-Cache mit (siehe useGlobalAtmosphere).
  const atmosphere = useGlobalAtmosphere();

  return (
    // overflow-x-clip: globaler Schutz gegen horizontales Seiten-Scrollen. Clip
    // (statt hidden) auf nur einer Achse lässt Sticky-/Fixed-Positionierung
    // (Sidebar, Header, Bottom-Nav) unberührt.
    <div className="min-h-screen overflow-x-clip bg-background text-foreground">
      <AtmosphereLayer state={atmosphere} />
      <CommandPalette />
      {/* Der Host umschließt den Seiteninhalt als Provider: nachrangige
          Hinweise (Coach-Streifen) lesen darüber, ob gerade eine Tutorial-
          Hinweisebene sichtbar ist (Befund A-2). Sein Einladungs-Banner
          rendert weiterhin an genau dieser Stelle, vor dem Flex-Container. */}
      <TutorialHost>
      {/* Löst den im Einstieg vorgemerkten Tutorial-Wunsch ein — der Einstieg
          selbst steht ausserhalb des Hosts und kann ihn nicht starten. */}
      <PendingTutorialStarter />
      <div className="flex min-h-screen">
        {/* h-[100dvh] statt h-screen (100vh): An die *sichtbare* Viewport-Höhe
            koppeln, damit die ein-/ausblendende Browser-Leiste (Adressleiste/
            Navigationsleiste) das untere Ende der Seitennavigation nicht verdeckt. */}
        <aside className="hidden md:block w-72 h-[100dvh] sticky top-0 self-start border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
          <SideNav />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Safe-Area oben und seitlich: `targetSdkVersion = 36` bedeutet
              erzwungenes Edge-to-Edge (seit Android 15 / SDK 35) — die App
              zeichnet UNTER Statusleiste und Kamera-Ausschnitt, und ein
              `sticky top-0` beginnt damit nicht am sichtbaren Rand, sondern
              am Bildschirmrand. Der Kopf lief also unter der Uhr. Unten war
              das längst bedacht (`main`, `BottomNav`, `MobileNav`), oben und
              seitlich an keiner Stelle.

              Die Einrückung sitzt am `header` und NICHT an der Zeile darin:
              So addiert sie sich zu den vorhandenen `px`-Klassen, statt mit
              deren Breakpoint-Varianten zu konkurrieren. Ohne Ausschnitt ist
              `env()` gleich 0 — auf dem Desktop ändert sich dadurch nichts.
              Seitlich zählt der Querformat-Ausschnitt: Die App ist nicht auf
              Hochformat festgelegt (kein `screenOrientation` im Manifest). */}
          <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)]">
            <div className="flex h-14 items-center gap-1 px-3 sm:gap-2 sm:px-4 lg:px-6">
              <MobileNav />

              {/* In fokussiert traegt die Leiste den Namen NICHT mehr. Neben
                  Menue, Suche, Schild, Glocke und Konto-Knopf blieb ihm auf
                  360 px Platz fuer zwei Zeichen — gemessen "Ei...", "A...",
                  "V...". Ein abgeschnittener Name ist schlechter als keiner:
                  Er kostet Platz und sagt nichts. Er steht stattdessen einmal
                  im Inhalt (SeitennameProvider unten). Das leere flex-1 bleibt
                  als Abstandhalter, damit die Bedienelemente rechts stehen. */}
              <div className="min-w-0 flex-1">
                <div className="hidden truncate text-sm font-semibold kompakt:block">{title}</div>
              </div>

              <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden sm:inline-flex"
                  onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
                >
                  <Search className="mr-2 h-4 w-4" />
                  {t("shell.search")}
                  <span className="ml-2 text-xs text-muted-foreground">⌘K</span>
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="sm:hidden"
                  aria-label={t("shell.search")}
                  onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
                >
                  <Search className="h-4 w-4" />
                </Button>

                {/* WP-9.3: Neben den anderen Statusanzeigen und bewusst NICHT
                    als Streifen ueber dem Inhalt — ein eingeschobener Streifen
                    verschiebt beim Auftauchen die ganze Seite nach unten
                    (Befund aus WP-8.3). Rendert nichts, solange Verbindung
                    besteht. */}
                <OfflineIndicator />

                {/* Sekundäre Werkzeuge — auf dem Telefon NICHT im Kopf.
                    Gemessen auf 360 dp: Menü, Titel, Suche, Datenschutz,
                    Führungen, Sprache, Glocke und Anmelde-Knopf drängten sich
                    in eine 56-px-Zeile, und übrig blieb für den Seitentitel
                    die Breite von zwei Zeichen — auf dem Gerät stand dort
                    buchstäblich „T..". Ein Titel, den niemand lesen kann,
                    belegt den Platz trotzdem (Prinzip 7).

                    Nichts ist entfernt: Die drei stehen mobil im
                    Navigations-Sheet (`MobileNav`), also genau eine
                    Antippung entfernt — AGENTS.md §4 nennt „dichte
                    Werkzeugleiste → Menü" als die vorgesehene Anpassung, und
                    §4 erlaubt eingeklappt, nicht entfernt. Im Kopf bleiben
                    die drei, die auf einem Telefon wirklich dorthin gehören:
                    Suche (schnellster Weg überallhin), Glocke (trägt ein
                    Abzeichen) und das Konto.

                    Der Partner steht in `platform-parity-allowlist.json`. */}
                {/* Der Datenschutz-Schild bleibt AUCH mobil im Kopf. Er ist
                    kein Werkzeug, sondern das Vertrauenssignal dieser App:
                    Fintracker verspricht, dass Finanzdaten auf dem Gerät
                    bleiben, und dieser Schild sagt, ob die Verschlüsselung
                    gerade greift. Ein Versprechen, das man erst in einem Menü
                    nachschlagen muss, wirkt nicht. Er ist zudem das
                    schmalste der Bedienelemente — nach dem Auslagern der
                    beiden anderen blieb auf 360 dp reichlich Platz für den
                    Titel (auf dem Gerät nachgesehen). */}
                <PrivacyIndicator />

                <div className="hidden items-center gap-1 sm:flex sm:gap-2">
                  {/* Dauerhafter Einstieg in die Führungen: „Diese Seite
                      erklären" und der Weg zur Gesamtübersicht. Der
                      Einladungsstreifen allein reichte nicht — er erscheint
                      nur, solange ein Kapitel offen ist, und ist nach einem
                      Klick auf „Nicht jetzt" für die Sitzung weg. */}
                  <TutorialLauncher />

                  <LanguageSwitcher />
                </div>

                {/* Theme erst ab sm sichtbar (auch in den Einstellungen unter
                    Darstellung erreichbar), um den Mobil-Header ruhig zu halten. */}
                <ThemeToggle className="hidden sm:inline-flex" />

                <NotificationsBell />
                <UserQuickProfile />
              </div>
            </div>
          </header>

          <DemoDataBanner />

          {/* overflow-x-hidden: kein horizontales Seiten-Scrollen auf Mobil; breite
              Inhalte (KPI-Strip, Tabellen, Sankey) scrollen in eigenen overflow-x-auto-
              Containern weiter. min-w-0 erlaubt dem Flex-Kind das Schrumpfen. */}
          <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto pb-[calc(5rem+env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] md:pb-0">
            {/* In fokussiert weniger Aussenabstand: 48 px oben und unten sind auf
                  einem 800-px-Schirm sechs Prozent der Hoehe, und Regel 9 rechnet
                  in ganzen Bildschirmen. In kompakt bleibt es dabei. */}
              <div className="w-full min-w-0 px-4 py-4 sm:px-6 lg:px-8 kompakt:py-6 2xl:px-10">
              {seitenname && (
                <h1 className="mb-4 text-xl font-semibold tracking-tight kompakt:hidden">
                  {seitenname}
                </h1>
              )}
              {/* `key={location.pathname}` setzt die Fehlergrenze bei jedem
                  Routenwechsel zurueck — sonst bliebe die Fallback-UI eines
                  Absturzes stehen, obwohl per Navigation laengst eine andere
                  (gesunde) Flaeche angefordert wurde. */}
              <SeitennameProvider traegtDieShell={seitenname !== null}>
                <SafeOutlet key={location.pathname} />
              </SeitennameProvider>
            </div>
          </main>
        </div>
      </div>

      <BottomNav />
      </TutorialHost>
    </div>
  );
}