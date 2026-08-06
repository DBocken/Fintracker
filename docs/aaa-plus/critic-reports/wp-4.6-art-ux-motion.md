# Critic-Review WP-4.6 — Art Director / UX Critic / Motion Director

> Offener Restpunkt aus [`progress.md`](../progress.md): „Art Director ≥ 3/5,
> UX Critic ≥ 3/5, Motion Director ≥ 3/5 — manuelle Reviews, nicht
> automatisierbar."
>
> **Grundlage:** die vorhandenen Visual-Regression-Baselines
> (`e2e-tests/vertical-slice-visual.spec.ts-snapshots/`), Dashboard bei 1440 px
> und 375 px. Kein Code-Lesen-statt-Hinsehen.
>
> **Einordnung, ausdrücklich:** Das ist ein begründetes Modellurteil gegen die
> im Plan beschriebenen Referenzen, **kein Ersatz für ein menschliches
> Geschmacksurteil**. Es erkennt „inkonsistent" und „redundant" zuverlässig,
> „schön" nicht. Die Bewertungen sind als Diskussionsgrundlage gemeint, nicht
> als Freigabe.
>
> **Stand der Baselines:** vor der globalen Atmosphäre-Verdrahtung aufgenommen
> (`intensity: 0`). Die Befunde zu Hierarchie und Redundanz sind davon
> unberührt.

---

## Befund A-1 — Dieselbe Zahl dreimal, mit drei Etiketten (Blocker für die Hierarchie)

**Schweregrad: Major.** Reproduzierbar in beiden Viewports.

Auf dem Dashboard erscheint `2.542,42 €` **dreimal** innerhalb der ersten zwei
Bildschirmhöhen:

| Position | Etikett |
|---|---|
| Hero (grün, `hero-value`) | „Saldo in diesem Zeitraum" |
| Block darunter (groß, violett hinterlegt) | „Kontostand" |
| Kennzahlenzeile im selben Block | „Kontostand +2.542 €" |

Auf 1440 px kommt eine vierte Stelle hinzu: die Konten-Karte rechts zeigt
„Gesamter Kontostand 2.542,42 €".

**Warum das die Arbeit von WP-4.1 entwertet:** Der Hero soll die *eine*
Hauptaussage tragen. Wenn dieselbe Zahl unmittelbar darunter noch einmal groß
erscheint, konkurrieren zwei Hauptaussagen — der Hero verliert genau die
Dominanz, für die er gebaut wurde. Das Plattform-Prinzip (§4) verlangt auf
Mobil ausdrücklich „eine Hauptaussage pro Ansicht".

Fachlich sind „Saldo im Zeitraum" und „Kontostand" verschiedene Größen. In den
Demodaten fallen sie zusammen, was die Redundanz sichtbar macht — bei echten
Daten mit Anfangssaldo ≠ 0 wären es zwei verschiedene Zahlen und das Problem
wäre ein anderes: zwei gleich große, verschieden bedeutende Zahlen ohne
erkennbare Rangfolge.

**Empfehlung:** Eine der beiden Darstellungen zurücknehmen — entweder den Hero
auf den Kontostand umstellen und den Zeitraum-Saldo in die Kennzahlenzeile
verschieben, oder umgekehrt. Das ist eine Produktentscheidung, keine
Umsetzungsfrage, und gehört vor eine Entscheidung des Auftraggebers.

## Befund A-2 — Drei Hinweisebenen vor dem Inhalt

**Schweregrad: Major** (Mobil), **Minor** (Desktop).

