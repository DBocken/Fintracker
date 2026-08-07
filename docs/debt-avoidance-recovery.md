# Schulden, Vermeidungsverhalten und der Sanfte Modus — Vorüberlegungen

Status: **noch nicht implementiert.** Diese Datei hält die Vorüberlegungen fest,
damit sie bei der Umsetzung nicht neu erarbeitet werden müssen und die bereits
getroffenen Entscheidungen nicht versehentlich untergraben werden.

Vor jeder Arbeit am **Sanften Modus** (`src/lib/gentle-mode.ts`,
`gentle_mode` in `src/types.ts`), am **Schulden-Bereich** (`/debts`) oder an
einer **Nutzerbefragung**: diese Datei zuerst lesen, zusammen mit
`docs/onboarding-life-situations.md` (dort wird `gentle_mode` vorgeschlagen)
und `docs/RDG_TEXTREGELN.md` (Grenze zwischen Information und Beratung).

## Das Ziel

Bei Schulden ist die Mathematik nicht das Problem. Tilgungspläne sind gelöst.
Das Problem ist, jemanden überhaupt wieder in Kontakt mit seiner finanziellen
Lage zu bringen — **ohne ihn dabei erneut in die Vermeidung zu treiben**.

Der Sanfte Modus ist heute die halbe Antwort darauf. Diese Datei beschreibt die
fehlende zweite Hälfte: einen **Weg zurück** zur Zahl. Und sie zieht die Grenze
zu dem, was daraus **nicht** werden darf — weder ein Therapieversprechen noch
eine Werbeaussage, die keine Erhebung trägt.

## 1. Der Befund

Vier Punkte, die in der Forschung getrennt untersucht sind und die zusammen die
Kette ergeben, gegen die diese App arbeitet:

