---
titel: "Warum eine einzelne Prognoselinie in die Irre führt"
beschreibung: "Klassische Finanz-Apps zeichnen eine Linie in die Zukunft und tun so, als wäre sie sicher. Eine Monte-Carlo-Simulation zeigt stattdessen die Bandbreite — und beantwortet damit die Frage, an der Haushaltsplanungen tatsächlich scheitern."
datum: 2026-08-19
autor: Fintracker
---

Jede Finanz-App, die eine Vorschau anbietet, macht im Kern dieselbe Rechnung:
Sie nimmt deine durchschnittlichen Einnahmen, zieht deine durchschnittlichen
Ausgaben ab und zeichnet das Ergebnis als Linie in die Zukunft. Die Linie sieht
präzise aus. Genau das ist das Problem.

## Der Durchschnitt ist der eine Verlauf, den du nie erlebst

Dein Gehalt kommt vielleicht zuverlässig. Deine Ausgaben tun das nicht. Im
Januar kommt die Kfz-Versicherung, im Februar die Nebenkostenabrechnung, im
März nichts Besonderes, und im April geht die Waschmaschine kaputt. Eine
Durchschnittsrechnung verteilt diese Ereignisse gleichmäßig über das Jahr — und
beschreibt damit einen Verlauf, den es so nie gibt.

Der Fehler fällt nicht auf, solange genug Puffer da ist. Er fällt genau dann
auf, wenn es eng wird: Die Linie sagt „3.100 € im Februar", und tatsächlich
sind es 2.400 €, weil zwei Jahresrechnungen im selben Monat fällig waren.

## Was eine Monte-Carlo-Simulation anders macht

Statt einmal zu rechnen, rechnet eine Monte-Carlo-Simulation tausendmal. In
jedem Durchlauf schwanken die Werte innerhalb der Bandbreite, die deine echten
Buchungen hergeben: Einnahmen mal etwas später, variable Ausgaben mal höher,
unregelmäßige Rechnungen mal in diesem und mal in jenem Monat.

Aus tausend Verläufen entsteht kein einzelner Wert, sondern eine Verteilung.
Die wird üblicherweise als drei Kurven dargestellt:

- **P50** — der mittlere Verlauf. In der Hälfte der Fälle steht es besser, in
  der Hälfte schlechter.
- **P90** — der gute Fall. Nur in einem von zehn Verläufen läuft es noch besser.
- **P10** — der schlechte Fall. In einem von zehn Verläufen läuft es schlechter.

Der interessante Wert ist fast immer P10. Er beantwortet die Frage, die
tatsächlich zählt: *Wie schlecht kann es realistischerweise laufen, und halte
ich das aus?*

## Ein Beispiel

Ein Haushalt mit rund 3.200 € Startguthaben sieht in der Durchschnittsrechnung
das ganze Jahr über solide aus — die Linie steigt langsam auf über 5.000 €. Die
Simulation zeigt dasselbe Bild für den mittleren Verlauf, ergänzt es aber um
eine Beobachtung, die die Linie verschluckt: Im Februar fällt der schlechteste
Zehntel-Verlauf auf 2.620 €.

Das ist keine Katastrophe. Aber es ist der Unterschied zwischen „ich kann im
Januar bedenkenlos ein Sofa kaufen" und „ich warte damit bis März". Diese
Auskunft bekommst du aus einer Durchschnittslinie nicht.

## Warum das lokal gerechnet werden kann

Tausend Simulationsläufe über zwölf Monate klingen nach Serverarbeit. Sind sie
nicht: Es sind einige Millionen Additionen, und die erledigt ein Browser in
Sekundenbruchteilen. Deshalb läuft die Prognose in Fintracker vollständig auf
deinem Gerät — es gibt keinen Rechengrund, deine Kontodaten irgendwohin zu
schicken.

Das ist auch der Grund, warum wir bei der Prognose nichts vor eine Anmeldung
stellen. Sie kostet uns keine Serverzeit.

## Was die Simulation nicht kann

Sie kennt nur, was sie gesehen hat. Wenn deine Daten drei Monate umfassen, kennt
sie keine Jahresrechnung, die im elften Monat fällig wird. Sie modelliert
Schwankung, keine Lebensereignisse — ein Jobwechsel oder ein Umzug ändert die
Grundlage, nicht die Streuung. Und sie liefert Wahrscheinlichkeiten, keine
Zusagen: Ein P10-Wert von 2.620 € heißt nicht, dass du nie darunter fällst.

Für die geplanten Brüche gibt es deshalb Stresstests als eigene Szenarien —
Jobverlust, Großreparatur, Mieterhöhung — die du bewusst durchrechnest, statt
darauf zu hoffen, dass die Simulation sie errät.
