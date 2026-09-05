import { test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  startDemo,
  freezeTime,
  createBudgetFromSuggestion,
  dismissTourInvitation,
} from "./fixtures/vertical-slice";
import { ALL_ROUTES } from "./fixtures/routes";

/**
 * Bildprüfung aller Flächen in der fokussierten Dichte (360 px).
 *
 * ERHEBUNGSLAUF, KEIN TEST — dieselbe Bauform wie `motion-review.spec.ts`:
 * Er behauptet nichts, er nimmt auf. Ausgewertet wird anschliessend von Hand
 * bzw. durch Prüf-Agenten gegen `docs/architecture/darstellungsdichte.md`
 * Regel 9. Deshalb blendet `playwright.config.ts` die Datei aus; freigeschaltet
 * wird sie über `E2E_SHOTS=1`.
 *
 * Aufruf:
 *   E2E_SHOTS=1 pnpm exec playwright test all-screens-shots.spec.ts
 * Ergebnis liegt danach unter `test-results/360/`.
 *
 * AUSDRÜCKLICH KEIN `toHaveScreenshot`. Baselines für alle Routen sind im Repo
 * begründet abgelehnt (plattformgebunden, und nach jedem Umbau veraltet), und
 * für die Frage „ist diese Fläche überladen?" braucht es keinen Pixelvergleich.
 *
 * ZWEI AUFNAHMEN JE ROUTE, und das ist kein Luxus:
 * `fullPage: true` rendert das ganze Dokument und stellt `fixed`-Elemente
 * dabei FALSCH dar — die Bodennavigation landet mitten im Dokumentfluss statt
 * am unteren Rand. Genau daraus ist im Repo schon einmal der Fehlbefund „zwei
 * Navigationsebenen im Inhalt" entstanden (`docs/aaa-plus/offene-punkte.md`).
 * Die ganzseitige Aufnahme beantwortet deshalb NUR die Frage „wie lang ist die
 * Fläche"; wie sie AUSSIEHT, beantwortet allein die Sichtfeld-Aufnahme.
 */

/** Zielbreite: unterhalb der Dichteschwelle von 768 px → fokussiert. */
const TELEFON = { width: 360, height: 800 } as const;

/** Seeding braucht die Seitennavigation, und die ist unter 768 px weg. */
const SEEDING_VIEWPORT = { width: 1280, height: 800 } as const;

const ZIEL = path.join("test-results", "360");

/** Die Ansichten der Auswertungen — jede eine eigene Flaeche hinter `?view=`. */
const AUSWERTUNGS_ANSICHTEN = ["verlauf", "fluss", "kategorien", "ausgaben", "konten"] as const;

/**
 * KEIN zweiter Durchgang für die "gesperrten" Routen (/premium, /contracts,
 * /occasions), und das ist ein GEMESSENES Ergebnis, keine Auslassung.
 *
 * Die Annahme lautete: Sie stehen hinter einem `RouteGuard`, im Demo-Einstieg
 * zeigt `FeatureGate` deshalb den Upsell statt der Fläche, also braucht es
 * einen Lauf mit angehobener Stufe. Ein Kontrolllauf mit gesetztem
 * `ausgabentracker_tier_override_v1 = "premium"` lieferte für alle drei Routen
 * BYTEGLEICHE Masse (/premium 4183 px, /contracts 1768 px, /occasions 800 px).
 *
 * Der Grund steht in `deriveTier` (`src/lib/tier.ts`): Die aktive Demo hebt die
 * Stufe selbst an — sie ersetzt die Daten, nicht die Berechtigung. Im
 * Demo-Einstieg sind die drei Flächen also bereits vollständig sichtbar, und
 * ein zweiter Durchgang nimmt dieselbe Fläche ein zweites Mal auf.
 */

type Messung = {
  route: string;
  /** Tatsächliche Adresse nach dem Laden — deckt stille Umleitungen auf. */
  endgueltigeAdresse: string;
  dichte: string | null;
  /** Bildschirmlängen: > 1 heisst, die Fläche scrollt. */
  bildschirmlaengen: number;
  scrollHoehe: number;
  sichtfeldHoehe: number;
  /** Waagerechter Überlauf — den sieht die Längenmessung nie. */
  waagerechterUeberlauf: number;
};

const messungen: Messung[] = [];