| Beobachtung | Quelle | Belastbarkeit |
|---|---|---|
| Aufmerksamkeit für das eigene Konto **sinkt**, sobald es ins Minus geht, und sinkt weiter, je höher der Dispo wird — gemessen an echten Logins in Bankdaten | Olafsson & Pagel, *The Ostrich in Us*, Review of Economics and Statistics | hoch: Feldverhalten, keine Selbstauskunft |
| Finanzielle **Scham** erzeugt Rückzug (Rechnungen nicht öffnen, Anrufe nicht annehmen, niemanden fragen), Rückzug verschlechtert die Lage, die Lage verstärkt die Scham | Gladstone, Jachimowicz, Greenberg & Galinsky 2021, OBHDP 167, 42–56 (sechs Studien, darunter längsschnittliche und experimentelle) | hoch; **Schuld** wirkt ausdrücklich anders als **Scham** und erzeugt diesen Rückzug nicht |
| Wiederholte **Annäherung** an das Vermiedene statt Vermeidung ist der Wirkmechanismus von Expositionsverfahren — entscheidend ist, dass dabei etwas Neues gelernt wird („ich halte das aus") | Craske et al. 2014, *Maximizing exposure therapy: an inhibitory learning approach*, Behaviour Research and Therapy 58, 10–23 | hoch **für Angststörungen**; die Übertragung auf Schulden ist eine Ableitung, kein Befund |
| **Konkrete Wenn-Dann-Vorsätze** („wenn ich heute um 18 Uhr heimkomme, öffne ich einen Brief") wirken stark auf die Zielerreichung — auch bei psychisch belasteten Menschen | Toli, Webb & Hardy 2016, British Journal of Clinical Psychology (d+ = 0,99; k = 28; N = 1.636) | hoch für den Mechanismus; **nicht** an Schulden erhoben |
| Wer seinen **Fortschritt häufiger sieht**, erreicht sein Ziel eher | Harkin et al. 2016, Psychological Bulletin 142(2), 198–229 (k = 138; N = 19.951) | hoch, mittlerer Effekt |
| Digitale Intervention speziell bei Geldsorgen (*Space from Money Worries*, Online-KVT) ist annehmbar und zeigt Verbesserungen | Richardson et al. 2022, Frontiers in Public Health (23 von 30 abgeschlossen) | **schwach**: keine Kontrollgruppe, sehr kleine Stichprobe — zeigt Machbarkeit, nicht Wirksamkeit |

Zwei Ableitungen daraus, die das Produkt unmittelbar betreffen:

- **„Du hast deine Finanzen seit 23 Tagen nicht überprüft" ist die falsche
  Nachricht.** Sie adressiert genau das Gefühl, das die Person vertrieben hat.
  Richtig ist die Begrüßung ohne Bilanz: *„Schön, dass du wieder da bist."*
- **Der Coach lobt nicht ins Leere.** Gladstone et al. haben in Studie 6 nicht
  „du schaffst das" getestet, sondern das Bekräftigen **eigener freundlicher
  Handlungen** — und damit den Rückzug bei stark schambelasteten Menschen
  gesenkt. Was daraus für Fintracker folgt, ist keine Motivationssprache,
  sondern das Trennen von Person und Lage, unmittelbar gefolgt von einer
  Handlung. Nicht „du schaffst das", sondern: *„Deine Schulden beschreiben
  eine Lage, nicht deinen Wert. Lass uns einen Brief öffnen."*

### Was hier ausdrücklich nicht behauptet wird

Die zugrunde liegenden **Mechanismen** sind gut belegt. Dass **diese konkrete
Ausgestaltung in Fintracker** den erhofften Effekt hat, ist nicht belegt und
kann es ohne eigene Untersuchung auch nicht sein. Kein Text in der App und kein
Text über die App darf das Gegenteil nahelegen — siehe §5.

Und: Fintracker ist keine Therapie und darf sich nicht so anhören. Der
Mechanismus der schrittweisen Annäherung wird übernommen, sein **Vokabular
nicht**. In der Oberfläche steht nie „Exposition", „Übung", „Therapie",
„Angst". Diese Grenze läuft parallel zu der, die `docs/RDG_TEXTREGELN.md` für
die Rechtsberatung zieht, und zu `CounselingBridgeCard`: Fintracker informiert
und vermittelt weiter, es behandelt nicht.

## 2. Die Korrektur am Sanften Modus

### Was er heute ist

Ein globaler Schalter (`gentle_mode?: boolean`), der jeden formatierten Betrag
durch `***` ersetzt (`maskAmount`, benutzt über `useMoneyFormat`). Vorgeschlagen
wird er beim Onboarding für `student_school`, `student_university`,
`single_parent` und `debt_focus`. Die Begründung im Code ist richtig und bleibt
gültig: emotionale Entlastung, nicht Vertraulichkeit — man versteckt die Zahlen
vor **sich**, nicht vor anderen.

### Der Fehler, der darin steckt

Ein Modus ohne Rückweg ist strukturell ein Versteck. Wer die App drei Jahre lang
nur mit `***` benutzt, lernt nicht „ich kann mich damit beschäftigen", sondern
„ich kann Finanzen nur ertragen, solange ich die Zahlen nicht sehe" — die
Maske wird zum Sicherheitsverhalten. Der Sanfte Modus wäre dann die eleganteste
Vermeidungsstrategie, die diese App je gebaut hat.

Das ist eine Übertragung aus der Expositionsforschung, kein Befund über
Finanz-Apps. Sie ist aber billig zu berücksichtigen und teuer zu ignorieren.

### Die Entscheidung

**Der Sanfte Modus bleibt an einer Stelle, wird aber ordinal statt binär.**
`***` ist der Anfang, nicht zwingend der Endzustand.

Vier Stufen, geordnet danach, wie sehr die jeweilige Zahl weh tut — die am
wenigsten belastende zuerst:

| Stufe | Name | Sichtbar | Nicht sichtbar |
|---|---|---|---|
| 3 | Ankunft | nichts | alle Beträge |
| 2 | Nächster Schritt | der **eine** als Nächstes fällige Betrag (die Rate) | Summen, Salden, Gesamtschuld |
| 1 | Verlauf | Einzelbeträge und Fortschritt | die **Gesamtschuld** |
| 0 | aus | alles | — |

Die Reihenfolge ist der Kern: Zuerst wird die Zahl sichtbar, die man zum
**Handeln** braucht (§1, Wenn-Dann-Vorsatz), dann die, die **Fortschritt**
zeigt (§1, Harkin), und zuletzt die, die am meisten Scham trägt.

Vier Festlegungen dazu, die nicht verhandelbar sind:

1. **Die App demaskiert nie von selbst.** Sie *fragt* — „Möchtest du heute eine
   Zahl mehr sehen?" —, und zwar an einem ruhigen Zeitpunkt, nicht mitten in
   einer Aufgabe. Ein Modus, der sich selbst abschaltet, erzeugt genau den
   Schreck, den er verhindern soll, und ist ein Vertrauensbruch obendrein.
2. **Die Leiter geht in beide Richtungen.** Zurück auf Stufe 3 ist jederzeit
   möglich, kostet keinen Kommentar und wird nirgends als Rückschritt gewertet.
   Es gibt keine „Strähne", die dabei reißt.
3. **Die Frage kommt selten und hört auf.** Zweimal abgelehnt heißt: für diesen
   Zustand nicht mehr fragen, bis der Nutzer selbst etwas ändert. Eine
   wiederholte Einladung ist Nötigung mit freundlicher Stimme.
4. **Der Anlass für die Frage ist ein Ereignis, kein Kalender.** „Du hast
   inzwischen 8 von 10 Forderungen erfasst — möchtest du deine Gesamtlage
   sehen?" ist eine Einladung. „Es sind 30 Tage vergangen" ist eine Mahnung.

### Was das technisch heißt

Heute ist `gentle_mode` ein persistiertes `boolean`. Der **letzte günstige
Zeitpunkt**, das zu ändern, ist vor der Umsetzung der Leiter: danach hängt an
dem Feld eine Bedeutungsskala, und jede Änderung ist eine Datenmigration statt
einer Textersetzung.

Empfehlung: **ein** ordinales Feld statt zweier Felder — ein Boolean *und* eine
Stufe wären zwei Wahrheiten über denselben Sachverhalt und würden
auseinanderlaufen.

```
gentle_level: 0 | 1 | 2 | 3        // 0 = aus
masked = gentle_level > 0          // ersetzt jede heutige Abfrage von gentle_mode
Migration: true → 3, false/undefined → 0
```

`maskAmount` bekommt dazu die **Klasse** des Betrags, den es verdeckt
(`'total' | 'installment' | 'progress'`). Die Voreinstellung ist die am
stärksten geschützte Klasse: Eine Aufrufstelle, die nichts angibt, bleibt auf
jeder Stufe > 0 maskiert. Ein vergessenes Argument darf nie zu einer
unerwartet sichtbaren Zahl führen — der Fehler muss in Richtung Maske fallen.

Das Plattform-Prinzip (AGENTS.md §4) gilt unverändert: gleiche Stufe, gleiche
Berechnung, gleiches ViewModel auf Mobile und Desktop.

## 3. Die Leiter über den Sanften Modus hinaus

Die Stufen oben verdecken Zahlen. Die eigentliche Annäherung ist die Kette der
**Handlungen** davor — von „App öffnen" bis „Gesamtlage ansehen". Sie gehört
nicht in ein neues Benachrichtigungswesen, sondern dahin, wo bereits „das wäre
jetzt dein nächster Schritt" lebt: in den `coach-service`
(`docs/tutorial-sequence.md`).

Regeln dafür:

- **Ein** Schritt zur Zeit. Keine Liste. Eine Liste offener Forderungen ist die
  Gesamtschuld in anderer Schreibweise.
- Der Schritt ist konkret genug, um ihn zu tun, ohne zu entscheiden: „einen
  Brief öffnen", nicht „Schulden erfassen".
- Er darf mit einem Zeitpunkt versehen werden können (Wenn-Dann, §1). Freiwillig.
- Was schon geht, wird benutzt: `ClaimImportDialog` (Brief erfassen),
  `DebtSuggestionsBanner`, `CounselingBridgeCard` (der Schritt, der aus der App
  hinausführt — und der bei Überschuldung der *richtige* nächste Schritt ist,
  nicht die nächste Rate).

Und die Fortschrittsrückmeldung ist bereits Hausregel: Visualisierte Daten
poppen nicht auf, sie werden aufgebaut (AGENTS.md §9). „Diesen Monat 2,1 %
geschafft" ist genau der Fall, für den diese Regel existiert — mit
`prefers-reduced-motion` und ohne Konfetti.

## 4. Die Umfrage

Der Gedanke ist richtig: Was hier gebaut wird, ist ohne Rückmeldung der
Betroffenen nicht beurteilbar. Nur ist eine Umfrage in dieser App kein
Formular, sondern der **erste Inhalt über einen Menschen, der das Gerät
verlässt**. Bisher gilt: Beträge dürfen es nicht (`decision-log` F-1,
`src/lib/telemetry-events.ts`), die Ereignisliste ist geschlossen, und
`src/security/telemetry.security.test.ts` bewacht das.

Damit eine Befragung dieses Versprechen nicht aufweicht:

| Regel | Warum |
|---|---|
| **Geschlossene Antwortmenge**, keine Freitexte | Ein Freitextfeld ist die Stelle, an der jemand hilfsbereit „bei meinen 12.400 € …" schreibt. Freitext gibt es weiterhin — über `src/lib/feedback.ts` mit Erkennen/Zeigen/Ersetzen, nicht über die Umfrage |
| **Keine Beträge, auch nicht in Stufen** | „Wie hoch waren deine Schulden?" ist ein Betrag mit gröberer Auflösung, kein anderes Datum |
| **Selbstauskunft, niemals abgeleitet** | „30 % sind schuldenfrei" darf **nicht** aus IndexedDB berechnet werden. Das wäre der Bruch, den die ganze Architektur verhindern soll — und obendrein der Punkt, an dem die App etwas über jemanden weiß, das er selbst nicht gesagt hat |
| **Eigenes Opt-in**, getrennt vom Telemetrie-Flag | Wer Absturzberichte erlaubt, hat damit nicht erlaubt, zu seiner Schuldensituation befragt zu werden. Zwei Fragen, zwei Antworten |
| **Nie im Moment der Belastung fragen** | Nicht beim ersten Öffnen von `/debts`, nicht nach einer Mahnung, nicht während `gentle_level = 3`. Eine Befragung, die den Rückzug auslöst, misst ihn nicht mehr |
| **Kein Anreiz, keine Kopplung an Funktionen** | Ein bezahlter Fragebogen liefert die Antwort, die bezahlt wird |

### Zur Kopplung mit dem Stimmungstracker

Der existiert heute nicht — `useGlobalAtmosphere` ist die *Stimmung der
Oberfläche*, nicht die des Nutzers. Bevor gekoppelt wird, gehört Folgendes
entschieden: Angaben zum seelischen Befinden sind in der DSGVO nicht
irgendwelche Daten, sondern liegen mindestens in der Nähe von Art. 9
(Gesundheitsdaten). **Empfehlung: Stimmungsdaten bleiben ausnahmslos auf dem
Gerät und werden nie versendet — auch nicht aggregiert, auch nicht mit
Zustimmung.** Der Erkenntnisgewinn einer versendeten Stimmungskurve steht in
keinem Verhältnis zu dem, was ihr Verlust bedeutet. Lokal ausgewertet
(„an Tagen, an denen du dich schlecht fühlst, schaust du seltener rein") ist
sie dagegen unbedenklich und für den Nutzer wertvoller als für uns.

## 5. Werbeversprechen — was davon trägt

Hier ist der Einwand, und er ist ernst gemeint: **Die skizzierten Aussagen
wären in dieser Form nicht haltbar.** Nicht weil sie unfreundlich wären,
sondern weil sie mehr behaupten, als eine App-interne Befragung je zeigen kann.

Drei Gründe, unabhängig voneinander:

1. **Selbstselektion.** Wer aufgegeben hat, deinstalliert und antwortet nicht.
   Eine In-App-Befragung befragt strukturell die Erfolgreichen. Genau deshalb
   käme „100 %" heraus — und genau deshalb bedeutet es nichts.
2. **Keine Kontrollgruppe.** Menschen, die eine Schulden-App installieren,
   haben sich bereits entschieden, etwas zu ändern. Ohne Vergleich ist nicht
   trennbar, was die App bewirkt hat und was der Entschluss.
3. **Rechtlich.** Eine Wirkungsaussage in der Werbung muss belegbar sein
   (§ 5 UWG; wer mit Untersuchungsergebnissen wirbt, muss die Untersuchung
   offenlegen können). „100 % konnten Schulden reduzieren" ist zudem die
   gefährlichste denkbare Zahl: Sie liest sich als „wirkt immer".

Was trägt, ist die Verschiebung von einer **Wirkungsaussage** zu einer
**Aussage über die Befragung** — mit Nenner, Zeitraum und Methode:

| ❌ nicht haltbar | ✅ haltbar |
|---|---|
| „100 % konnten Schulden reduzieren" | „Von 214 Menschen, die uns nach drei Monaten geantwortet haben, sagten 68 %, ihre Schulden seien seither kleiner geworden." |
| „90 % finden es gut, langsam herangeführt zu werden" | „9 von 10 Befragten möchten sich den Zahlen lieber schrittweise nähern." (Präferenz, keine Wirkung — die unkritischste der vier Aussagen) |
| „50 % trauen sich mittlerweile die Zahlen anzuschauen" | „Jede zweite befragte Person sagt, sie schaue sich inzwischen Beträge an, die sie anfangs verdeckt hatte." **Das ist die interessanteste Aussage**, weil sie genau den Mechanismus betrifft, den das Produkt behauptet — und sie ist Selbstauskunft über sich selbst, nicht über die App |
| „30 % sind bereits schuldenfrei" | nur mit Nenner **und** Zeitraum, und niemals aus den Daten gerechnet (§4) |

Damit eine solche Aussage später überhaupt verwendbar ist, muss **vor** der
ersten Erhebung feststehen:

- der **Wortlaut** der Fragen (sonst wird hinterher der schmeichelhafteste
  Zuschnitt gewählt — genau das macht eine Zahl wertlos),
- der **Nenner**: alle Befragten, nicht alle Antwortenden,
- eine öffentlich einsehbare **Methodenseite**: Zeitraum, N, Rücklaufquote,
  Erhebungsart, ausdrücklich „Selbstauskunft, keine Kontrollgruppe",
- der Verzicht auf jede **Kausalformulierung**: „nach der Nutzung", nicht
  „durch Fintracker".

**Empfehlung:** Die stärkste Aussage ist ohnehin keine Prozentzahl, sondern der
Mechanismus selbst — *„Du musst die Gesamtsumme nicht ansehen. Deine nächste
Rate sind 120 €. Darum kümmern wir uns heute."* Das ist überprüfbar, weil die
App es tut, und es spricht die Menschen an, die sich von jeder Erfolgsstatistik
ohnehin nur gemeint fühlen, solange sie sie nicht betrifft.

## Reihenfolge der Umsetzung

1. **Die Leiter** (`gentle_level` statt `gentle_mode`, Betragsklassen in
   `maskAmount`, Stufenwechsel in den Einstellungen). Hat für sich Wert, ohne
   jede Erhebung, und ist der Punkt, an dem eine Feldänderung noch billig ist.
2. **Die Einladung** (Frage bei Ereignis, zweimal ablehnbar, nie automatisch).
3. **Der nächste kleine Schritt** für `/debts` im `coach-service`.
4. **Die Fortschrittsrückmeldung** (aufbauend animiert, schwellwertbewusst).
5. **Erst dann die Befragung** — mit vorab festgeschriebenem Wortlaut.
6. **Zuletzt die Werbeaussagen**, ausschließlich aus dem, was tatsächlich
   erhoben wurde.

Die Schritte 1–4 verbessern das Produkt unabhängig davon, ob je eine Umfrage
läuft. Die Schritte 5–6 sind ohne 1–4 gegenstandslos: Es gäbe nichts zu messen.

## Quellen

Die folgenden Arbeiten wurden für dieses Dokument in ihren Kernangaben
gegengeprüft (Titel, Ort der Veröffentlichung, Stichprobengrößen). Die
Übertragung auf Fintracker ist in jedem Fall unsere, nicht ihre.

- Olafsson, A. & Pagel, M.: *The Ostrich in Us: Selective Attention to Personal
  Finances.* Review of Economics and Statistics.
  <https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3031896>
- Gladstone, J. J., Jachimowicz, J. M., Greenberg, A. E. & Galinsky, A. D.
  (2021): *Financial shame spirals: How shame intensifies financial hardship.*
  Organizational Behavior and Human Decision Processes 167, 42–56.
  <https://www.sciencedirect.com/science/article/abs/pii/S0749597821000662>
- Craske, M. G. et al. (2014): *Maximizing exposure therapy: An inhibitory
  learning approach.* Behaviour Research and Therapy 58, 10–23.
- Toli, A., Webb, T. L. & Hardy, G. E. (2016): *Does forming implementation
  intentions help people with mental health problems to achieve goals?*
  British Journal of Clinical Psychology.
  <https://bpspsychub.onlinelibrary.wiley.com/doi/10.1111/bjc.12086>
- Harkin, B. et al. (2016): *Does monitoring goal progress promote goal
  attainment? A meta-analysis of the experimental evidence.* Psychological
  Bulletin 142(2), 198–229. <https://www.apa.org/pubs/journals/releases/bul-bul0000025.pdf>
- Richardson, T. et al. (2022): *The Acceptability and Initial Effectiveness of
  „Space From Money Worries".* Frontiers in Public Health.
  <https://pubmed.ncbi.nlm.nih.gov/35493363/>
