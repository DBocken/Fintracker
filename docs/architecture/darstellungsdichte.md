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

## Was das für den Bestand heißt

Heute sind 3 von rund 25 Flächen verzweigt. Diese Datei beschreibt den
Zielzustand, nicht den Ist-Zustand. Der Umbau ist Fläche für Fläche zu machen,
jeweils mit den Tests beider Dichten im selben Commit — nicht als eine große
Umstellung.

Die erste Fläche, die anliegt, ist der Einstieg selbst: `SituationStep` und
`FeaturesStep` sind der Befund, der zu dieser Datei geführt hat.
