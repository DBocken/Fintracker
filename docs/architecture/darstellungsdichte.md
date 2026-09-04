# Darstellungsdichte: kompakt und fokussiert

Status: verbindliche Konvention (ADR). **Entschieden am 2026-08-30**, ausgelöst
durch einen Befund am neuen Einstieg (`src/features/onboarding/`, PR #340): Die
neu gebauten Schritte tragen eine Entscheidung pro Seite, die aus den
abgelösten Dialogen übernommenen Schritte (`SituationStep`, `FeaturesStep`) 17
bzw. 12 gleichzeitig. Derselbe Fluss wechselte mitten drin seine Dichte.

Diese Datei **präzisiert `AGENTS.md` §4** (Plattform-Prinzip) und widerspricht
ihm nicht: Eine Datenschicht, zwei Präsentationen, Feature-Parität. Neu ist,
was §4 offen lässt — woran sich entscheidet, wer welche Fassung bekommt, und
was „einfaches, sauberes Modell" überprüfbar heißt. Bei Widerspruch gilt
`AGENTS.md`.

## Die Begriffe

Fachlich heißt das, worum es geht, **Informationsdichte** (information
density). Die App führt zwei davon:

| | **kompakt** (high density) | **fokussiert** (low density) |
|---|---|---|
| Für | breite Bildschirme, Maus, schnelles Prüfen und Vergleichen | Telefon, Tablet, Daumen |
| Aufbau | mehr gleichzeitig: Tabellen, Raster, Nebeneinander | eine Hauptaussage je Ansicht, Untermenüs, Sheets |
| Funktionsumfang | **identisch** | **identisch** |

Der Unterschied ist die Zahl gleichzeitiger Entscheidungen pro Ansicht, nicht
der Funktionsumfang. Die fokussierte Fassung lässt nichts weg — sie erreicht
dasselbe über mehr Schritte.

Weitere Begriffe, die den Befund benennen und in Reviews taugen:

- **One Thing Per Page** (Caroline Jarrett, GOV.UK Service Manual) — das
  Prinzip, dem die fokussierte Fassung folgt.
- **Progressive Disclosure** (Nielsen) — Aufdecken in Etappen statt alles auf
  einmal.
- **Extraneous Cognitive Load** — Last, die nicht aus der Aufgabe stammt,
  sondern aus ihrer Darreichung.
- **Hick's Law** — die Entscheidungszeit wächst mit der Zahl gleichrangiger
  Optionen; **Choice Overload** — ab einer gewissen Zahl sinkt auch die
  Entscheidungs*bereitschaft*, und Leute überspringen.
- **Premature configuration** — ein Einrichtungsbildschirm, der Einstellungen
  abfragt, bevor der Nutzer weiß, wofür sie gut sind. Genau der Befund an
  `FeaturesStep`.
- **Dichtebruch** — hausintern: eine Fläche, die mitten in einem Fluss die
  Zahl der gleichzeitigen Entscheidungen sprunghaft erhöht. Es gibt dafür
  keinen etablierten Begriff; „inkonsistent" (Nielsen-Heuristik #4) ist zu
  unscharf für das, was hier gemeint ist.

## Kontext

Gemessen am 2026-08-30:

- **Die Datenschicht ist bereits gemeinsam** und soll es bleiben.
  `Dashboard.tsx` holt EIN ViewModel und reicht dasselbe `model` an beide
  Ansichten. Das ist die Erfüllung von §4 („keine doppelten Queries"), nicht
  ein Zwischenstand.
- **Die Präsentation ist erst zu einem Bruchteil verzweigt.** Drei von rund 25
  Flächen haben `desktop/` + `mobile/`: `dashboard`, `special-categories`,
  `transactions` (dort nur Detail-Aside gegen Bottom-Sheet). Der Rest ist
  responsives CSS oder gar nicht verzweigt.
- **Es gibt drei Schwellen für dieselbe Frage.** `useIsMobile` = 639 px,
  `useIsWideDesktop` = 1024 px, dazu 8× `md:hidden`, 7× `lg:hidden`, 4×
  `sm:hidden` im Baum.
- **Verzweigt wird per CSS, nicht per Zustand.** Beide Bäume werden gerendert,
  einer per `hidden` weggeblendet. `useMediaQuery` wird im ganzen
  Produktivcode an **einer** Stelle benutzt (`ResponsiveInfoPopover`).
- **Android ist keine dritte Variante.** Capacitor lädt dieselbe Webview.

## Entscheidung

### 1. Eine Datenschicht, zwei Präsentationen

Getrennt wird ausschließlich unterhalb von `presentation/`. Domäne, Daten und
ViewModel bleiben je Feature **eines**. Ein zweiter Abfragepfad je Dichte ist
verboten — zwei Wege zu derselben Zahl sind zwei Wege, auf denen sie
auseinanderlaufen kann.

### 2. Feature-Parität bei unterschiedlicher Offenlegungstiefe

Die fokussierte Fassung lässt **kein** Feature weg. Sie darf dafür eigene
Untermenüs, Sheets und Detailseiten einführen — ausdrücklich erlaubt und
erwünscht.

### 3. Die Reihenfolge ist verbindlich: Aussage → Detail → Konfiguration

1. **Aussage.** Die eine Zahl oder Feststellung, für die es die Fläche gibt.
2. **Detail.** Die Aufschlüsselung, die sie erklärt.
3. **Konfiguration.** Alles Einstellbare — hinter einem eigenen Schritt, nie
   auf derselben Ebene wie die Aussage.

Fachlich: *Overview first, zoom and filter, then details on demand*
(Shneiderman) für 1–2, *Progressive Disclosure* für 3.

### 4. Wer welche Dichte bekommt — kein Schalter

Es gibt **keine** Einstellung. Die Dichte entsteht aus dem Kontext:

| Bedingung | Dichte |
|---|---|
| Läuft als Android-App (Capacitor) | **fokussiert**, immer — auch auf dem Tablet |
| Browser, Layout-Viewport **< 768 CSS-Pixel** | **fokussiert** |
| Browser, Layout-Viewport **≥ 768 CSS-Pixel** | **kompakt** |

**768 CSS-Pixel ist die einzige Dichte-Schwelle der App.** Sie bekommt eine
benannte Konstante; `useIsMobile` (639) und `useIsWideDesktop` (1024) bleiben
als *Layout*-Schwellen INNERHALB einer Dichte bestehen und dürfen nie über die
Dichte entscheiden. Der Unterschied steht hier, weil er sonst beim nächsten
`lg:hidden` versehentlich wieder verwischt.

Die App ist immer fokussiert, weil sie **ein Produkt mit einem Verhalten**
ist — nicht eines, das sich je nach Gerät anders anfühlt.

### 5. Die Route ist die Identität, nicht die Struktur

Beide Fassungen dürfen verschiedene Menüs bauen; **jede Funktion bleibt unter
derselben Adresse erreichbar**. Sonst zerfallen Deep-Links, Lesezeichen, die
Tutorial-Anker und die Routenliste der E2E-Prüfungen in zwei Sätze.

Zwei Folgen, die daran hängen:

- **Tutorial-Anker** (`src/lib/tutorial-steps.ts`) zeigen auf DOM-Anker. Jeder
  Anker muss in **beiden** Fassungen existieren, sonst zeigt die Führung in
  einer Dichte ins Leere.
- **Deep-Links des Abfrage-Registers** mit `deepLinkArt: 'quelle'` versprechen
  „genau diese Menge". Legt die fokussierte Fassung das Ziel hinter ein
  Untermenü, muss der Link trotzdem auf dem **Inhalt** landen, nicht auf dem
  Menü.

### 6. Nur eine Fassung wird gemountet — und nur eine geladen

`hidden lg:block` war billig, solange es drei Flächen betraf. Über 25 Flächen
bedeutet es doppeltes DOM, doppelte Recharts-Instanzen und doppelte
Animationen auf genau dem Gerät mit der wenigsten Luft — und beide Fassungen
im Bündel, obwohl jeder Nutzer nur eine braucht. Die nicht gewählte Fassung
wird deshalb **nicht gerendert** und **nicht geladen** (`lazy` je Dichte).

### 7. Die Entscheidung fällt vor dem ersten Anstrich

`useMediaQuery` liefert ohne `matchMedia` `false`. Wer die Dichte erst nach dem
ersten Render bestimmt, zeigt kurz die falsche und baut sie dann um. Die
Auflösung muss synchron vor dem ersten Bild geschehen.

### 8. Ein Dichtewechsel darf nie etwas verlieren

Drehen, Fenster ziehen, „Desktopseite" antippen, ein Faltgerät aufklappen — die
Schwelle wird im Betrieb überschritten, und weil nur eine Fassung gemountet
ist, wird die andere abgebaut. Der Wechsel ist erlaubt und sofort, **darf aber
nichts verlieren, was der Nutzer schon eingegeben hat**. Laufende Formulare
gehören in denselben Entwurfs-Mechanismus, den der Einstieg schon benutzt
(`features/onboarding/data/onboarding-draft-store.ts` als Vorbild).

### 9. Fokussiert heißt: ein Bildschirm, höchstens drei Aussagen, keine Boxen

Nachgetragen am 2026-09-04. Regel 3 sagt, in welcher **Reihenfolge** eine
fokussierte Fläche ihre Inhalte bringt; sie sagt nicht, **wie viel** auf einen
Bildschirm darf. Genau diese Lücke hat beim ersten Umbau (`/coach`) dazu
geführt, dass die kompakte Fläche bloß umsortiert statt neu entworfen wurde:
Register, Karten, Scrollen — ein aufgeräumter Desktop, kein fokussierter
Bildschirm.

Drei Maße, alle drei am Bildschirm nachprüfbar:

| Maß | Regel |
|---|---|
| **Ein Bildschirm** | Eine Auswertungsfläche passt ohne Scrollen in den sichtbaren Bereich. Wer mehr zeigen will, macht einen zweiten Schritt (Regel 2 erlaubt dafür ausdrücklich eigene Untermenüs, Sheets und Detailseiten) |
| **Höchstens drei Aussagen** | Eine Aussage ist eine Zahl oder Feststellung, die für sich stehen kann. Kopfzeile, Bodennavigation und Registerleiste zählen nicht mit — sie sind Rahmen, nicht Inhalt |
| **Keine Boxen** | Kein Rahmen, kein Hintergrund, kein Schatten um Inhalt. Gegliedert wird über Weißraum, Typografie und höchstens eine Haarlinie |

**Listen sind die benannte Ausnahme zu „ein Bildschirm".** Eine Buchungsliste
mit 44 Einträgen ohne Scrollen gibt es nicht, und sie zu kappen hieße, Daten
zu verstecken. Die Regel richtet sich an **Auswertungs**flächen — Coach,
Übersicht, Vermögen, Schulden-Zusammenfassung. Eine Liste ist selbst die eine
Aussage; was über ihr steht, zählt gegen die Drei.

**Warum keine Boxen.** Ein Rahmen ist auf einem großen Bildschirm ein
Ordnungsmittel: Er trennt, was nebeneinander liegt. Auf einem Telefon liegt
nichts nebeneinander — dort trennt bereits die Reihenfolge. Der Rahmen kostet
dann nur Rand (zweimal 16 px je Box), erzeugt eine Schachtelung, die es nicht
gibt, und — das ist der eigentliche Schaden — er verspricht nach Prinzip 8
eine Aktion, die er nicht einlöst.

### 9a. Was als EINE Aussage zählt — und was keine Box ist

Nachgetragen am 2026-09-04, nachdem zwölf Flächen gleichzeitig gegen Regel 9
entworfen wurden und dabei dieselben drei Fragen stellten.

**Eine Visualisierung ist selbst die eine Aussage.** Ein Diagramm mit sechs
Beschriftungen sind nicht sechs Aussagen, sondern eine — die Beschriftungen
sind ihre Legende. Ohne diesen Satz wäre jedes Recharts-Diagramm der App ein
Verstoß und Regel 9 auf keiner Fläche mit Grafik anwendbar (Übersicht,
Liquidität, Einkommen, Trading, Analyse, Finanzstadt). Die Frage ist nicht,
wie viele Zahlen zu sehen sind, sondern wie viele **Entscheidungen** die
Fläche verlangt.

**Ein Plättchen AUF einer gerenderten Fläche ist keine Box; der Rahmen UM sie
schon.** Die Beschriftung im Bild — die Karte der Finanzstadt, das Label über
einem Gebäude, die Zahl im Sunburst — gehört zur Visualisierung. Der Rahmen,
den jemand um das Bild legt, ist eine Box und fällt unter Regel 9.

**Keine Fläche bekommt eine Ausnahme von „ein Bildschirm".** Auch nicht die
Vollbild-Visualisierung: Wenn sie den Bildschirm füllt, erfüllt sie die Regel
ohnehin; was sie an Bedienung braucht, gehört in den Detailschritt.

### 9b. Drei Konventionen, die alle Flächen teilen

Ohne sie stehen nach dem Zusammenführen acht verschiedene Namen in geteilten
Adressen. Gemessen: Die zwölf Entwürfe schlugen `?lage=`, `?summen=`,
`?bereich=`, `?schritt=`, `?frage=`, `?anlass=`, `?stand=` und
`?verwaltung=` vor — für dieselbe Sache.

| Konvention | Regel |
|---|---|
| **Name des Detailschritts** | Ein Parameter für die ganze App: **`?detail=<abschnitt>`**. Der Wert benennt den Abschnitt (`?detail=lage`, `?detail=summen`), damit eine Fläche mehrere Detailschritte haben kann, ohne einen zweiten Parameter zu erfinden |
| **Zurücktaste** | Öffnen **legt einen Verlaufseintrag an** (`push`), Schließen ersetzt ihn (`replace`). Nur so schließt die Zurücktaste den Detailschritt, statt die Fläche zu verlassen. Ein Register**wechsel** innerhalb einer Fläche ist dagegen keine Station im Verlauf und ersetzt |
| **Wer „ein Bildschirm" misst** | Playwright, in beiden Dichten: Scrollhöhe der Fläche gegen die Viewport-Höhe. **Nicht** jsdom — dort hat nichts eine Höhe, ein Unit-Test kann die Regel weder halten noch brechen |

**Die Zurücktasten-Regel ist am Bestand gelernt.** Die erste fokussierte
Fläche (`CoachFokussiert`) öffnete ihren Detailschritt mit `replace: true` und
behauptete im Kommentar, die Zurücktaste schließe ihn. Sie tat es nicht: Ohne
Verlaufseintrag springt die Zurücktaste auf die vorige Route. Auf einem
Telefon ist das der häufigste Handgriff überhaupt — und er führte aus der App
heraus statt aus dem Sheet.

### 10. Eine Karte ist eine Aktion, keine Schachtel

Prinzip 8 (`docs/design-principles.md`, Wächter `check:card-rule`) gilt
weiter — **in der kompakten Dichte**. In der fokussierten gilt Regel 9: keine
Boxen. Das ist kein Widerspruch, sondern die Auflösung eines schon
bestehenden: Prinzip 8 sagt „Karten-Optik = Klick-Versprechen", und wo es gar
keine Karten gibt, ist auch nichts versprochen.

**Karten sind in BEIDEN Dichten überstrapaziert, und das ist ein eigener
Befund.** Gemessen am 2026-09-04 auf der Übersicht: `<Card>` umschließt den
Abschnitt „Letzte Buchungen". Diese Karte ist **tot** — angeklickt werden die
Zeilen darin, nicht sie. Prinzip 8 verbietet das ausdrücklich („Niemals ‚nur
ein verschachtelter Button in einer ansonsten toten Karte'. Entweder die ganze
Fläche reagiert, oder es ist keine Karte"), aber `check:card-rule` sieht es
nicht: Der Wächter fragt, ob in der Karte *irgendein* Interaktions-Signal
vorkommt — und eine Karte voller anklickbarer Zeilen erfüllt das immer.

Zwei Formen, die daraus folgen und in beiden Dichten gelten:

- **Eine Liste bekommt keine Karte um sich.** Der Abschnitt ist eine
  Überschrift plus Liste. `TransactionListMobile` macht es bereits richtig
  (`divide-y`, kein Rahmen je Zeile) — die Karte sitzt eine Ebene darüber.
- **Ein wiederholter Eintrag bekommt keine Karte je Stück.** Zehn Karten
  untereinander sind keine zehn Aktionen, sondern eine Liste mit neunfachem
  Rand.

Eine Karte bleibt richtig, wo sie **eine** Sache zeigt, für die es **eine**
Aktion gibt — und wo die ganze Fläche diese Aktion auslöst.

## Wie die Schwelle wirklich wirkt

Media Queries messen **CSS-Pixel**, nicht Geräte-Pixel. Dazwischen steht
`devicePixelRatio`:

| Gerät | Physisch | DPR | CSS-Breite |
|---|---|---|---|
| Sony Xperia 1 (4K) | 1644 × 3840 | 4 | **411** |
| Galaxy S24 Ultra | 1440 × 3120 | 3,5 | **412** |
| iPhone 15 Pro Max | 1290 × 2796 | 3 | **430** |
| Laptop 1080p | 1920 × 1080 | 1 | **1920** |

Ein 4K-Telefon ist damit **schmaler** als jeder Laptop; es hat nur mehr Punkte
je CSS-Pixel. Auflösung spielt für die Dichte keine Rolle — der Daumen wird
nicht kleiner, weil das Display feiner ist.

**Das gilt nur wegen `width=device-width`** in `index.html`. Ohne diese Angabe
fällt ein mobiler Browser auf einen Ersatz-Viewport von rund **980 CSS-Pixeln**
zurück — und ausgerechnet das Telefon bekäme die kompakte Fassung.

Derselbe Mechanismus ist der Ausweg für den Nutzer: **„Desktopseite anfordern"
lässt den Browser `width=device-width` ignorieren** und den Ersatz-Viewport
nehmen. Ein Mechanismus, zwei Erscheinungsformen — deshalb trägt eine einzige
Schwelle in CSS-Pixeln beide Fälle.

**Daraus folgt der Zahlenwert.** Läge die Schwelle bei 1024, landete der
Nutzer mit angeforderter Desktopseite (~980) *unter* ihr und bekäme trotzdem
die fokussierte Fassung — der Ausweg wäre wirkungslos. Die Schwelle muss unter
dem Ersatz-Viewport liegen. 768 tut das mit Abstand.

**Browser-Zoom ist ausdrücklich eingeschlossen und gewollt.** Zoom verändert
die CSS-Breite; 200 % auf einem 1440-px-Fenster ergeben effektiv 720 und damit
die fokussierte Fassung. Das ist kein Nebeneffekt, sondern richtig: Wer stark
vergrößert, will weniger Dinge gleichzeitig, größer.

## Verworfene Alternativen

**Ein Schalter in den Einstellungen.** Naheliegend, weil die App mit `wording`
(Alltags-/Fachsprache) bereits eine solche Achse führt. Verworfen: Die Wahl
trifft der Nutzer schon dadurch, dass er das Telefon oder den Rechner in die
Hand nimmt. Ein Schalter wäre ein persistiertes Feld mit Migration, Sync und
einem weiteren Zustand in jedem Test — für eine Entscheidung, die der Kontext
besser trifft als ein Menü.

**User-Agent-Erkennung.** Unzuverlässig, ständig in Bewegung, und sie sieht
den Browser-Zoom nicht. Die Breite in CSS-Pixeln beantwortet dieselbe Frage
und ist nachmessbar.

**Zusätzlich `pointer: coarse` / `hover: none`.** Träfe den Touch-Fall
genauer. Verworfen: Zwei Kriterien widersprechen sich in Randfällen (Laptop
mit Touchscreen, Telefon mit Maus), und dann entscheidet niemand mehr
nachvollziehbar. Ein Kriterium, das man an einem Gerät nachmessen kann, ist
mehr wert als zwei, die man erklären muss.

**Die Schwelle bei `lg` (1024).** Wäre die naheliegende Wahl gewesen, weil die
Dashboard-Verzweigung sie heute benutzt — und hätte den Ausweg „Desktopseite"
unbrauchbar gemacht (siehe oben).

## Preis

- **Zwei dauerhaft gepflegte Präsentationen je Fläche.** Jedes neue Feature
  kostet zwei Entwürfe. Das ist der bewusst gezahlte Preis dafür, dass beide
  Nutzungsarten erstklassig sind statt einer kompromissbehaftet.
- **Zwei Bündel je Fläche**, von denen jeder Nutzer eines lädt. Ohne
  Dichte-basiertes `lazy` würde `check:bundle-size` das sofort melden.
- **Zwei Anker-Sätze für das Tutorial**, die synchron bleiben müssen.
- **Doppelte Zustands-Abdeckung in den Tests**, wo sich die Darstellung eines
  Zustands unterscheidet.

## Offene Punkte — zu messen, nicht zu glauben

1. **Der Ersatz-Viewport von ~980 px** ist der dokumentierte Chrome-Wert, in
   diesem Projekt aber **nicht nachgemessen**. Vor dem ersten Umbau auf einem
   echten Android-Gerät prüfen: „Desktopseite anfordern" → gemeldete
   `window.innerWidth`. Weicht der Wert ab und liegt unter 768, ist die
   Schwelle falsch.
2. **Browser-Tablet im Hochformat.** Ein iPad meldet im Hochformat ~820
   CSS-Pixel und bekommt damit **kompakt** — obwohl es ein Tablet ist. Die
   Entscheidung „Tablet bekommt fokussiert" gilt gesichert nur für die
   **App**. Wer das auch im Browser will, hebt die Schwelle auf ~840; das
   bleibt unter dem Ersatz-Viewport und ist damit verträglich. Bewusst offen
   gelassen, bis jemand den Fall wirklich benutzt.
3. **Faltgeräte** melden aufgeklappt 600–770 CSS-Pixel, also dicht an der
   Schwelle, und überschreiten sie beim Auf- und Zuklappen. Das ist der Grund,
   warum Regel 8 kein akademischer Fall ist.
4. **Mounten statt Verstecken** ist als Verbesserung begründet, aber nicht
   gemessen. Vor der Umstellung eine Messung an der teuersten Fläche
   (Dashboard mit Recharts) — Vorbild: `*.perf.test.ts`, Zugriffe zählen statt
   die Uhr lesen, wo möglich.

## Folgen für die Wächter

- `check:platform-parity` prüft heute nur, dass ein `hidden <bp>:*` ein
  Gegenstück hat. Für Regel 5 („jede Funktion in beiden Dichten erreichbar")
  braucht es eine Prüfung auf **Routen**- statt auf Klassenebene.
- Die E2E-Routenliste (`e2e-tests/fixtures/routes.ts`) muss in **beiden**
  Dichten laufen, nicht nur in drei Viewports der Pixelprüfung.
- `check:view-data` (220) und `check:slice-presentation` (12/0) stehen exakt
  auf ihrem Limit. Jede migrierte Fläche muss die Zahlen **senken**; eine
  Migration, die sie hebt, ist falsch gebaut.

Dazu aus den Regeln 9 und 10 (2026-09-04):

- **`check:card-rule` hat einen blinden Fleck.** Er fragt, ob in einer Karte
  *irgendein* Interaktions-Signal vorkommt — eine Karte voller anklickbarer
  Zeilen erfüllt das immer, und genau das ist die tote Schachtel, die Prinzip 8
  verbietet. Die Prüfung muss danach fragen, ob **die Karte selbst** die
  Aktion trägt, nicht ob irgendwo darin eine steckt.
- **Keine Boxen in `presentation/mobile/`** ist maschinell prüfbar:
  Karten-Chrome (`<Card>`, `rounded-*` mit `border`/`shadow`) in einer
  fokussierten Präsentation ist ein Fund. Ratsche wie die übrigen, damit der
  Umbau Fläche für Fläche laufen kann.
- **„Höchstens drei Aussagen" ist NICHT maschinell prüfbar.** Was eine Aussage
  ist, entscheidet der Inhalt, nicht die AST — ein Wächter dafür hätte
  Fehlalarme, und Fehlalarme schalten Wächter ab statt sie durchzusetzen
  (dieselbe Begründung wie bei „Was vor der Schleife indiziert wird",
  AGENTS.md §3). Die Regel gehört ins Selbst-Review, und der Beleg ist ein
  Bildschirmfoto vom Gerät, kein grüner Haken.
- **„Ein Bildschirm ohne Scrollen" ist am Gerät messbar, nicht im Test.**
  jsdom hat keine Höhe. Der Nachweis gehört in die Playwright-Suite, die
  ohnehin in beiden Dichten laufen soll: Scrollhöhe der Fläche gegen die
  Viewport-Höhe, für die Auswertungsflächen (nicht für Listen).

## Was das für den Bestand heißt

Heute sind 3 von rund 25 Flächen verzweigt. Diese Datei beschreibt den
Zielzustand, nicht den Ist-Zustand. Der Umbau ist Fläche für Fläche zu machen,
jeweils mit den Tests beider Dichten im selben Commit — nicht als eine große
Umstellung.

Die erste Fläche, die anliegt, ist der Einstieg selbst: `SituationStep` und
`FeaturesStep` sind der Befund, der zu dieser Datei geführt hat.
