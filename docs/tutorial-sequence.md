# Tutorial-Reihenfolge & Datenquellen-Weiche — Vorüberlegungen

Status: **umgesetzt.** Die Umsetzungsreihenfolge am Ende dieser Datei ist
abgearbeitet; die Begründungen bleiben stehen, weil sie erklären, warum der
Code so aussieht, wie er aussieht. Diese Datei beantwortet die Frage, die
`docs/tutorial-progressive-disclosure.md` unter „Vor dem Bauen zu entscheiden"
Punkt 1 offen gelassen hat: **in welcher Reihenfolge** die Module erklärt
werden — und wie sich die Auswahl der Datenquelle (Datei, Bank, Beispieldaten)
darauf auswirkt.

Vorher lesen: `docs/tutorial-progressive-disclosure.md` (die drei Achsen und
die Overlay-Mechanik) und `docs/onboarding-life-situations.md` (die
Bereichsauswahl, auf der die Kapitelliste aufsetzt). Diese Datei setzt beide
voraus und wiederholt sie nicht.

## Einwand vorweg: ein Lehrplan, drei Eingänge — nicht drei Tutorials

Der Auftrag lautete „je nach Auswahl bekomme ich das entsprechende Tutorial".
Wörtlich umgesetzt wären das drei parallele Tutorials. Das ist nicht
empfehlenswert, aus drei Gründen:

1. **Die drei Wege unterscheiden sich nur darin, wie Daten hereinkommen.**
   Sobald Buchungen da sind, ist die App dieselbe. Alles ab „Buchungsliste"
   wäre in drei Fassungen identisch — und würde in drei Fassungen
   auseinanderdriften, sobald sich ein Modul ändert.
2. **Der Preis ist multiplikativ.** Jeder Erklärtext existiert in allen
   `SUPPORTED_LOCALES`. Drei Fassungen × 4 Sprachen sind zwölf Texte pro
   Schritt statt vier — bei geschätzt 45–55 Schritten der Unterschied zwischen
   pflegbar und nicht pflegbar.
3. **Was die Wege wirklich trennt, ist nicht der Inhalt, sondern das Risiko**
   (siehe nächster Abschnitt). Das ist genau ein Kapitel lang, nicht ein
   Tutorial lang.