Auf 375 px stehen übereinander: Tutorial-Balken („Soll ich es dir zeigen?"),
Demodaten-Banner („Du siehst Beispieldaten…"), Coach-Streifen („Detailansicht
für Charts & Transaktionen…"). Erst danach beginnt der eigentliche Inhalt. Das
sind rund 30 % der ersten Bildschirmhöhe für Meta-Kommunikation.

**Empfehlung:** Höchstens eine Hinweisebene gleichzeitig; die übrigen erst nach
Abschluss bzw. Wegklicken der vorherigen.

## Befund A-3 — „Zur Finanzstadt" ist ein leerer Kartenstreifen

**Schweregrad: Minor.**

Der Einstieg in die Finanzstadt — laut Plan §3 eine der drei Kernebenen — ist
ein breiter, fast leerer Streifen mit Icon, Text und einem kleinen Chevron
darunter. Er nimmt Hero-nahe Fläche ein, ohne etwas über die Stadt auszusagen.

**Empfehlung:** Entweder eine Vorschau (Miniatur, Stimmungsfarbe, eine
Kennzahl) oder deutlich schmaler. Die Karte trägt Karten-Chrome und ist als
Ganzes klickbar — das entspricht AGENTS.md §9, hier geht es allein um das
Verhältnis von Fläche zu Aussage.

## Befund D-1 — Achsenbeschriftungen sind nicht gerundet

**Schweregrad: Minor.** Data-Viz.

Die Y-Achse des Kontostand-Verlaufs zeigt `3500 €`, `2695 €`, `1795 €`,
`895 €`, `-5 €`. Die inneren Werte sind aus dem Datenbereich errechnet, nicht
auf runde Schritte gelegt. Referenzprodukte (Copilot Money, Linear-Charts)
verwenden runde Intervalle, weil die Achse dann ablesbar statt nur korrekt ist.

**Empfehlung:** Achsen-Ticks auf runde Schritte legen (500er/1000er je nach
Spanne).

## Befund U-1 — Zwei Navigationsebenen im Inhalt

**Schweregrad: Minor** (Mobil).

Auf 375 px stehen eine Tab-Zeile („Heute / Übersicht / Stadt / Buchungen /
Mehr") und weiter unten eine Segmentleiste („Verlauf / Fluss / Kategorien /
Landschaft / Ausgaben / Konten") im Inhaltsfluss, zusätzlich zur Bottom-Nav.
Drei Orientierungsangebote auf einem Screen.

## Behoben im Zuge dieses Reviews

**Befund A-0 — Export-Schaltflächen doppelt.** Unter der
Geldfluss-Visualisierung standen „Export PNG / JPEG / PDF" zweimal
untereinander (beide `hidden sm:flex`, auf Desktop beide sichtbar). Behoben in
`12903a8`, mit [REGRESSION]-Test, der die **Anzahl** prüft.

Bemerkenswert daran: Kein Test hat das je bemerkt, weil keiner die Anzahl
geprüft hat. Gefunden wurde es allein durch das Ansehen der Baseline.

---

## Bewertung nach der Rubrik (Plan §11)

| Kategorie | Note | Begründung |
|---|---|---|
| **Visuelle Hierarchie** | **2/5** | Befund A-1 ist nicht kosmetisch: die dominante Kennzahl konkurriert mit einer identischen Zahl direkt darunter. Damit erreicht der Vertical Slice sein eigenes Ziel („Hero-Hierarchie validieren") nicht. |
| **Art Direction** | **3/5** | Farbwelt, Typografie und Materialsprache sind konsistent und ruhig; die Tokens wirken. Abzug für Flächenverschwendung (A-3) und Hinweisdichte (A-2). |
| **Informationsklarheit** | **3/5** | Beschriftungen sind durchweg in Alltagssprache und verständlich („Wie entwickelt sich mein Kontostand?"). Abzug für A-1 und U-1. |
| **Datenvisualisierung** | **3/5** | Charts sind lesbar und farblich konsistent; Abzug für D-1. |
| **Motion-Qualität** | **nicht bewertbar** | Aus statischen Baselines nicht beurteilbar. Siehe unten. |

**Gate-Konsequenz:** Der Plan fordert Art Director ≥ 3, UX ≥ 3, Motion ≥ 3.
Art Direction und Informationsklarheit erreichen 3. **Visuelle Hierarchie
erreicht 2** und liegt damit unter dem Mindestwert der Kategorie (3, §11).

> **Der WP-4.6-Gate-Rest ist damit nicht bestanden, sondern eskaliert** — im
> Sinne des Agenten-Graphen: kein automatisches Bestehen, sondern ein benannter
> offener Punkt. Er ist eine Produktentscheidung (welche Zahl ist die
> Hauptaussage des Dashboards?) und gehört dem Auftraggeber, nicht dem
> Orchestrator.

## Was dieses Review nicht leisten kann

- **Motion.** Timing, Abbruchbarkeit und Objektkontinuität sind aus statischen
  PNGs nicht beurteilbar. Dafür braucht es einen Lauf mit Videoaufzeichnung
  oder ein menschliches Auge. Die *Voraussetzungen* sind maschinell abgesichert
  (Motion-Tokens, `prefers-reduced-motion`-Tests, 25 migrierte Chart-Serien) —
  das ist nicht dasselbe wie „fühlt sich gut an".
- **Wiederholte Nutzung.** Ob eine Bewegung beim zwanzigsten Mal noch angenehm
  ist, zeigt kein Screenshot.
- **Der Vergleich mit der echten Referenz.** Der Plan nennt Copilot Money und
  Linear. Ich habe deren Oberflächen nicht vorliegen, nur ihre Beschreibung.
  Ein „blinder A/B-Vergleich" gegen eine Beschreibung ist kein blinder
  Vergleich.