function dateiname(route: string): string {
  // `?` und `=` sind unter Windows in Dateinamen unzulaessig — eine Adresse mit
  // Abfragezeichenkette (`/auswertungen?view=fluss`) laesst den Lauf sonst mit
  // ENOENT abbrechen, und zwar erst nach dem Messen, also mitten im Ergebnis.
  return (
    route
      .replace(/^\//, "")
      .replace(/[/?=&]/g, "-")
      .replace(/-+$/, "") || "wurzel"
  );
}

/**
 * Eine Fläche öffnen, zur Ruhe kommen lassen, messen und zweimal aufnehmen.
 *
 * Die Wartezeiten sind erprobt, nicht geraten: ohne sie wird der Skeleton
 * aufgenommen. `clock.runFor` ist nötig, weil `freezeTime` die Seitenzeit
 * anhält — UI-Timer (Signature Moment, Einblendungen) laufen sonst nie an.
 */
async function flaecheAufnehmen(page: Page, route: string) {
  await page.goto(route);

  // Nach JEDEM goto, nicht einmalig: Die Einladung erscheint kapitelbezogen
  // und schwebt über dem Inhalt, den wir beurteilen wollen.
  await dismissTourInvitation(page);

  await page.waitForTimeout(300);
  await page.clock.runFor(1000);
  await page.waitForTimeout(700);

  const gemessen = await page.evaluate(() => {
    const d = document.documentElement;
    return {
      endgueltigeAdresse: window.location.pathname + window.location.search,
      dichte: d.dataset.density ?? null,
      scrollHoehe: d.scrollHeight,
      sichtfeldHoehe: window.innerHeight,
      waagerechterUeberlauf: d.scrollWidth - d.clientWidth,
    };
  });

  messungen.push({
    route,
    bildschirmlaengen: Number((gemessen.scrollHoehe / gemessen.sichtfeldHoehe).toFixed(2)),
    ...gemessen,
  });

  const basis = dateiname(route);

  // Was der Nutzer beim Öffnen sieht. DAS ist die Layout-Wahrheit.
  await page.screenshot({ path: path.join(ZIEL, `${basis}-sichtfeld.png`) });
  // Nur für die Länge. Stellt fixed-Elemente falsch dar — siehe Kopf.
  await page.screenshot({ path: path.join(ZIEL, `${basis}-ganz.png`), fullPage: true });
}

test.use({ locale: "de-DE", viewport: SEEDING_VIEWPORT });

// Seeding durchs reale UI plus 28 Flaechen mit je zwei Aufnahmen — die
// Vorgabe der Konfiguration (120 s) ist dafuer zu knapp bemessen.
test.setTimeout(900_000);

test.describe("Bildprüfung 360 px", () => {
  test("sollte jede Fläche in der fokussierten Dichte aufnehmen und vermessen", async ({
    page,
  }) => {
    await mkdir(ZIEL, { recursive: true });

    // Vor dem ersten goto: Der Demo-Datensatz hängt am aktuellen Datum.
    await freezeTime(page);

    // OHNE DIESE ZEILE LÜGEN DIE AUFNAHMEN, und zwar lautlos.
    //
    // `freezeTime` faelscht auch requestAnimationFrame. Die datengetriebenen
    // Aufbau-Animationen (AGENTS.md §9: "Daten poppen nicht auf, sie werden
    // aufgebaut") starten dann bei opacity 0 und laufen nie an — auch
    // `clock.runFor` treibt sie nicht zuverlaessig weiter. Auf /liquidity war
    // die Folge eine ueber 4228 px durchgehend LEERE Aufnahme: Der Inhalt lag
    // im DOM und belegte Platz, war aber unsichtbar. Eine Gegenprobe ohne
    // eingefrorene Zeit fand dort 648 Elemente, 2768 Zeichen Text und genau
    // drei unsichtbare Knoten (Recharts-Tooltips) — die Flaeche ist voellig in
    // Ordnung, die Aufnahme war es nicht.
    //
    // Die Reduzierte-Bewegung-Einstellung loest beides zugleich: Die App
    // respektiert sie ohnehin ueberall (§9), sie rendert deshalb sofort den
    // Endzustand, und sie macht den Lauf reproduzierbar statt zeitabhaengig.
    await page.emulateMedia({ reducedMotion: "reduce" });

    await startDemo(page);
    // Ohne das ist /budgets leer und die Fläche nicht beurteilbar.
    await createBudgetFromSuggestion(page);

    // Erst jetzt schmal werden — das Seeding brauchte die Seitennavigation.
    await page.setViewportSize(TELEFON);

    for (const route of ALL_ROUTES) {
      await flaecheAufnehmen(page, route);
    }

    // Die Auswertungen tragen ihre Ansicht in der Adresse, und jede ist eine
    // eigene Flaeche mit eigener Laenge. `/auswertungen` allein misst nur die
    // erste — der Anspruch „eine Ansicht, ein Bildschirm" ist damit fuer vier
    // von fuenf Ansichten unbelegt.
    for (const ansicht of AUSWERTUNGS_ANSICHTEN) {
      await flaecheAufnehmen(page, `/auswertungen?view=${ansicht}`);
    }

    await writeFile(
      path.join(ZIEL, "messungen.json"),
      JSON.stringify({ erhobenAm: new Date().toISOString(), viewport: TELEFON, messungen }, null, 2),
      "utf-8",
    );
  });
});