**Empfehlung: ein Lehrplan, drei Eingangskapitel.** Die Weiche ist „Kapitel 0";
danach laufen alle drei Wege in denselben Kapiteln weiter. Was sich je nach
Weg unterscheidet, ist nicht *welche* Kapitel kommen, sondern **wann sie
kommen können** — das regelt die Datenreife (siehe „Datenreife statt
Schrittzähler"), nicht ein zweiter Lehrplan.

## Kapitel 0 — die Weiche

Die drei Wege tragen je ein anderes Risiko, und genau dieses Risiko ist ihr
Kapitelinhalt. Ein Weg, der sein Risiko nicht erklärt, hat sein Kapitel nicht
verdient.

| Weg | ID | Das Risiko | Was das Kapitel deshalb zeigt |
|---|---|---|---|
| Datei von der Bank | `csv` | Falsche Spaltenzuordnung und Dubletten — beides fällt erst Wochen später auf | Spaltenzuordnung, Vorschau, **Dublettenerkennung**, Bestätigen (`CsvUploader` → `ReviewTable`) |
| Bank verbinden | `bank` | Vertrauen: Was verlässt das Gerät? Und die Zustimmung läuft ab | Bankauswahl, Zustimmung, Kontoauswahl, **was lokal bleibt** (`docs/security-boundaries.md`), Ablauf und Erneuerung der Zustimmung |
| Erst mal umsehen | `demo` | Beispieldaten mit echten verwechseln | Woran man die Demo erkennt (`DemoDataBanner`), dass sie jederzeit rückstandslos verschwindet (Präfix `demo-`), und **wie man sie durch echte Daten ersetzt** |

Alle drei enden an derselben Stelle — dem Zusammenführungspunkt: *„Deine
Buchungen sind da."* Ab hier ist der Lehrplan identisch.

### Die Weiche gehört an den Anfang — und das hat eine Folge

Die Weiche zuerst zu stellen ist richtig, aber nicht nur aus dem naheliegenden
Grund (die Frage ist konkret und unverfänglich, die Lebenssituation ist
persönlich). Der stärkere Grund ist einer, der im Auftrag noch nicht steckte:

> **Nach dem Import kann die App die Lebenssituation vorschlagen, statt sie zu
> erfragen.** Ein erkanntes Gehalt (`detectSalarySeries`), laufende Kreditraten
> (`debt-detection-service`), Kinder-typische Ausgaben — daraus lässt sich eine
> Kachel vorbelegen und Umstände vorschlagen. Fragt man die Lebenssituation
> *vor* dem Import, ist diese Information noch nicht da.

Die Folge, die vor der Umsetzung ausgesprochen gehört: **`OnboardingDialog`
muss dann später auslösen.** Heute öffnet er, solange
`onboarding_life_situation === undefined` ist — also beim ersten Start, vor
allem anderen. Künftig gilt: Kapitel 0 zuerst, Lebenssituation danach, mit
Vorbelegung aus den importierten Daten. Übersprungen werden können muss beides
weiterhin (`null` = gefragt und abgelehnt).

Für den Demo-Weg gilt eine Abweichung: Wer „erst mal umsehen" wählt, hat gesagt,
dass er noch nichts über sich preisgeben will. Die Lebenssituation wird dort
gefragt, aber als *Perspektive auf die Demo* formuliert — und darf ohne
Nachteil übersprungen werden; spätestens beim Wechsel auf echte Daten kommt sie
wieder.

## Der gemeinsame Lehrplan

**Ordnungsprinzip: der Euro durch den Monat, nicht die Navigationsreihenfolge.**
`NAV_GROUPS` ist nach Aufmerksamkeit sortiert (Coach zuerst), nicht nach
Verstehbarkeit. Gelernt wird entlang des Geldflusses: hereinkommen → was fest
weggeht → was steuerbar bleibt → was vorausliegt → worauf es hinausläuft.

| # | Kapitel | Modul | Warum hier | Datenvoraussetzung |
|---|---|---|---|---|
| **Teil 1 — Der Kern & die erste Sitzung** (immer, unabhängig von der Bereichsauswahl) |
| 1 | `transactions` | `/transactions` | Erst prüfen, was da ist. Jede spätere Zahl hängt daran. | ≥ 1 Buchung |
| 2 | `categories` | Kategorien | Ohne Kategorien ist jede Auswertung eine Liste. Kapitel entfällt bei `enable_subcategories: false`. | ≥ 1 unkategorisierte Buchung |
| 3 | `dashboard` | `/dashboard` | Die analytische Antwort: das Sankey zeigt, wohin das Geld fließt. Zugleich der Ort, auf dem der CSV-Import ohnehin landet (`CsvPage` navigiert nach `/dashboard`). | ≥ 20 Buchungen |
| 4 | `city` | `/city` | **Das Finale der ersten Sitzung** — die emotionale Antwort auf dieselben Daten und die sichtbare Belohnung für Kapitel 2: die Stadt ist eine reine Projektion der *kategorisierten* Ausgaben. **Kernbereich, nicht abwählbar** (Details unten). | ≥ 1 kategorisierter Monat |
| 5 | `coach` | `/coach` | Der tägliche Startpunkt — erst sinnvoll, wenn es etwas zu raten gibt. Übernimmt ab hier die Rolle „dein nächster Schritt". | Kern-Kapitel 1–3 durchlaufen |
| 6 | `accounts` | `/accounts` | Salden verankern die Buchungen in der Wirklichkeit; Voraussetzung für jede Vorschau. | ≥ 1 Konto |
| **Teil 2 — Der Euro durch den Monat** (je nach Bereichsauswahl) |
| 7 | `income` | `/income` | Woher kommt es. | `detectSalarySeries`: **3 Monate** |
| 8 | `contracts` | `/contracts` | Was ohne Zutun weggeht. Wird *gefunden*, nicht eingegeben — hoher Ertrag ohne Arbeit. | `detectRecurringTransactions`: **3 gleiche Buchungen** je Zahlungsempfänger |
| 9 | `budgets` | `/budgets` | Erst wenn die Fixkosten stehen, ist der Rest steuerbar. Vorher wäre jedes Limit geraten. | `buildAdaptiveBaseLimit`: **3 Monate**, sonst „lernend" |
| 10 | `liquidity` | `/liquidity` | Die Vorschau lebt von 7–9: Wiederkehrendes plus Saldo. | Saldo + ≥ 1 Wiederkehrendes |
| 11 | `milestones` | `/milestones` | Worauf es hinausläuft — das Ziel nach dem Überblick, nicht davor. | Kapitel 9 durchlaufen |
| **Teil 3 — Sonderlagen** (nur wenn gewählt) |
| 12 | `debts` | `/debts` | Eigene Rechenwelt (Tilgung, Strategie), kein Spezialfall der Ausgaben. | ≥ 1 Schuld oder erkannte Rate |
| 13 | `occasions` | `/occasions` | Klammert Buchungen quer zur Kategorie — setzt Kategorien voraus. | ≥ 1 Anlass oder erkannter Block |
| **Teil 4 — Vermögen & Pflicht** |
| 14 | `netWorth` | `/net-worth` | Bestand statt Fluss — der erste Perspektivwechsel. | ≥ 2 Konten oder ein Vermögenswert |
| 15 | `tax` | `/tax` | Baut auf Kategorien und Anlässen auf. | ≥ 1 absetzbare Kategorie erkannt |
| 16 | `euer` | `/euer` | Setzt Steuer und die Trennung Privat/Geschäft voraus. | `isBusinessModeEnabled` |
| **Teil 5 — Vertiefung** |
| 17 | `premiumReports` | `/premium` | Vergleiche über Zeit brauchen Zeit. | Tier + 3 Monate |
| 18 | `trading` | `/trading` | Eigene Datenquelle, eigener Rhythmus — hängt an keinem vorherigen Kapitel. | Depot verknüpft |
| **Abschluss** (immer) |
| 19 | `export` | `/export` | „Deine Daten gehören dir" — die Aussage wirkt erst, wenn man Daten hat. | — |
| 20 | `settings` | `/settings` | Der Ausgang: alles freischalten, Bereiche, Sprache. Muss das Letzte sein, was man gesehen hat. | — |

Kapitel 19 und 20 laufen **immer**, auch wenn der Nutzer vorher abbricht.
Sonst kennt jemand den Weg zurück nicht — das kippt Behutsamkeit in
Bevormundung (`tutorial-progressive-disclosure.md`, „Der Ausgang muss dauerhaft
sichtbar sein").

### Kapitelgröße

Ein Kapitel = **ein Arbeitsschritt**, nicht ein Bildschirm. Zwei bis acht
Schritte; wo eine Seite mehr Bedienelemente hat, zerfällt sie in mehrere
Kapitel statt in ein langes (Vorbild: `docs/tutorial-script-transactions.md`,
vier Akte über die Buchungsseite). Jedes Kapitel
endet mit **einer echten Handlung** des Nutzers (eine Buchung kategorisieren,
ein Budget setzen, in einen Distrikt der Stadt zoomen), nicht mit „Weiter".
Wer nur gelesen hat, hat nichts gelernt — und die Handlung ist zugleich das
Signal, dass das Kapitel getragen hat.

## Die Finanzstadt: früher Anker statt späte Belohnung

Die Stadt steht als Kapitel 4 im Kern — als **Finale der ersten Sitzung**,
nicht am Ende des Lehrplans. Das ist keine Geschmacksfrage, sondern folgt aus
dem, was die Stadt laut `src/features/finance-city/README.md` *ist*: eine
**reine Projektion** der kategorisierten Ausgaben und erkannten Verträge
(`buildSunburstTree`, `computeContracts`) — Distrikte sind Hauptkategorien,
Gebäude sind Unterkategorien, Etagen sind Händler. Daraus folgt dreierlei:

1. **Sie braucht genau das, was Kapitel 1–2 herstellen — und nicht mehr.**
   Ein einziger kategorisierter Monat reicht für Distrikte und Gebäude; die
   3-Monats-Schwellen von Teil 2 gelten hier nicht. Die Stadt ist damit das
   früheste „Wow", das der Datenstand hergibt — auch auf dem CSV-Weg mit nur
   einem Monat Historie.
2. **Sie macht das mühsamste Kapitel belohnbar.** Kategorisieren ist die
   unattraktivste Pflicht des Onboardings. Mit der Stadt direkt dahinter hat
   die Pflicht ein sichtbares Ergebnis: *deine Zuordnung baut deine Stadt.*
   Kapitel 2 sät, Kapitel 4 erntet — deshalb liegt zwischen beiden nur das
   Dashboard (auf dem der CSV-Import ohnehin landet).
3. **Sie trägt die Rückkehr.** Die Stadt verändert sich mit den Daten weiter:
   nach Kapitel 8 tauchen erkannte Verträge als Gebäude auf, mit jedem Monat
   wachsen Etagen dazu. Das ist der natürliche Grund, wiederzukommen —
   eine Belohnung am Lehrplan-Ende hätte genau diesen Effekt verschenkt.

Dramaturgisch gilt der Peak-End-Effekt: Die erste Sitzung endet mit ihrem
stärksten Bild. Sankey (Kapitel 3) ist die analytische Antwort auf „wohin
fließt mein Geld", die Stadt die emotionale — dieselben Daten, zwei Register,
und das stärkere schließt.

### Stadt-Momente (optionale Ausbaustufe)

An den Teil-Grenzen des Lehrplans kann ein kurzer Rückblick in die Stadt
zeigen, was der abgeschlossene Teil sichtbar verändert hat (nach Teil 2 etwa:
die Abo-Gebäude sind neu). Das ist bewusst **Ausbaustufe, nicht Baseline**:
erst das Kern-Overlay, dann die Momente. Umsetzung als gewöhnlicher
Tutorial-Schritt mit Navigation nach `/city` — three.js bleibt ausschließlich
im `finance-city`-Slice (AGENTS.md §7), das Tutorial bettet nichts ein.

### Die Stadt ist Kernbereich, nicht wählbarer Bereich

Entschieden: Die Finanzstadt ist die **zentrale Darstellung** und deshalb
**immer da** — nicht ein Bereich, den man abwählen kann. Das ist kein neuer
Mechanismus, sondern der bestehende: `/city` gehört in
`ALWAYS_VISIBLE_NAV_PATHS`, zu `/coach`, `/dashboard`, `/transactions`. Ein
wählbarer Bereich wäre der Widerspruch — zentral und optional zugleich gibt es
nicht.

Damit entfällt die Bedingung an Kapitel 4 ersatzlos: kein „nur wenn gewählt",
keine Ergänzung der `features`-Listen, kein Sonderfall in der Reihenfolge. Die
erste Sitzung endet für **jede** Lebenssituation mit der Stadt.

**Was daraus folgt** (Textersetzung jetzt, Migration nach dem Merge — deshalb
hier und nicht später):

| Ort | Änderung |
|---|---|
| `NavFeatureId`, `NAV_FEATURE_PATHS` | `'city'` entfällt — es ist kein wählbarer Bereich mehr |
| `ALWAYS_VISIBLE_NAV_PATHS` | `/city` kommt dazu |
| `LIFE_SITUATIONS` | `city` fällt aus `student_school` und `student_university` heraus (den einzigen beiden, die es führen) — nicht weil es dort weniger gilt, sondern weil Kernbereiche in keiner Liste stehen |
| `FeatureSelection`, `NavFeatureSettings` | die Stadt verschwindet aus der Schalterliste und erscheint in der Aufzählung „Immer dabei" |
| `local-settings-service` | gespeicherte `enabled_nav_features` können `'city'` enthalten — einmalig beim Lesen entfernen |

Die Migration ist der Punkt, an dem es unangenehm werden kann. Zwei Fälle:

- **Gespeichertes `'city'`** ist nach der Änderung ein Fremdwert in einem
  typisierten Array. Wirkungslos ist er schon (`isNavPathVisible` prüft
  `ALWAYS_VISIBLE_NAV_PATHS` vor der Feature-Zuordnung), aber er gehört
  weggeräumt — Präzedenzfall und Ort stehen bereit: dieselbe einmalige
  Aufräumung, die `local-settings-service` heute für `business_mode` macht.
- **Wer die Stadt bewusst abgewählt hat, bekommt sie zurück.** Das ist der
  einzige Fall, in dem ein Update Navigation *hinzufügt* — sonst gilt strikt
  das Gegenteil (`onboarding-life-situations.md`: ein Update darf niemandem
  stillschweigend die halbe Navigation wegnehmen, abgesichert per
  `[REGRESSION]`-Test). Das ist hier gewollt und die direkte Folge der
  Entscheidung, aber es gehört ausgesprochen und in genau diesen Test
  aufgenommen, statt ihn stillschweigend zu umgehen.

### Was Kernbereich zusätzlich verlangt

- **Der Leerzustand wird zur Pflicht.** Als Kernbereich ist `/city` ab Minute
  null erreichbar — auch mit null Buchungen. Dann gilt dieselbe Regel wie für
  alle Hauptseiten: nie eine leere Seite, immer eine konkrete nächste Aktion
  (`FinanceEmptyState`: CSV-Import oder Beispieldaten).
- **WebGL ist kein Ausschlusskriterium mehr** — anders als in der ersten
  Fassung dieses Dokuments angenommen. `CityCanvas` hat bereits einen
  `webglUnavailable`-Fallback und `CityPage` einen Listen-Modus: ohne WebGL
  wird die Stadt zur Liste, nicht zur Fehlermeldung. Das Kapitel läuft
  deshalb auch dort — mit demselben Inhalt, anderer Darstellung
  (Plattform-Prinzip, AGENTS.md §4). Kein Vertagen nötig. `prefers-reduced-motion`
  dämpft die Kamerafahrt, streicht aber nichts: die Stadt ist auch als
  Standbild eine Antwort.
- **Das Bundle trägt es.** `CityPage` ist in `App.tsx` bereits `lazy()`
  geladen; three.js kommt erst beim Öffnen. „Immer sichtbar" heißt nicht
  „immer geladen" — der Kernbereich kostet nichts, solange niemand hingeht.
- **Beide Folgepunkte sind umgesetzt:**
  1. ✅ **Das Beta-Etikett ist gefallen.** Zentrale Darstellung und
     Beta-Kennzeichnung widersprechen sich; wer das Finale des Onboardings
     mit einem Vorbehalt beschriftet, entwertet es. `city.betaBadge` ist aus
     allen Sprachbäumen entfernt.
  2. ✅ **Die Stadt ist vierter Bottom-Nav-Tab** — Heute · Übersicht · Stadt ·
     Buchungen · Mehr. Vier plus „Mehr" ist damit das Maximum.

     Dass dafür die Kernbereichs-Änderung nötig war, hat ein bestehender
     `[REGRESSION]`-Test bewiesen: Er sichert zu, dass die Bottom-Nav **nie**
     ein Ziel verliert — und das ist nur für Kernbereiche haltbar. „Stadt in
     die Leiste" ohne „Stadt ist Kernbereich" war also gar nicht baubar.
     `getBottomNavItems` prüft jetzt trotzdem beide Achsen: für die heutigen
     Ziele wirkungslos, aber Vorsorge für jeden künftigen Eintrag.
- **Sanfter Ton bleibt möglich.** Die Stadt zeigt *Ausgaben*, nicht Vermögen —
  anders als das Nettovermögen ist sie in `debt_focus` und `gentle_mode` kein
  Hohn, sondern die verständlichste Antwort auf „wo ist mein Geld
  geblieben". Was dort angepasst gehört, ist der Ton der Begleittexte, nicht
  die Sichtbarkeit.

## Datenreife statt Schrittzähler

Der wichtigste Befund aus dem Bestand: **die halbe App wird erst bei drei
Monaten Historie wahr.** Das ist keine Designentscheidung des Tutorials,
sondern steht bereits im Code:

| Ort | Schwelle |
|---|---|
| `salary-detection.ts` | `MIN_MONTHS = 3` |
| `contract-detection-service.ts` | `payeeTxns.length < 3` → kein Muster |
| `budget-adaptive.ts` | `minMonths` Default 3, Saison ab 12 |

Daraus folgt die härteste Regel des Lehrplans:

> **Kein Tutorial-Schritt auf einem Modul ohne Daten.** Ein leerer Bildschirm
> mit Rahmen und Erklärtext lehrt nichts, er beschädigt das Vertrauen in die
> Erklärung. Ist die Voraussetzung nicht erfüllt, wird das Kapitel
> **vertagt** — nicht übersprungen, nicht leer gezeigt.

Das ist auch die Antwort auf die offene Frage 2 aus
`tutorial-progressive-disclosure.md` („Auslöser"): **vertagte Kapitel gehören
dem Coach.** `coach-service` und `milestones-service` sind bereits der Ort für
„das wäre jetzt dein nächster Schritt"; ein vertagtes Kapitel wird dort zur
Karte, sobald seine Voraussetzung eintritt. Keine zweite Benachrichtigungswelt.

### Was das je Weg konkret bedeutet

| Weg | Historie beim Start | Lehrplan-Verlauf |
|---|---|---|
| `demo` | **exakt 3 Monate** (`buildDemoDataset(now, months = 3)`) | Alle Voraussetzungen erfüllt. Als einziger Weg **komplett am Stück durchlaufbar** — genau dafür ist er da. |
| `bank` | in der Regel am meisten (`gocardless-sync-service` fragt bis zu 730 Tage an, die Bank liefert meist 90) | Meist vollständig; Teil 2 ist ab Tag 1 echt. |
| `csv` | was in der Datei steht — oft ein einziger Monat | Teil 1 läuft vollständig, **inklusive Stadt** (ein kategorisierter Monat reicht). Teil 2 vertagt sich größtenteils — ehrlich benennen: *„Das kommt zurück, sobald du drei Monate beisammen hast."* |

Der Demo-Weg ist damit nicht der Weg für Ungeduldige, sondern der einzige, auf
dem der Lehrplan garantiert vollständig zeigbar ist. Das ist ein Argument
dafür, ihn prominent anzubieten — und eine Warnung: **sinkt `months` in
`buildDemoDataset` unter 3, fallen Einkommenserkennung, Vertragserkennung und
adaptive Budgets im Demo-Tutorial still aus.** Ein Test sollte diese Kopplung
festhalten, sonst bricht sie unbemerkt.

## Abweichungen je Lebenssituation

Naheliegend wäre, die `features`-Listen in `src/lib/life-situations.ts` als
Lernreihenfolge zu lesen (so der Vorschlag in
`tutorial-progressive-disclosure.md`). **Davon ist abzuraten**, aus zwei
Gründen:

1. `resolveFeatureSelection` sortiert das Ergebnis ohnehin nach `FEATURE_ORDER`
   — eine Reihenfolge in den `features`-Arrays käme nie an. Sie *doch*
   durchzureichen hieße, die Sortierung der Onboarding-Anzeige aufzugeben, die
   bewusst der Navigation folgt.
2. Zehn Lebenssituationen wären zehn Orte, die bei jedem neuen Modul
   nachgezogen werden müssen. Vergisst man einen, fehlt das Modul im Tutorial
   still.

**Empfehlung: eine globale Lernreihenfolge, plus je Lebenssituation höchstens
ein bis zwei vorgezogene Kapitel.** Was für eine Situation *zuerst* zählt, ist
kurz und stabil; alles andere folgt der globalen Ordnung.

| Lebenssituation | vorgezogen | Grund |
|---|---|---|
| `debt_focus` | `debts` | Wer bis zum Monatsende kommen muss, lernt nicht erst Einkommensanalyse. |
| `single_parent` | `debts`, `liquidity` | Ein Einkommen trägt alles — die tagesgenaue Vorschau ist die Kernfrage. |
| `self_employed`, `creator` | `tax`, `euer` | Die Rücklage ist das Erste, was schiefgeht. |
| `family` | `occasions` | Der Schmerz sind die großen unregelmäßigen Ausgaben, nicht die Fixkosten. |
| `retired` | `netWorth` | Vermögens*verzehr* ist die Leitfrage, nicht Aufbau. |
| `student_school` | — | Bewusst der schlankeste Lehrplan: vier Kapitel plus Kern. |

Vorziehen darf nur **umsortieren, nie hinzufügen**: ein Kapitel zu einem nicht
gewählten Bereich entsteht dadurch nicht. Dieselbe Begründung wie bei den
Modifikatoren in `onboarding-life-situations.md` — sonst hinge das Ergebnis von
der Klickreihenfolge ab.

## Wo die Reihenfolge im Code lebt

Eine Quelle, reine Domänenschicht (AGENTS.md §3), kein React, kein I/O:

```ts
// src/lib/tutorial-sequence.ts
export type TutorialChapterId = 'transactions' | 'categories' | /* … */ | 'settings';

export interface TutorialChapter {
  id: TutorialChapterId;
  /** Bereich, dessen Freischaltung dieses Kapitel trägt. null = Kernkapitel. */
  feature: NavFeatureId | null;
  /** Erfüllt? Reine Funktion über eine Reifekennzahl — kein Service-Zugriff. */
  requires: (readiness: DataReadiness) => boolean;
}

/** Die globale Lernreihenfolge. Genau EIN Ort. */
export const TUTORIAL_ORDER: readonly TutorialChapter[] = [/* … */];

/** Gewählte Bereiche + Lebenssituation + Datenreife → die konkrete Kapitelfolge. */
export function buildCurriculum(input: {
  enabledFeatures: readonly NavFeatureId[] | null;
  lifeSituation: LifeSituationId | null;
  readiness: DataReadiness;
}): { next: TutorialChapterId[]; postponed: TutorialChapterId[] };
```

`DataReadiness` (Monate Historie, Buchungszahl, Kontenzahl, erkannte Verträge …)
wird in der Service-Schicht einmal erhoben und als Wert hineingereicht. Damit
bleibt `buildCurriculum` pur und ohne Mock testbar.

**Persistenz** (lokal, wie alle Einstellungen), additiv zu den bestehenden
Feldern:

| Feld | Bedeutung |
|---|---|
| `tutorial_source` | `'csv' \| 'bank' \| 'demo' \| null` — der in Kapitel 0 gewählte Weg. `null` = übersprungen. |
| `tutorial_completed_chapters` | abgeschlossene Kapitel-IDs |
| `unlocked_features` | die Freischaltungs-Achse aus `tutorial-progressive-disclosure.md` — **bleibt getrennt**, siehe dort |

`postponed` wird **nicht** gespeichert: es ist jederzeit aus Reihenfolge minus
abgeschlossen minus Datenreife ableitbar. Gespeicherte Ableitungen laufen
auseinander.

`tutorial_source` ist bewusst *nicht* dasselbe wie „welche Daten liegen
tatsächlich vor" (`isDemoDataActive()`, Kontenbestand) — jemand kann „Bank"
wählen und abbrechen. Gespeichert wird der gewählte Weg, damit ein
unterbrochenes Tutorial an derselben Stelle weitergeht; entschieden wird über
Sichtbarkeit weiterhin anhand der echten Daten.

## Bezeichnungen und Sprachen

Beides war ausdrücklich Teil des Auftrags („Bezeichnungen passe ich noch an",
„in verschiedenen Sprachen möglich"). Beides trifft dieselbe Stelle: **der Text
darf nirgends die Struktur tragen.**

- **IDs sind der Vertrag, nicht die Beschriftung.** `csv`, `bank`, `demo`,
  `contracts` bleiben, auch wenn die sichtbaren Namen sich dreimal ändern. Eine
  ID wandert in gespeicherten Fortschritt und ist danach nur noch mit Migration
  änderbar — Beschriftungen sind bis zuletzt frei.
- **Kein String im Kapitel-Code.** Ausschließlich Schlüssel, mechanisch aus der
  ID: `tutorial.<chapterId>.<stepId>.title` / `.body`. Damit ist der Sweep über
  `pnpm check:i18n` vollständig, ohne Sonderregel.
- **Modulnamen im Erklärtext werden nicht abgeschrieben, sondern referenziert.**
  Steht im Schritttext „Abos & Verträge", existiert das Wort zweimal und driftet
  beim Umbenennen. Stattdessen den bestehenden Navigationsschlüssel einsetzen
  (`nav.items.contracts` als Platzhalterwert). Dann folgt das Tutorial jeder
  Umbenennung von selbst — genau der Fall, der hier ansteht.
- **Platzhalter statt Satzbau aus Teilen.** `{count}`, `{month}`, `{amount}`
  im Schlüssel; nie `t('a') + ' ' + t('b')`. Deutsch, Englisch, Russisch und
  Klingonisch stellen Sätze verschieden — zusammengesetzte Sätze sind in
  mindestens einer Sprache falsch.
- **Der Anker ist ein Marker, kein Text.** `data-tour-id`, nie „das Element mit
  der Aufschrift X". Eine Umbenennung würde sonst die Führung still brechen —
  dasselbe Risiko, das `tutorial-progressive-disclosure.md` schon für Refactors
  benennt. Fehlender Anker: Schritt überspringen, nie blockieren.
- **Platz für Längenunterschiede.** Deutsche Texte laufen ~30 % länger als
  englische, russische ähnlich. Das Popup braucht variable Höhe (2–5 Zeilen),
  auf 375 px scrollt das Bottom Sheet. Keine festen Höhen, kein Text in Buttons,
  der nicht umbrechen darf.
- **Alle `SUPPORTED_LOCALES`, nicht nur zwei.** Aktuell `de`, `en`, `tlh`, `ru`.
  Komponententests bilingual über `@/test-utils/render` (AGENTS.md §6).

### Drei Ebenen von „Bezeichnung" — nur eine davon ist gefährlich

Weil die Beschriftungen parallel und an anderer Stelle überarbeitet werden,
muss unterscheidbar sein, was eine Umbenennung jeweils kostet. Es sind drei
verschiedene Dinge, die im Deutschen alle „Bezeichnung" heißen:

| Ebene | Beispiel | Wer darf wann ändern | Kosten |
|---|---|---|---|
| **1. Sichtbarer Text** | der Wert `'Abos & Verträge'` in `translations.ts` | jederzeit, ohne Rücksprache | keine — das Tutorial zeigt ihn, kennt ihn aber nicht |
| **2. i18n-Schlüssel** | der Pfad `nav.items.contracts` | jederzeit, aber **Referenzen im selben PR nachziehen** | gering, wenn bemerkt — sonst stiller Anzeigefehler |
| **3. ID / Route / persistierter Wert** | `NavFeatureId 'contracts'`, `/contracts`, `tutorial_source: 'csv'`, Kapitel-IDs | vor dem Merge frei, danach nur mit Migration | hoch |

**Ebene 1 ist der Normalfall und berührt das Tutorial nie.** Genau dafür ist
die Regel oben da: Modulnamen werden im Schritttext referenziert, nicht
abgeschrieben. Wird aus „Abos & Verträge" morgen „Fixkosten", ändert sich der
Tutorial-Text mit, ohne dass jemand ihn anfasst.

**Ebene 2 ist die einzige echte Kollisionsstelle.** Und sie ist tückisch, weil
sie nicht knallt: `t()` gibt bei unbekanntem Schlüssel den Schlüssel selbst
zurück (`I18nProvider.tsx`, `lookupTranslation(...) ?? fallback ?? key`). Ein
umbenannter Schlüssel erzeugt also keinen Fehler, sondern ein Popup, in dem
wörtlich `nav.items.contracts` steht. `pnpm check:i18n` fängt das nicht — es
prüft Symmetrie zwischen den Locales und hardcodierte Strings im Diff, nicht,
ob eine Referenz noch existiert.

> **Deshalb Pflicht mit dem ersten Tutorial-Code:** ein Test, der über alle
> Kapitel läuft und für **jeden** referenzierten Schlüssel — den eigenen
> `tutorial.*` wie den geliehenen `nav.items.*` — prüft, dass er in **allen**
> `SUPPORTED_LOCALES` auflösbar ist. Das ist das Sicherheitsnetz, das die
> Zusage „Beschriftungen sind jederzeit frei" überhaupt erst wahr macht: Eine
> Umbenennung auf Ebene 1 kann dann nichts kaputt machen, und eine auf Ebene 2
> wird rot statt still.

**Ebene 3 gehört nicht in die Umbenennungs-Runde.** IDs sind kein sichtbarer
Text; sie stehen in gespeichertem Fortschritt und in Routen. Wer die
sichtbaren Namen überarbeitet, fasst sie nicht an — und umgekehrt sollte eine
gute neue Beschriftung nie daran scheitern, dass die ID technisch klingt. Das
ist der ganze Zweck der Trennung.

### Zur Benennung der drei Wege

Die folgenden Formulierungen sind **Vorschläge auf Ebene 1 und damit nicht
bindend** — läuft parallel eine Überarbeitung der Beschriftungen, gilt deren
Ergebnis. Verbindlich sind hier nur die IDs in der linken Spalte; sie bleiben,
was auch immer rechts danebensteht.

Das Prinzip dahinter ist aber eine Empfehlung: benannt wird nach dem, was der
Nutzer **hat**, nicht nach der Technik. „CSV" ist ein Dateiformat, kein
Nutzerbedürfnis — wer nicht weiß, was CSV ist, hat vielleicht trotzdem einen
Kontoauszug zum Herunterladen.

| ID (verbindlich) | Vorschlag DE (unverbindlich) | statt |
|---|---|---|
| `csv` | „Ich habe eine Datei von meiner Bank" | „CSV-Import" |
| `bank` | „Meine Bank direkt verbinden" | „GoCardless / Bankimport" |
| `demo` | „Erst mal umsehen" | „Demo-Modus" |

### Der Sprachstil ist eine vierte Achse — und das Tutorial ist ihr bester Ort

Seit PR #269 gibt es neben der Sprache eine zweite Text-Achse: `wording`
(`src/i18n/wording.ts`), `everyday` (Standard) gegen `technical`. Der Basisbaum
in `translations.ts` **ist** das fachliche Register; `everyday` kommt als
Overlay darüber, das nie einen neuen Schlüssel einführt, sondern nur Werte
ersetzt (`src/i18n/overlays/`).

Für den Aufbau des Tutorials ändert das **nichts** — und das ist die
Bestätigung, nicht der Zufall: Der Sprachstil landet vollständig auf Ebene 1
der Tabelle oben (sichtbarer Text). Kapitel-IDs, Reihenfolge, Datenreife und
Anker bleiben unberührt. Tutorial-Texte werden geschrieben wie jeder andere
Text auch: Basiswert fachlich, Alltagsfassung als Overlay.

Inhaltlich ist es dagegen ein Gewinn, den man aktiv nutzen sollte:

- **Das Tutorial ist die Stelle, an der ein Begriff zum ersten Mal fällt.**
  Genau dafür gibt es `otherWording()` — die Gegenüberstellung „im Alltag: … /
  fachlich: …". Ein Kapitel kann den Fachbegriff also *nebenbei mitgeben*,
  statt ihn zu ersetzen: Wer im Alltagsregister liest, lernt „Was gerade
  verfügbar ist" und erfährt zugleich, dass das anderswo Liquidität heißt.
  Das ist mehr, als eine der beiden Fassungen allein leisten kann.
- **Das Glossar ist die natürliche Verlinkung.** `src/i18n/glossary.ts` führt
  zwölf Begriffe mit eigenen Stichwort- und Definitions-Schlüsseln, beide
  registerabhängig. Mehrere davon sind exakt die Kapitelnamen aus Teil 2–4
  (`liquidity`, `netWorth`, `fixedCosts`, `remainingDebt`, `reserve`). Ein
  Kapitel, das einen Glossarbegriff einführt, verlinkt ihn — statt die
  Erklärung ein zweites Mal zu formulieren und beim nächsten Umformulieren
  auseinanderlaufen zu lassen.
- **Die Basisfassung muss für sich stehen.** Overlays gibt es heute nur für
  `de` und `en`; `ru` fällt vollständig auf die Basis durch
  (`src/i18n/overlays/index.ts`). Ein Tutorial-Text, der seinen Sinn erst aus
  der Alltagsfassung bezieht, wäre dort unverständlich. Die Basis ist das
  fachliche Register — das trägt, solange sie vollständig formuliert ist und
  nicht bloß die Kurzform der Alltagsfassung.

### Zwei Punkte für die laufende Beschriftungs-Überarbeitung

Beides ist reine Ebene 1 und gehört damit dorthin, nicht hierher — aber beides
fällt bei der Tutorial-Planung auf und wäre danach teurer:

1. **Ein Wort für die Beispieldaten.** Dieselbe Sache heißt im Bestand heute
   zweierlei: `login.demoButton: 'Demo ansehen'` gegen
   `financeEmptyState.sampleDataButton: 'Beispieldaten ansehen'` — und der
   Ladehinweis *desselben* Buttons sagt „Beispieldaten werden geladen…". Das
   Tutorial schreibt die Uneinheitlichkeit sonst an drei weiteren Stellen fort,
   und ausgerechnet dieser Weg ist der, auf dem der Nutzer am wenigsten
   Vorwissen mitbringt.
2. **Das Beta-Etikett der Finanzstadt** (`city.betaBadge`, zugleich Untertitel
   in `NAV_GROUPS` und Badge auf der Seite). Mit der Entscheidung „Kernbereich,
   immer sichtbar" ist es ein Widerspruch — siehe oben. Ob es fällt, ist eine
   Produktentscheidung; dass es zusammen mit den übrigen Beschriftungen
   entschieden wird, ist die günstigere Reihenfolge.

## Umsetzungsreihenfolge

Ergänzt die Reihenfolge aus `tutorial-progressive-disclosure.md` („zuerst die
Freischaltungs-Achse, dann das Overlay") um die Inhaltsseite:

1. ✅ **Freischaltungs-Achse** (`unlocked_features`, Sichtbarkeitsregel,
   Einstellungen-Schalter „Alles freischalten", Tests). Steht: sichtbar ist,
   was *gewählt UND freigeschaltet* ist; `null` heißt in beiden Achsen „nicht
   in Gebrauch". Scharf wird die Achse erst, wenn das Tutorial sie schreibt —
   bis dahin ändert sich für Bestandsnutzer nichts.
2. ✅ **`src/lib/tutorial-sequence.ts`**: Reihenfolge, `DataReadiness`,
   `buildCurriculum`. Rein, ohne UI vollständig testbar. Steht — die
   Zusicherung, dass ein vollständig reifer Datenstand jedes Kapitel erreicht,
   ist als Test festgehalten. Was noch fehlt: der Adapter, der `DataReadiness`
   in der Service-Schicht aus den echten Daten erhebt, und die Kopplung an den
   Demo-Datensatz (`buildDemoDataset(now, months = 3)` — sinkt `months` unter
   3, fallen Einkommen, Verträge und Budgets im Demo-Tutorial still aus).
3. ✅ **Kapitel 0 und die Verschiebung des Onboarding-Auslösers.** Die Weiche
   steht (`DataSourceDialog`), `OnboardingDialog` wartet auf sie, und die
   Vorbelegung aus den Daten löst das Versprechen ein
   (`onboarding-proposal.ts` + `onboarding-signals-service.ts`).

   Nebenbefund beim Bauen: Die Weiche gab es faktisch schon zweimal und
   unvollständig — „Demo ansehen" auf der Anmeldeseite und CSV/Beispieldaten
   im `FinanceEmptyState`; der Bankweg fehlte an beiden Stellen. Der Dialog ist
   jetzt die eine Stelle. Wer über den Demo-Knopf hereinkam, wird nicht erneut
   gefragt: `isDemoDataActive()` notiert den Weg still.

   **Was der Vorschlag bewusst nicht tut.** Aus Buchungen lässt sich mehr
   ablesen, als man jemandem vorsetzen darf. `NEVER_PROPOSED_SITUATIONS`
   schließt `debt_focus`, `single_parent`, `family`, beide Studien-Kacheln,
   `career_starter` und `creator` aus. Die Begründung ist dieselbe, aus der es
   keine Status-Kacheln gibt (`onboarding-life-situations.md`): Ein
   automatisch gesetztes Etikett ist dieselbe Zuschreibung wie ein
   anzuklickendes, nur ungefragt. Schulden erscheinen deshalb als Umstand
   `repaying_debt` — als Tun formuliert, nicht als Lage. Vorgeschlagen werden
   nur `employed_stable`, `self_employed` und `retired`, und auch die nur bei
   eindeutigem Signal; sonst wird normal gefragt.

   Eine Feinheit, die sich beim Bauen ergab: Selbstständigen-Einnahmen *neben*
   einem Gehalt sind ein Nebenerwerb (Modifikator `side_business`), *ohne*
   Gehalt die Lebensgrundlage (`self_employed`). Derselbe Befund, zwei
   Bedeutungen — die Unterscheidung macht das Gehalt.
4. ⏳ **Overlay und Kapitelinhalte.** Die Mechanik steht vollständig:
   `TutorialOverlay` (Abdunkeln mit ausgeschnittenem Loch über `box-shadow`,
   Popover auf Desktop / Bottom Sheet auf Mobil), `useAnchorRect`
   (`data-tour-id`, misst bei Scroll und Resize nach, fehlender Anker
   überspringt), `useTutorialRun` (Kapitel- und Schrittzustand, schaltet beim
   Abschluss den Bereich frei) und `TutorialInvitation` als Einladung statt
   Dialog. Der Reifegrad-Adapter aus Schritt 2 ist nachgeliefert
   (`data-readiness-service.ts`).

   **Alle Kapitel sind ausformuliert** — 20 Kapitel mit 39 Schritten in allen
   vier Sprachen. `source` bleibt bewusst ohne Schritte: Kapitel 0 *ist* der
   `DataSourceDialog`, und ein Overlay über einem modalen Dialog wäre eine
   Führung durch eine Führung.

   Anker (`data-tour-id`) hat vorerst nur die erste Sitzung — `transactions`,
   `categories`, `dashboard`, `city`. Die übrigen Kapitel dunkeln ab und
   erklären den Bereich als Ganzes. Für den ersten Auftritt eines gerade
   freigeschalteten Bereichs ist das auch das Richtige („das gibt es jetzt,
   dafür ist es da"); einzelne Elemente einzurahmen lohnt erst, wenn die Texte
   stehen. Ein Anker ist billig nachzurüsten, ein falsch gesetzter kostet
   einen Refactor.

   Zwei Entscheidungen beim Bauen:
   - **Der Lauf ist nicht auf Schritt-Ebene persistent.** Gespeichert werden
     abgeschlossene Kapitel, nicht die Position im Kapitel. Zwei bis vier
     Schritte noch einmal zu sehen kostet Sekunden; eine halb gespeicherte
     Position erzeugt Zustände, die niemand nachvollziehen kann.
   - **Das Loch bleibt bedienbar** (`pointer-events-none` auf dem Overlay).
     Eine Führung, die das Gezeigte sperrt, kann nicht zum Mitmachen
     auffordern — und Mitmachen ist laut „Kapitelgröße" der Abschluss jedes
     Kapitels.
   - **Die geöffnete Seite entscheidet mit, welches Kapitel angeboten wird.**
     Nachgetragen, weil das Gegenteil sich wie Willkür anfühlte: Die Einladung
     schwebt über *jeder* Seite, bot aber immer `nextTeachableChapter` an und
     nannte es „eine Führung durch diesen Bereich". Auf `/city` startete sie
     damit die Buchungen — die Seite sprang weg, und erklärt wurde etwas
     anderes als das Sichtbare. Der Host prüft jetzt über `chapterOnRoute`, ob
     eines der lehrbaren Kapitel hier spielt, und zieht es vor; sonst bleibt
     der Lehrplan-Anfang, aber mit benanntem Ziel („Weiter geht es in
     Buchungen"). Ein angekündigter Wechsel ist eine Entscheidung, ein
     unangekündigter ein Sprung.
   - **Die Führung hält niemanden fest.** Die Route des Schritts wird **einmal**
     angesteuert. Vorher galt „Ort ≠ Route" dauerhaft, und jeder eigene
     Navigationsklick sprang sofort zurück. Verlässt der Nutzer den Bereich,
     endet der Lauf — das Kapitel gilt dann nicht als abgeschlossen.
5. ✅ **Vertagte Kapitel an den Coach angeschlossen** (`tutorial-coach.ts`).
   Ein Kapitel, dessen Voraussetzung eingetreten ist, wird zur
   Coach-Empfehlung — kein eigener Posteingang fürs Tutorial.

   Drei Entscheidungen dabei:
   - **Was noch vertagt ist, wird nicht angekündigt.** „17 Dinge kommen noch"
     wäre genau die Fülle, die die behutsame Heranführung vermeiden soll. Ein
     Kapitel meldet sich, wenn es so weit ist, und vorher nicht.
   - **Die Karte steht am Ende der Empfehlungsliste.** Eine Führung ist Hilfe,
     kein Finanzbefund, und darf keine Liquiditätswarnung verdrängen. Hat der
     Coach sonst nichts zu sagen — der Fall beim frischen Start —, rückt sie
     von selbst an die erste Stelle.
   - **Der Coach erhebt die Datenreife nicht selbst.** Das Kapitel kommt von
     der Aufrufstelle, die es über `useTutorialRun` ohnehin kennt. Sonst läse
     `getCoachOverview` Buchungen, Kategorien und Schulden ein zweites Mal und
     hinge an acht weiteren Services — für eine einzige Karte.

6. ✅ **Katalog, Übersichtsseite und dauerhafter Einstieg**
   (`tutorial-catalog.ts`, `src/features/tutorials/`, `/tutorials`).

   Bis hierher gab es die Führungen nur als Zuruf: Der Einladungsstreifen bot
   je *ein* Kapitel an, erschien nur, solange eines offen war, und war nach
   „Nicht jetzt" für die Sitzung weg. Wer die Erklärung zu einer Fläche später
   noch einmal wollte, hatte keinen Weg mehr dorthin, und was es überhaupt zu
   lernen gibt, stand nirgends.

   - **Vokabular: Bereich → Kapitel.** Ein *Bereich* ist der Menüpunkt
     (`/transactions`) — so heißt es im Onboarding und in den Einstellungen
     schon. Ein *Kapitel* ist die einzelne Führung darin — so heißt es im
     Code, in den i18n-Schlüsseln und im gespeicherten Fortschritt. „Buchungen"
     trägt damit fünf Kapitel. Bewusst **kein** dritter Begriff und keine
     Umbenennung: `tutorial_completed_chapters` ist persistiert, ein neuer Name
     dafür wäre eine Migration ohne Gegenwert.
   - **Der Katalog ist nicht der Lehrplan.** `buildCurriculum` beantwortet „was
     ist mein nächster Schritt" und lässt Erledigtes weg; `buildTutorialCatalog`
     beantwortet „was gibt es, und wo stehe ich" und muss es behalten — sonst
     verschwände der Fortschritt in dem Moment, in dem er entsteht. Was zur App
     dieses Nutzers gehört, entscheiden trotzdem beide über dieselbe Funktion
     (`belongsToApp`).
   - **Vertagte Kapitel stehen in der Übersicht, beim Coach nicht.** Der Coach
     ruft zu; wer die Übersicht öffnet, fragt selbst. Ihm dann die Hälfte zu
     verschweigen wäre keine Behutsamkeit, sondern eine Auskunftssperre.
   - **Erledigtes bleibt startbar.** Der grüne Haken ist eine Auskunft, keine
     Sperre — Nachschlagen ist der häufigste Grund für den zweiten Durchgang.
   - **Das zusammenhängende Tutorial ist eine Folge, kein Modus.**
     `startSeries(chapters)` reiht Kapitel aneinander; ein Einzelstart ist der
     Sonderfall „Folge der Länge eins". Zwei Zustände nebeneinander (laufendes
     Kapitel + Fortsetzungsschalter) hätten sich früher oder später
     widersprochen. Die Reihenfolge kommt von der Übersicht, die den Katalog
     kennt — der Lauf kennt ihn nicht und soll es nicht.
   - **[REGRESSION] Der Abschluss wird im Store angehängt, nicht in der
     Aufrufstelle.** `useTutorialRun` kannte die bisherige Liste nur aus dem
     Query-Cache, und der hinkt einer gerade geschriebenen Änderung hinterher.
     In einer Folge folgen zwei Abschlüsse unmittelbar aufeinander — der zweite
     schrieb die Liste ohne das erste Kapitel zurück. Seither hängt
     `completeTutorialChapter` innerhalb des Locks an (Ursachenklasse #293).
   - **Zwei Einstiege, weil es zwei Fragen gibt.** „Was ist *hier*?" beantwortet
     der Kopfzeilen-Knopf auf jeder Seite, „was gibt es *überhaupt*?" die Seite
     `/tutorials` (auch in der Navigation unter Verwaltung, nicht abwählbar).

7. ✅ **Der Einladungsstreifen ist entfallen — die Entscheidung fällt im
   Onboarding.** Mit dem Kopfzeilen-Knopf (Schritt 6) gibt es einen dauerhaften
   Einstieg auf jeder Seite; der auf `/dashboard` schwebende Streifen „Soll ich
   es dir zeigen?" war damit ein zweiter, redundanter Weg zu demselben Angebot
   — und einer, der nach „Nicht jetzt" für die Sitzung ersatzlos verschwand.
   `TutorialInvitation`/`TutorialHost` zeigen seither **nur noch das laufende
   Overlay**, kein Angebot mehr daneben.

   Die Frage „Führung oder selbst erkunden" stellt jetzt `OnboardingDialog`
   als letzter Schritt, direkt nachdem die Bereichsauswahl bestätigt ist —
   zusammen mit dem Hinweis, dass sich das jederzeit über den Kopfzeilen-Knopf
   nachholen lässt. Ein `startAll`-Zugriff auf `TutorialControl` (`useTutorialRun`
   → `startSeries(teachable)`) startet dabei dieselbe zusammenhängende Folge,
   die auch der „Alles ansehen"-Knopf aus Schritt 6 auslöst.

Schritt 2 vor Schritt 4: Ein Overlay ohne Lehrplan ist eine Führung ohne Ziel;
ein Lehrplan ohne Overlay ist bereits nutzbar — er speist den Coach mit „das
wäre dein nächster Schritt", ganz ohne Rahmen und Abdunkeln.
