# Tutorial-Reihenfolge & Datenquellen-Weiche — Vorüberlegungen

Status: **noch nicht implementiert.** Diese Datei beantwortet die Frage, die
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

2–4 Schritte, nie mehr. Ein Kapitel = ein Modul = ein Bildschirm. Jedes Kapitel
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
- **Zwei offene Punkte, die jetzt billig sind:**
  1. **Das Beta-Etikett.** `/city` trägt heute den Untertitel „Beta"
     (`city.betaBadge`, zugleich Badge auf der Seite). Zentrale Darstellung
     und Beta-Kennzeichnung widersprechen sich — entweder trägt der Kern das
     Etikett zu Recht, dann ist er noch kein Kern, oder es fällt mit dieser
     Änderung.
  2. **Die Bottom-Nav.** Auf 375 px ist ein Bereich, der nur über „Mehr" →
     Scrollen erreichbar ist, nicht zentral. Empfehlung: die Stadt wird
     vierter Tab (`BOTTOM_NAV_TARGETS`), Reihenfolge Heute · Übersicht ·
     Stadt · Buchungen · Mehr. Preis, der dazugehört: fünf Tabs sind das
     Maximum — danach ist die Leiste zu.
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

### Zur Benennung der drei Wege

Empfehlung: nach dem, was der Nutzer **hat**, nicht nach der Technik. „CSV" ist
ein Dateiformat, kein Nutzerbedürfnis — wer nicht weiß, was CSV ist, hat
vielleicht trotzdem einen Kontoauszug zum Herunterladen.

| ID | Vorschlag DE | statt |
|---|---|---|
| `csv` | „Ich habe eine Datei von meiner Bank" | „CSV-Import" |
| `bank` | „Meine Bank direkt verbinden" | „GoCardless / Bankimport" |
| `demo` | „Erst mal umsehen" | „Demo-Modus" |

**Nebenbefund, der ohnehin ansteht:** dieselbe Sache heißt im Bestand heute
schon zweierlei — `login.demoButton: 'Demo ansehen'` gegen
`financeEmptyState.sampleDataButton: 'Beispieldaten ansehen'`, und der
Ladehinweis desselben Buttons sagt „Beispieldaten werden geladen…". Wenn die
Bezeichnungen ohnehin angefasst werden, ist das der Moment, sich auf ein Wort
festzulegen; das Tutorial würde die Uneinheitlichkeit sonst an drei weiteren
Stellen fortschreiben.

## Umsetzungsreihenfolge

Ergänzt die Reihenfolge aus `tutorial-progressive-disclosure.md` („zuerst die
Freischaltungs-Achse, dann das Overlay") um die Inhaltsseite:

1. **Freischaltungs-Achse** (`unlocked_features`, Sichtbarkeitsregel,
   Einstellungen-Schalter „Alles freischalten", Tests) — unverändert zuerst.
2. **`src/lib/tutorial-sequence.ts`**: Reihenfolge, `DataReadiness`,
   `buildCurriculum`. Rein, ohne UI vollständig testbar — inklusive der
   Zusicherung, dass der Demo-Datensatz jedes Kapitel erreichbar macht.
3. **Kapitel 0 und die Verschiebung des Onboarding-Auslösers**, mit der
   datengestützten Vorbelegung der Lebenssituation.
4. **Overlay und Kapitelinhalte**, Kern zuerst (Kapitel 1–5), dann Teil 2.
5. **Vertagte Kapitel an den Coach** anschließen.

Schritt 2 vor Schritt 4: Ein Overlay ohne Lehrplan ist eine Führung ohne Ziel;
ein Lehrplan ohne Overlay ist bereits nutzbar — er speist den Coach mit „das
wäre dein nächster Schritt", ganz ohne Rahmen und Abdunkeln.
