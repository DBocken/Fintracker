# Flächen-Entwürfe für den mobilen Umbau (2026-09-04)

Ergebnis eines Fan-outs über zwölf Flächen, die gleichzeitig gegen
`docs/architecture/darstellungsdichte.md` Regel 9 entworfen haben. Jeder
Entwurf ist **gemessen, nicht geraten**: Zeilenzahlen, Kartenrahmen und
Abfragen stammen aus der jeweiligen Datei.

Diese Datei ist **Protokoll, keine Vorgabe** — verbindlich ist die ADR. Sie
steht hier, weil sonst der Bauplan für Welle 1 und 2 nur in einer
Sitzungs-Temp-Datei läge. Die Reihenfolge, in der gebaut wird, steht in
[`reihenfolge.md`](reihenfolge.md).

## Überblick

| Fläche | Slice | Kartenrahmen | Abfragen in der Darstellung | Aussagen | neue Texte | Risiko/Aufwand |
|---|---|---|---|---|---|---|
| Navigation und App-Rahmen | nein | 0 | 0 | 3 | 1 | hoch / L |
| Konten | ja | 8 | 24 | 3 | 17 | hoch / L |
| Buchungen — /transactions | ja | 0 | 0 | 2 | 6 | hoch / L |
| Steuer /tax, EÜR /euer, Export /export, CSV-… | nein | 6 | 25 | 3 | 19 | hoch / L |
| Budgets /budgets und Liquiditaet /liquidity | nein | 16 | 14 | 3 | 19 | hoch / L |
| Meilensteine, Einkommen, Anlaesse | nein | 2 | 7 | 3 | 12 | hoch / L |
| Übersicht /dashboard | ja | 7 | 3 | 3 | 8 | hoch / L |
| Einstellungen /settings — src/pages/Settings… | ja | 33 | 22 | 2 | 5 | hoch / L |
| Schulden /debts | nein | 9 | 21 | 3 | 12 | hoch / L |
| Trading /trading, Analyse | ja | 9 | 10 | 3 | 15 | hoch / L |
| Fragen /fragen · Tutorials /tutorials · Date… | ja | 4 | 5 | 3 | 14 | hoch / L |
| Finanzstadt /city | ja | 6 | 0 | 3 | 6 | gering / L |

---

## Navigation und App-Rahmen (src/components/layout/: AppShell.tsx, BottomNav.tsx, MobileNav.tsx, nav-config.ts) — keine Auswertungsflaeche, sondern der Rahmen, der auf jeder Route mitlaeuft
**Routen:** `alle 25 Routen unter <AppShell> (Liste: e2e-tests/fixtures/routes.ts ALL_ROUTES)`, `/coach (Startroute, "/" leitet dorthin)`, `/dashboard`, `/city`, `/transactions`, `/billing und /privacy (kein NAV_GROUPS-Eintrag -> Titel faellt heute auf "Ausgabentracker" zurueck)`
**Ist-Zustand:** Slice nein · 0 Kartenrahmen · 0 Abfragen in der Darstellung

### Befunde
- Zeilen: AppShell 200 + BottomNav 65 + MobileNav 133 + nav-config 271 = 669. Keine Slice (liegt unter src/components/layout/, nicht unter features/*/presentation), also auch keine presentation/mobile — verzweigt wird ausschliesslich per CSS.
- Regel 6 verletzt, und zwar auf JEDER Route: SideNav (hidden md:block), MobileNav (md:hidden) und BottomNav (md:hidden) haengen alle drei gleichzeitig im Baum. Auf dem Telefon liegt die vollstaendige Seitenleiste mit bis zu 22 Zielen unsichtbar im DOM. Der Rahmen ist die einzige Flaeche, die diesen Preis 25-mal zahlt.
- Kartenrahmen 0: im ganzen Rahmen steht nur Haarlinie (header border-b, BottomNav border-t, aside border-r, Sheet border-b) — kein <Card>, kein bg-card, kein Schatten. card-rule-budget.json wird von dieser Flaeche nicht bewegt.
- Abfragen IN der Darstellung 0: die drei useQuery, die den Rahmen speisen, liegen in Hooks (useGlobalAtmosphere: 2, useNavVisibility: 1 auf ['userSettings']). check:view-data zaehlt hier nichts; view-data-budget.json (204) ist unberuehrt, solange kein useQuery in die vier Dateien wandert.
- Der Titel im Kopf ist eine ZWEITE Fassung des Seitennamens: 13 der 25 Flaechen tragen ihn bereits im Inhalt (12x PageHeader, /privacy per h1). 12 Flaechen tragen ihn AUSSCHLIESSLICH im Kopf: /dashboard, /settings, /accounts, /city, /contracts, /csv, /export, /fragen, /premium, /occasions, /trading, /simulation. Deshalb kann die Titelzeile heute nicht ersatzlos entfallen — genau das ist die Antwort auf "was fehlt an den 25 Flaechen".
- getTitle() (AppShell.tsx Z. 31-42) sucht den Pfad in NAV_GROUPS und faellt sonst auf shell.appName zurueck: /billing und /privacy heissen in der Leiste "Ausgabentracker"; /simulation ist nur ein <Navigate> auf /liquidity?mode=simulation und braucht gar keinen Namen.
- Zwei Wege in dasselbe Sheet: der Menue-Knopf links im Kopf (MobileNav SheetTrigger, md:hidden) und der "Mehr"-Tab der Bodennavigation (OPEN_NAV_SHEET_EVENT). Der Knopf belegt den linken Platz, um den der Titel kaempft.
- Bodennavigation: 4 Ziele + "Mehr" = 5 Slots, also 72 px je Tab auf 360 dp; Beschriftung text-[11px] steht exakt auf der Grenze von check:type-scale (11 px). Kein ausdrueckliches min-h-11 — die ~53 px Hoehe entstehen zufaellig aus py-2 + Icon + Zeile.
- Das Nav-Sheet ist reiner Komponentenzustand (useState + window-Event), nicht adressierbar: die Zuruecktaste schliesst es nicht, ein Deep-Link kann es nicht oeffnen (ADR Regel 5: die Route ist die Identitaet).
- Im Sheet steht die Werkzeugzeile (Fuehrungen, Sprache, Darstellung) UEBER der Zielliste: Konfiguration vor Inhalt, also genau die Umkehrung von Regel 3 (Aussage -> Detail -> Konfiguration).
- Keine Tutorial-Anker im Rahmen: data-tour-id kommt in AppShell/BottomNav/MobileNav nicht vor (58 Anker im Baum, keiner hier). Ein Nav-Umbau kann die Fuehrung also nicht ins Leere zeigen lassen.

### Entwurf — die Aussagen

**1. Die App-Leiste traegt in der fokussierten Dichte keinen Seitennamen — der Name entsteht einmal und steht im Inhalt**

Im Kopf bleiben in fokussiert nur Suche, Datenschutz-Schild, Glocke, Konto (der Menue-Knopf entfaellt, siehe Rang 3). Den Seitennamen rendert die Shell EINMAL als <h1> in der ersten Zeile der Inhaltsspalte, klein und ruhig (text-sm font-medium text-muted-foreground) — genau so, wie CoachFokussiert ihn heute selbst setzt. Damit ist die gemessene Zwei-Zeichen-Frage nicht verschoben, sondern aufgeloest: Der Name hat die volle Spaltenbreite, und der Kopf traegt nur noch Zustand und Identitaet. Was den 25 Flaechen dafuer fehlt, beantwortet derselbe Griff: Die 12 Flaechen ohne Namen im Inhalt bekommen ihn zentral, statt 12 Einzelumbauten abwarten zu muessen. PageHeader unterdrueckt in fokussiert seinen eigenen h1 (sonst steht der Name zweimal); in kompakt bleibt alles wie heute, samt Titel im Kopf.

*Datenquelle:* src/components/layout/nav-config.ts — NAV_GROUPS[].items[].labelKey, gelesen von getTitle() (heute AppShell.tsx Z. 31-42, wird nach nav-config gezogen und um eine kleine ROUTE_NAMES-Karte fuer Routen ausserhalb der Navigation ergaenzt: '/billing' -> billing.title, '/privacy' -> privacy.title, beide Schluessel existieren). Dichte aus useDisplayDensity() (src/hooks/useDisplayDensity.ts). Keine neue Abfrage, keine zweite Namensquelle.

*Aktion:* Titelzeile im <header> nur noch in kompakt rendern; h1 aus nav-config ueber <SafeOutlet>; PageHeader bekommt die Dichte-Weiche; CoachFokussiert loescht seine eigene h1-Zeile.

**2. Die Bodennavigation traegt drei Ziele plus Mehr, nicht vier plus Mehr**

Heute (/coach) - Stadt (/city) - Buchungen (/transactions) - Mehr. /dashboard verliert seinen Tab: Auf dem Telefon versprechen "Heute" und "Uebersicht" nebeneinander dieselbe Sache, und /coach ist die Startroute, die den Kontostand und den naechsten Schritt bereits traegt. Zwei gleichrangige Tabs mit derselben Zusage sind der Hick's-Law-Fall, den die ADR benennt. Nachrechenbarer Gewinn: 4 statt 5 Slots ergeben 90 statt 72 px je Tab auf 360 dp; die Beschriftung kann von text-[11px] auf text-xs (12 px) steigen, also weg von der Grenze von check:type-scale, und jeder Tab bekommt ausdruecklich fokussiert:min-h-11 statt einer zufaellig ausreichenden Hoehe. /city bleibt, weil docs/tutorial-sequence.md sie als zentrale Darstellung und Ziel der ersten Sitzung fuehrt — diese Entscheidung wird nicht neu aufgerollt.

*Datenquelle:* src/components/layout/nav-config.ts — BOTTOM_NAV_TARGETS und getBottomNavItems(enabled, unlocked); Sichtbarkeit aus src/hooks/useNavVisibility.ts -> useQuery(['userSettings'], getUserSettings). Unveraendert, nur ein Eintrag weniger in der Zielliste.

*Aktion:* BOTTOM_NAV_TARGETS auf drei Eintraege kuerzen; nav.short.dashboard wird unbenutzt (Entscheidung dazu unter offene Fragen).

**3. Ein Weg ins Sheet — und das Sheet ist der adressierbare Detailschritt**

Der Menue-Knopf im Kopf entfaellt in fokussiert; das Sheet oeffnet ausschliesslich der "Mehr"-Tab. Es oeffnet ueber ?ziele=offen auf der jeweils aktuellen Route (dasselbe Muster wie ?lage=offen in CoachFokussiert), damit die Zuruecktaste es schliesst und ein Link es oeffnen kann — Regel 5: die Route bleibt die Identitaet. Im Sheet zuerst die Ziele (Gruppen wie heute, Liste = benannte Ausnahme von "ein Bildschirm"), danach unter einer Haarlinie die Werkzeugzeile Fuehrungen/Sprache/Darstellung: Aussage -> Detail -> Konfiguration statt der heutigen Umkehrung.

*Datenquelle:* src/components/layout/nav-config.ts — getVisibleNavGroups(enabled, unlocked), dieselbe Quelle wie SideNav und CommandPalette; Sichtbarkeit wieder aus useNavVisibility(). Kein zweiter Weg zu derselben Liste.

*Aktion:* OPEN_NAV_SHEET_EVENT durch useSearchParams ersetzen; SheetTrigger im Kopf nur noch in kompakt (bzw. ganz entfernen, da das Sheet md:hidden ist); Werkzeugzeile ans Ende verschieben.

### Detailschritt
- Das Nav-Sheet (MobileNav) IST der Detailschritt der Bodennavigation: alle uebrigen Ziele, gruppiert, mit Untertitel und Premium-Abzeichen — eine Liste, und damit die benannte Ausnahme zu "ein Bildschirm ohne Scrollen".
- Adressierbar ueber ?ziele=offen auf der aktuellen Route (Regel 5). Vorbild ist DETAIL_PARAM/'lage' in CoachFokussiert.tsx; setParams(..., { replace: true }) haelt die Historie sauber.
- /dashboard verliert den Tab, nicht den Platz: Es steht weiter in der Gruppe "Analysen" des Sheets, in der Seitenleiste der kompakten Dichte und in der Command-Palette (Suchknopf im Kopf / Cmd-K). Nichts amputiert (Regel 2/5).
- Die Werkzeuge (Fuehrungen, Sprache, Darstellung) bleiben im Sheet, wandern aber unter die Zielliste — eingeklappt ist erlaubt, entfernt nicht (AGENTS.md Paragraf 4).
- Alle 25 Routen bleiben registriert; e2e-tests/fixtures/routes.ts bleibt unveraendert. Der Umbau aendert Wege, keine Adressen.

### Begründung

Regel 9 laesst sich auf einen Rahmen nur sinngemaess anwenden: Er ist keine Auswertungsflaeche, aber er verbraucht auf JEDER der 25 Flaechen Platz und Aufmerksamkeit, bevor die Flaeche selbst etwas sagen darf. Gemessen kostet er heute eine Kopfzeile (56 px), eine Bodenleiste mit 5 Slots und einen Titel, der auf 12 Routen die einzige Namensquelle und auf 13 Routen eine Dublette ist. Die drei Entscheidungen greifen genau dort an: Der Name wandert dorthin, wo Platz ist (Inhalt), die Bodenleiste verliert das Ziel, das dieselbe Zusage macht wie die Startroute, und das Sheet bekommt EINEN Weg und eine Adresse. Bewusst NICHT im Entwurf, obwohl es dieselbe Flaeche betrifft: die Aufloesung des CSS-Verzweigens (SideNav vs. BottomNav/MobileNav per Dichte mounten und lazy laden statt md:hidden, ADR Regel 6). Das ist ein mechanischer, messbarer Schritt mit eigenem Risiko (Bundle, Hydration, platform-parity-allowlist) und gehoert in einen eigenen Commit nach den drei Entscheidungen — sonst vermischt sich eine Gestaltungsfrage mit einer Ladefrage. Zur Reihenfolge: Aussage 1 ist die einzige der drei, die andere Flaechen beruehrt, und sie loest ihre eigene Voraussetzung mit auf — deshalb steht sie vorn und nicht hinter 25 Einzelmigrationen.

### Benötigte Texte (für S2)

| Schlüssel | de | en |
|---|---|---|
| `shell.toolsGroup` | Werkzeuge | Tools |

### Gemeinsame Dateien (entscheiden über Parallelisierbarkeit)
- `src/features/shared/presentation/PageHeader.tsx — MUSS geaendert werden: in fokussiert keinen eigenen h1 mehr rendern (nur noch description/actions), sonst steht der Seitenname zweimal. Betrifft 12 Seiten gleichzeitig (BillingPage, BudgetsPage, CoachPage, DebtsPage, EuerPage, IncomePage, LiquidityPage, MilestonesPage, NetWorthPage, TaxReportPage, TransactionsPage, TutorialsPage). Das ist der Engpass des ganzen Plans.`
- `src/features/coach/presentation/mobile/CoachFokussiert.tsx — MUSS geaendert werden: die eigene <h1>{t('coach.title')}</h1>-Zeile entfaellt, der Name kommt kuenftig aus der Shell. Ohne diese eine Zeile steht der Name auf /coach doppelt. Achtung: das ist die Referenz-Umsetzung, an der sich andere Auftraege orientieren.`
- `src/pages/CoachPage.tsx — pruefen und ggf. anpassen: Fehler- und Leerzweig rendern PageHeader in BEIDEN Dichten; mit der Dichte-Weiche in PageHeader liefert dort kuenftig die Shell den Namen. Der Kommentar "Der Seitenkopf steht hier NICHT" braucht eine neue Begruendung.`
- `src/i18n/translations/de.ts — neuer Schluessel shell.toolsGroup (Ueberschrift der Werkzeugzeile im Sheet); ggf. Entfernen von nav.short.dashboard.`
- `src/i18n/translations/en.ts — dieselben Schluessel (Blatt-Symmetrie, locale-parity.test.ts).`
- `src/i18n/translations/ru.ts — dieselben Schluessel.`
- `src/i18n/translations/tlh.ts — dieselben Schluessel.`
- `platform-parity-allowlist.json — der Eintrag zu src/components/layout/AppShell.tsx beschreibt heute beide Kopf-Paare samt der Zwei-Zeichen-Messung. Entfaellt der Titel und der Menue-Knopf in fokussiert, ist der Begruendungstext nachzuziehen; faellt md:hidden am SheetTrigger weg, ggf. auch das Paar selbst.`
- `bundle-size-budget.json — AppShell liegt im Haupt-Buendel; eine Dichte-Weiche im Rahmen verschiebt gzip-Groessen. Pflichtnennung.`
- `card-rule-budget.json — Pflichtnennung. Erwartete Wirkung: keine (der Rahmen enthaelt 0 Kartenrahmen, nur Haarlinien); max 149 und maxFokussiert 2 bleiben unberuehrt.`
- `touch-target-budget.json — Pflichtnennung. Die Tabs bekommen ausdrueckliches fokussiert:min-h-11; beide Spalten stehen auf 0 und muessen dort bleiben.`
- `view-data-budget.json — nur pruefen: die vier Dateien liegen unter src/components/, jede neue useQuery dort wuerde die Ratsche (204) heben. Der Plan bringt keine.`
- `e2e-tests/fixtures/routes.ts — inhaltlich unveraendert (25 Routen bleiben), aber die ADR verlangt, dass diese Liste in BEIDEN Dichten laeuft; der Nachweis "ein Bildschirm ohne Scrollen" und "Sheet per ?ziele=offen erreichbar" gehoert in die Playwright-Suite, die diese Datei liest.`
- `src/hooks/useDisplayDensity.ts — nur Import, KEINE Aenderung: AppShell und PageHeader lesen die Dichte kuenftig ueber diesen Hook. Kein Konflikt, aber wer ihn aendert, aendert den Rahmen mit.`
- `src/components/CommandPalette.tsx — keine Aenderung noetig, aber load-bearing: Sie ist nach dem Tab-Verlust der zweite Weg zu /dashboard (getVisibleNavGroups). Wer sie umbaut, muss wissen, dass die Zusage "nichts amputiert" daran haengt.`
- `src/components/layout/SideNav.tsx — im selben Verzeichnis, aber nicht in meiner Flaeche benannt: unveraendert fuer die drei Entscheidungen; erst der Regel-6-Schritt (nur eine Fassung mounten) beruehrt sie.`

### Offene Fragen
- Wenn der Rahmen den Seitennamen stellt: Soll er es auf ALLEN 25 Routen tun oder nur dort, wo die Flaeche ihn nicht selbst traegt? Empfehlung ist "immer, und PageHeader schweigt in fokussiert" — jede Ausnahme je Flaeche waere eine zweite Namensquelle und damit die verbotene Doppelung. Braucht eine Bestaetigung, weil sie 12 Seiten auf einmal aendert.
- /dashboard oder /city — welches Ziel verlaesst die Bodennavigation? Ich empfehle /dashboard (doppelte Zusage neben "Heute"), aber die App misst keine Nutzung (local-first, keine Analyse-Daten), die Entscheidung faellt also aus der Rolle, nicht aus Zahlen. Wer sie umdreht, aendert nur eine Zeile in BOTTOM_NAV_TARGETS.
- nav.short.dashboard wird unbenutzt: loeschen (in allen vier Sprachbaeumen, sonst faellt locale-parity) oder als stiller Bestand stehenlassen? Loeschen ist sauberer, kostet aber vier Dateien.
- /billing und /privacy sollen ihren Namen ueber eine kleine ROUTE_NAMES-Karte in nav-config bekommen und NICHT ueber neue NAV_GROUPS-Eintraege: Ein Eintrag dort erscheint automatisch in SideNav, Sheet, Command-Palette UND als Auswahlkaestchen im Onboarding (src/components/onboarding/FeatureSelection.tsx liest NAV_GROUPS) und laeuft durch isNavPathVisible (src/lib/life-situations.ts) sowie die Tier-Matrix-Tests. Bestaetigen, dass die kleine Karte der gewollte Weg ist.
- Braucht der Rahmen kuenftig ein document.title je Route? Heute steht in index.html nur "Ausgabentracker"; im Android-Task-Switcher und im Browser-Tab heisst damit jede Flaeche gleich. Die Namensquelle waere dieselbe (nav-config) — bewusst nicht in den Entwurf genommen, weil es kein Bildschirminhalt ist.
- Der Nachweis fuer Regel 9 ist laut ADR ein Bildschirmfoto vom Geraet plus eine Playwright-Messung (Scrollhoehe gegen Viewport). Fuer den Rahmen heisst das: gemessen wird die Resthoehe, die Kopf (56 px + Safe-Area) und Bodenleiste den Flaechen uebrig lassen. Wer diese Messung aufsetzt, entscheidet auch, ob der Kopf in fokussiert ueberhaupt 56 px braucht.

---

## Konten (/accounts) und Verträge (/contracts) — src/pages/AccountsPage.tsx, src/pages/ContractsPage.tsx, src/components/accounts/**, src/components/contracts/**, src/features/accounts/**
**Routen:** `/accounts`, `/accounts?verwaltung=offen`, `/accounts?account=<id>`, `/contracts`, `/contracts?lage=offen`, `/contracts?merchant=<name>`
**Ist-Zustand:** Slice ja · 8 Kartenrahmen · 24 Abfragen in der Darstellung

### Befunde
- Slice nur halb: features/accounts/ hat domain+data+application+presentation, aber KEIN presentation/desktop|mobile. /contracts hat ueberhaupt keine Slice — ContractsDashboard.tsx (549 Zeilen) ist Datenschicht, Rechnung, Chart, Tabelle, Mobilliste und Deep-Link-Aufloesung in einer Datei.
- Keine der beiden Routen verzweigt nach Dichte. /contracts blendet stattdessen zwei vollstaendige Darstellungen per lg:hidden / hidden lg:block gegeneinander weg (Aktivliste UND Archivliste, je zweimal) — beide im DOM, beide im Buendel, also genau der Fall, den ADR Regel 6 abschafft.
- /accounts nennt keinen einzigen Kontostand. AccountList.tsx zeigt Icon, Name, Badges, Kontoart, Sync-Status, Datenqualitaet und Waehrung — aber keinen Saldo; die einzige Zahl auf der Seite ist der Bargeldstand aus CashSection. Der Tutorial-Schritt accounts.balances sagt dazu woertlich 'Erst der Saldo macht aus einer Liste einen echten Kontostand' und zeigt auf eine Liste ohne Salden.
- Der Deep-Link /accounts?account=<id> aus dem Abfrage-Register (features/accounts/domain/questions.ts, Eintrag konto.saldo) wird nirgends gelesen: In der gesamten Flaeche kommt kein useSearchParams vor. Der Link landet auf der Seite statt auf dem Konto (ADR Regel 5).
- 8 Kartenrahmen nach der Zaehlweise von check:card-rule (AccountManager 1, CashSection 1, TransferSuggestions 1, AccountList 1, ManualAssetsSection 1, ContractSuggestionsBanner 1, ContractsDashboard 2) von 149 im ganzen Baum. Dazu die von Regel 10 ausdruecklich verbotene Form 'Rahmen je Eintrag': AccountList gibt jedem Konto ein rounded-lg border bg-card, ManualAssetsSection jedem Wert ein rounded-md border.
- 24 Datenzugriffe stehen noch in der Darstellung (gemessen mit scripts/view-data-core.mjs): CashSection 9, CashWithdrawalDialog 4, ContractsDashboard 6, ContractSuggestionsBanner 4, ContractDetailSheet 1 — 14 Abfragen/Mutationen plus 10 Service-Importe. Budget steht auf 220.
- Aussagen je Bildschirm heute weit ueber drei. /accounts: Bargeldstand, Automaten-Vorschlaege (n), Summe manueller Werte, Zahl veralteter Schaetzungen, 'x von y Konten genutzt', Zahl abgelaufener Freigaben, Uebertrags-Vorschlaege = 7 gleichrangige plus 3 Kartenueberschriften. /contracts: Summe der Verbindlichkeiten, Vertrags-Einnahmen, monatlich/jaehrlich-Umschalter, 12-Monats-Verlauf mit drei Serien, Kandidaten-Banner, 'Aktive Vertraege (n)', 'Beendet & Archiv (n)' = 7.
- ContractsDashboard startet bei JEDEM Seitenaufruf ungefragt applyDetectedContracts (Auto-Scan, also einen Schreibvorgang ueber den gesamten Buchungsbestand), gebunden an transactions.length. Das haengt am Aufbau der Flaeche und zieht beim Umbau mit.
- Der Sanfte Modus greift auf /contracts nicht: euro() in ContractsDashboard.tsx und ContractDetailSheet.tsx ist ein n.toLocaleString('de-DE', {style:'currency'}) ohne money.mask(). check:money-format sieht das strukturell nicht, weil es nach <formatierer>.format(betrag) aus einem Intl sucht — hier steht toLocaleString direkt am Wert.

### Entwurf — die Aussagen

**1. Die Summe — groesste Zahl, zuerst**

/accounts: Kleine Grossbuchstaben-Zeile 'Auf allen Konten', darunter der Gesamtsaldo in text-5xl tabular-nums. /contracts: Zeile 'Feste Kosten je Monat', darunter der Monatsbetrag in text-5xl tabular-nums, darunter in text-sm text-muted-foreground die Zahl der Vertraege, die dahinter stehen ('aus 14 aktiven Vertraegen'). Kein Rahmen, kein Hintergrund.

*Datenquelle:* /accounts: NetWorthBreakdown.cash aus useQuery({ queryKey: accountQueryKeys.netWorth /* ['net-worth'] */, queryFn: getNetWorthBreakdown }) — src/services/net-worth-service.ts, gerechnet mit computeAnchoredBalance aus src/features/shared/domain/balance-calculations.ts, also DIESELBE Rechnung wie Dashboard, Coach und Buchungsliste. Der Schluessel liegt schon zweimal im Baum (use-net-worth-snapshot.ts, CashSection.tsx) — kein zweiter Ladevorgang. features/accounts/domain/questions.ts (konto.gesamt) nennt genau diese Zahl als 'dieselbe Zahl, die /accounts zeigt'. — /contracts: liabilitiesMonthly wie heute in ContractsDashboard.tsx Z.136-139: computeContracts(transactions, categoryMap, 'Ausgabe', { decisions }).filter(isActiveForTotals), summiert ueber monthlyEquivalent(r.amountTypical, r.cycle), alles aus src/lib/contract-derivation.ts — dieselben reinen Funktionen, die auch features/contract-records/domain/questions.ts und src/lib/annual-reserve.ts benutzen. Abfragen: ['transactions','contracts'] getAllTransactions, ['categories'] getCategories, ['contract-decisions'] getContractDecisionMap.

*Aktion:* keine — die Zahl ist die Ueberschrift der Liste darunter

**2. Die Liste — sie ist selbst die Aussage**

Getrennt durch eine Haarlinie (border-t), darueber eine text-xs-Zeile 'Deine Konten (5)' bzw. 'Aktive Vertraege (14)'. /accounts: je Konto EINE Zeile in einem divide-y — links Icon und Name, rechts der Saldo (tabular-nums), darunter klein die Kontoart; ein Abzeichen nur, wenn die Bankfreigabe abgelaufen ist. Kein Rahmen je Zeile, keine Aktionsknoepfe in der Zeile. Tippen oeffnet ?account=<id>. /contracts: die bereits vorhandene ListRow-Zeile aus renderMobileRow (Zahlungsempfaenger, Zyklus und Kategorie als Untertitel, letzter Betrag rechts, 'faellig TT.MM.JJJJ' als Hinweis) — sie ist schon rahmenlos und bleibt unveraendert. Tippen oeffnet ContractDetailSheet.

*Datenquelle:* /accounts: Konto, Freigabestatus und Kontoart aus useAccountManager().rows (src/features/accounts/application/use-account-manager.ts, AccountRowModel), der Saldo aus netWorth.accountBalances[account.id] derselben ['net-worth']-Abfrage wie Aussage 1 — also KEINE zweite Saldo-Rechnung; genau diese Zuordnung benutzt auch der Registereintrag konto.saldo. — /contracts: activeRows = [...computeIncomeContracts(...), ...computeContracts(...)].filter(r => r.status === 'active'), heute ContractsDashboard.tsx Z.124; Filter 'nur Veraenderungen' wandert in den Detailschritt.

*Aktion:* Zeile antippen: /accounts -> ?account=<id> (Konto-Sheet), /contracts -> ContractDetailSheet (unveraendert)

**3. Der eine offene Punkt — entfaellt, wenn es keinen gibt**

Nach einer zweiten Haarlinie eine einzige Zeile plus Sprung. /accounts: '2 Bankverbindungen neu freigeben' — und nur wenn es keine gibt: '1 Schaetzung ist aelter als ein Jahr'; gibt es beides nicht, faellt der Abschnitt weg (wie CategorySuggestionsInbox beim Coach). /contracts: '3 moegliche Vertraege erkannt' — sonst faellt der Abschnitt weg. Darunter EIN Textlink mit Pfeil in den Detailschritt ('Konten verwalten' / 'Alles zu Vertraegen'), der auch dann steht, wenn die Zeile entfaellt. Der Link ist Rahmen, keine Aussage.

*Datenquelle:* /accounts: useAccountManager().expiredConsentCount (features/accounts/application/use-account-manager.ts, ueber selectExpiredConsentAccounts aus domain/consent-status.ts) und, nachrangig, useManualAssets().veraltet (features/accounts/application/use-manual-assets.ts, istVeraltet aus lib/manual-asset-types.ts). — /contracts: candidateRows.length, heute ContractsDashboard.tsx Z.125 (Status 'candidate' aus derselben computeContracts-Ableitung).

*Aktion:* Textlink in den Detailschritt: /accounts -> ?verwaltung=offen, /contracts -> ?lage=offen

### Detailschritt
- /accounts?verwaltung=offen (Bottom-Sheet, darf scrollen): Bank verbinden (GoCardlessConnect), Konto anlegen samt Kontingent-Zeile 'x von y', Bargeld-Aktionen (Beleg scannen, Abheben, Ausgabe erfassen) mit den Geldautomaten-Vorschlaegen, manuelle Vermoegenswerte samt Anlege-Dialog, Summe und Veraltet-Hinweis, Uebertrags-Vorschlaege (TransferSuggestions), Hinweis zur Banksynchronisierung. Alles heutige Inhalte, nichts geloescht.
- /accounts?account=<id> (Bottom-Sheet je Konto): Kontoart, Beschreibung, Waehrung, Datenqualitaet (AccountDataQualityBadge), Sync-Status und Ende der Bankfreigabe, dazu die vier Aktionen der heutigen Zeile — Bearbeiten (AccountFormDialog), Synchronisieren, Verbindung trennen, Loeschen. Loest zugleich den heute toten Deep-Link des Abfrage-Registers ein (ADR Regel 5: Der Link muss auf dem Inhalt landen, nicht auf dem Menue).
- /contracts?lage=offen (Bottom-Sheet, darf scrollen): Vertrags-Einnahmen (incomeMonthly/incomeYearly), Umschalter monatlich/jaehrlich, 12-Monats-Verlauf (FeatureGate advancedContracts, AreaChart + ChartFigure, unveraendert), Kandidaten bestaetigen/ablehnen (ContractSuggestionsBanner), 'Beendet & Archiv' als ListRow-Liste, 'Vertraege neu einlesen', Schalter 'Nur Veraenderungen zeigen'.
- /contracts?merchant=<name> bleibt unveraendert und oeffnet weiterhin ContractDetailSheet — der Registereintrag vertrag.jahreskosten haengt daran.
- Beide Sheets sind adressierbar, liegen unter DERSELBEN Route und sind mit der Zuruecktaste zu schliessen (setSearchParams mit replace: true, wie CoachFokussiert es macht).

### Begründung

Beide Flaechen bekommen dieselbe Dreiteilung — Summe, Liste, offener Punkt — weil beide dieselbe Frage beantworten: 'Wie viel, verteilt worauf, und was muss ich anfassen?'. Aussage 1 ist die Zahl, nach der beim Oeffnen gesucht wird, und sie fehlt heute auf /accounts vollstaendig. Aussage 2 ist die benannte Listen-Ausnahme der Regel 9: Die Liste IST die Aussage, deshalb bekommt sie keine Karte um sich und keine Karte je Eintrag (Regel 10) und deshalb wandern die Zeilen-Aktionen ins Konto-Sheet — drei Icon-Knoepfe je Zeile sind auf dem Telefon drei Fehlklicks, keine drei Funktionen. Aussage 3 ist die einzige Feststellung, die eine Handlung ausloest; alles Uebrige (Einrichten, Anlegen, Verlauf, Archiv, Filter, Umschalter, manuelle Werte, Uebertraege) ist Konfiguration und gehoert nach ADR Regel 3 hinter einen eigenen Schritt, nicht neben die Aussage. Gegliedert wird ausschliesslich ueber Weissraum, Schriftgroesse und zwei border-t-Haarlinien; die 8 Kartenrahmen der Flaeche entfallen in der fokussierten Fassung ersatzlos. Vorgehen wie beim Coach: ViewModel je Flaeche in features/<slice>/application, zwei Praesentationen unter presentation/{desktop,mobile}, in der Page nur die Dichteweiche mit lazy je Fassung (ADR Regel 6/7). Fuer /contracts heisst das, die Slice features/contracts erst anzulegen — die drei Abfragen und die computeContracts-Rechnung ziehen unveraendert aus ContractsDashboard.tsx nach application/use-contracts-overview.ts um; es entsteht keine neue Abfrage und keine zweite Zahl.

### Benötigte Texte (für S2)

| Schlüssel | de | en |
|---|---|---|
| `accounts.fokussiert.title` | Konten | Accounts |
| `accounts.fokussiert.totalLabel` | Auf allen Konten | Across all accounts |
| `accounts.fokussiert.listLabel` | Deine Konten ({count}) | Your accounts ({count}) |
| `accounts.fokussiert.consentExpiredOne` | 1 Bankverbindung neu freigeben | 1 bank connection needs renewed access |
| `accounts.fokussiert.consentExpiredMany` | {count} Bankverbindungen neu freigeben | {count} bank connections need renewed access |
| `accounts.fokussiert.manage` | Konten verwalten | Manage accounts |
| `accounts.fokussiert.manageTitle` | Konten verwalten | Manage accounts |
| `accounts.fokussiert.accountDetailTitle` | Konto | Account |
| `accounts.fokussiert.noAnchorHint` | Noch kein echter Kontostand hinterlegt | No confirmed balance recorded yet |
| `contracts.fokussiert.title` | Abos & Verträge | Subscriptions & contracts |
| `contracts.fokussiert.monthlyLabel` | Feste Kosten je Monat | Fixed costs per month |
| `contracts.fokussiert.fromActive` | aus {count} aktiven Verträgen | from {count} active contracts |
| `contracts.fokussiert.listLabel` | Aktive Verträge ({count}) | Active contracts ({count}) |
| `contracts.fokussiert.candidatesOne` | 1 mögliche Vertrag erkannt | 1 possible contract detected |
| `contracts.fokussiert.candidatesMany` | {count} mögliche Verträge erkannt | {count} possible contracts detected |
| `contracts.fokussiert.more` | Alles zu Verträgen | Everything about contracts |
| `contracts.fokussiert.detailTitle` | Verträge im Detail | Contracts in detail |

### Gemeinsame Dateien (entscheiden über Parallelisierbarkeit)
- `src/i18n/translations/de.ts — neue Schluessel accounts.fokussiert.* und contracts.fokussiert.*`
- `src/i18n/translations/en.ts — Key-Symmetrie ist Pflicht (locale-parity.test.ts)`
- `src/i18n/translations/ru.ts — ru steht in SUPPORTED_LOCALES, also paritaetspflichtig`
- `src/i18n/translations/tlh.ts — INACTIVE_LOCALES, nicht paritaetspflichtig; nur anfassen, wenn ohnehin gepflegt wird`
- `src/i18n/overlays/everyday/de.ts — 'Verbindlichkeiten'/'Bankfreigabe' brauchen eine Alltagsentsprechung; overlay-coverage.test.ts prueft Existenz UND Mindestumfang`
- `src/i18n/overlays/everyday/en.ts`
- `src/i18n/overlays/everyday/ru.ts`
- `card-rule-budget.json — max steht auf 149; die 8 Rahmen dieser Flaeche muessen die Zahl SENKEN. maxFokussiert (Stand 2, Ziel 0) darf durch die neuen presentation/mobile/-Dateien nicht steigen — dort ist jede Box ein Fund.`
- `view-data-budget.json — max steht auf 220; die 24 gemessenen Zugriffe dieser Flaeche muessen die Zahl senken, nicht heben`
- `slice-presentation-budget.json — max steht auf 11 und darf nur sinken. GEFAHR: Zieht die Konten-Praesentation komplett in die Slice, zaehlen ihre Importe von src/components/RequireTier.tsx, src/components/GoCardlessConnect.tsx, src/components/transactions/TransactionFormDialog.tsx und src/components/transactions/ReceiptScanDialog.tsx als fremde Feature-UI (+4). Ohne die beiden Umzuege unten geht die Ratsche rot.`
- `bundle-size-budget.json — ADR Regel 6 verlangt lazy je Dichte; vier neue Chunks (Konten/Vertraege je kompakt und fokussiert) brauchen Eintraege bzw. eine Anpassung von totalGzipBytes`
- `src/lib/tutorial-steps.ts — Kapitel 'accounts': Schritt addCash ist interactive und haengt am Anker accounts-add-cash, der im Entwurf im Detailschritt liegt. Entweder ein openAnchor auf den Verwalten-Schritt oder der Anker bleibt sichtbar — ADR Regel 5 verlangt den Anker in BEIDEN Dichten. Die Schritte balances/realBalance zeigen heute auf eine Liste ohne Saldo und werden durch Aussage 1+2 erst wahr.`
- `src/components/GoCardlessConnect.tsx — Umzug nach src/features/accounts/presentation/ empfohlen (einziger Nutzer ist AccountManager), sonst steigt slice-presentation max`
- `src/components/RequireTier.tsx — Aufrufstelle in AccountManager auf FeatureGate umstellen (RequireTier ist ein deprecated Alias; FeatureGate gilt als Infrastruktur und wird nicht gezaehlt)`
- `src/components/transactions/TransactionFormDialog.tsx und src/components/transactions/ReceiptScanDialog.tsx — von CashSection benutzt; bei einem Umzug der Bargeld-Aktionen in die Slice werden sie zu gezaehlten Fremd-Importen. Nur lesen, aber die Kopplung ist zu entscheiden.`
- `src/features/dashboard/presentation/desktop/DashboardDesktopView.tsx und src/features/dashboard/presentation/mobile/DashboardMobileStory.tsx — beide importieren src/components/accounts/AccountCards.tsx aus meiner Flaeche. Empfehlung: AccountCards NICHT anfassen, sonst zieht der Umbau die Dashboard-Slice mit.`
- `src/pages/__tests__/screens.empty-state.test.tsx — rendert unter anderem /accounts; nach der Dichteweiche muss der Test die Dichte fixieren (jsdom meldet innerWidth 1024 = kompakt)`
- `e2e-tests/fixtures/routes.ts — /accounts und /contracts stehen dort; die Suite muss laut ADR in BEIDEN Dichten laufen, dazu der Scrollhoehen-Nachweis fuer den Auswertungsteil (nicht fuer die Listen)`
- `src/features/accounts/domain/questions.ts — nur lesen: Die Registereintraege konto.saldo/konto.gesamt legen fest, welche Zahl /accounts zeigen MUSS (netWorth.cash bzw. netWorth.accountBalances). Der Entwurf richtet sich danach; die Datei bleibt unveraendert.`
- `src/features/contract-records/domain/questions.ts — nur lesen: benutzt dieselben Funktionen aus lib/contract-derivation.ts wie der Entwurf; die Zahl darf nicht auseinanderlaufen`

### Offene Fragen
- Aussage 3 auf /accounts wechselt ihren Inhalt je nach Lage (abgelaufene Freigabe vor veralteter Schätzung vor gar nichts). Ist ein wechselnder Slot gewollt, oder soll dort fest das Nettovermögen (NetWorthBreakdown.netWorth) stehen? Letzteres wäre dieselbe Quelle wie /net-worth, aber eine Zahl, die auf /accounts nichts auslöst.
- Zwei Zahlen über laufende Kosten bestehen heute nebeneinander: liabilitiesMonthly aus der Vertragsableitung (lib/contract-derivation) und disposable.obligations aus der Prognose (lib/disposable-budget über forecast-flows), das der Coach zeigt. Beide sind heute im Baum, keine ist neu — welche gilt auf /contracts? Vorschlag: die Vertragsableitung, weil sie die Fläche definiert. Zu bestätigen, damit nicht zwei Wege zu derselben Aussage entstehen.
- Tutorial-Anker accounts-add-cash: Der Schritt ist interactive ('mach das jetzt') und der Knopf liegt im Entwurf hinter ?verwaltung=offen. Entweder tutorial-steps.ts bekommt ein openAnchor auf den Verwalten-Schritt, oder der Bargeld-Knopf bleibt auf dem Einstiegsbildschirm — dann wäre er eine vierte Aussage. Entscheidung liegt außerhalb meiner Fläche.
- applyDetectedContracts läuft heute bei jedem Aufruf von /contracts ungefragt los (Schreibvorgang über den gesamten Buchungsbestand). Bleibt der Auto-Scan am fokussierten Einstieg, oder wandert er in den Detailschritt neben 'Verträge neu einlesen'? Auf dem Telefon ist er die teuerste Sekunde der Fläche.
- Der Schlüssel ['transactions','contracts'] steht heute in src/features/accounts/data/account-query-keys.ts (transactionContracts). Bekommt features/contracts/data eine eigene, byte-identische Konstante, oder importiert die Contracts-Slice aus der Accounts-Slice? Ein abweichender Schlüssel führt still zwei Caches.
- Leerzustand: Wer noch kein Konto hat, sieht bei diesem Entwurf eine Null, eine leere Liste und einen Link — die einzige sinnvolle Aktion läge hinter einem Schritt. Braucht /accounts wie CoachPage einen eigenen isEmpty-Zweig mit FinanceEmptyState vor der Dichteweiche?
- euro() auf /contracts umgeht den Sanften Modus (toLocaleString statt money.mask). Wird das im selben Umbau behoben — dann ist es eine Änderung an ContractDetailSheet, das beide Dichten teilen — oder als eigener Befund gemeldet?

---

## Buchungen — /transactions (src/pages/TransactionsPage.tsx, src/features/transactions/**)
**Routen:** `/transactions`, `/transactions?summen=offen (neuer Detailschritt, gleiche Route)`, `/transactions?tx=<id> (bestehender Deep-Link aus /tax und den Diagrammen)`, `/transactions?cat=&acc=&contract=&essential=&klasse=&q=&merchant=&range=&days= (bestehende Filter-Kodierung, encodeDashboardFilters)`
**Ist-Zustand:** Slice ja · 0 Kartenrahmen · 0 Abfragen in der Darstellung

### Befunde
- ÜBER der Liste stehen heute SECHS Aussagen, Budget nach ADR Regel 9 sind DREI (und die Liste ist davon schon eine): PageHeader-Beschreibung ('Alle Transaktionen – tippe eine Zeile an…'), Kontostand (4xl/5xl), Einnahmen, Ausgaben, Zeitraum-Saldo (2xl, farbig), 'n von m Buchungen'. Alle fünf Zahlen kommen aus TransactionStats (src/components/dashboard/TransactionStats.tsx).
- Die Kennzahlenzeile sitzt in einer BOX: 'rounded-xl bg-gradient-to-br from-brand/10 via-premium/15 to-transparent p-5 md:p-6' (TransactionStats.tsx Z. 73). check:card-rule sieht sie NICHT — hasCardChrome() verlangt <Card>, ds-section oder bg-card+border/shadow. Regel 9 verbietet sie trotzdem ('kein Hintergrund'). Deshalb steht kartenrahmen auf 0 und ist trotzdem nicht sauber.
- Es gibt KEINE fokussierte Fassung. presentation/mobile/ enthält genau eine Datei: TransactionsDetailSheet.tsx (51 Zeilen, reiner Wrapper um TransactionDetailsModal). Der Bildschirm selbst ist für beide Dichten derselbe.
- Verzweigt wird an der falschen Schwelle: useIsWideDesktop (1024) für die Detail-Region und zusätzlich CSS-Dual-Render bei lg ('lg:hidden' Filterknopf gegen 'hidden lg:flex' Werkzeugleiste, TransactionsListPane Z. 105/145). useDisplayDensity (768) wird auf dieser Fläche nirgends benutzt — ADR Regel 4/6.
- Datenschicht ist bereits sauber: 0 useQuery/useMutation in src/pages/TransactionsPage.tsx und in features/transactions/presentation/**. Alle fünf Abfragen (transactionsAll, categories, accounts, contractDecisions, useAllocationMap) liegen in application/use-transactions-overview.ts. Der Umbau braucht KEINE Änderung am ViewModel und keine neue Abfrage.
- ZWEI WEGE ZU 'KONTOSTAND' (ADR Regel 1, live): /coach zeigt computeTotalEffectiveBalance über NUR Zahlungskonten (use-coach-overview.ts, accountsBalance), /transactions zeigt computeScopedBalance über ALLE Konten (transactions-scope.ts, balances.scopedCurrent). Im ADR-Beispiel sind das 3.162,69 € gegen 2.806,66 € — Differenz ist die Kreditkartenschuld (−356,03 €) — unter demselben Wort 'Kontostand'.
- Ein Detailschritt per Query-Parameter ist heute UNMÖGLICH: TransactionsPage.tsx Z. 60–62 ersetzt die ganze Query-Zeichenkette durch encodeDashboardFilters(model.filters.values). encodeDashboardFilters baut ein frisches URLSearchParams — fremde Parameter werden gelöscht. Der ?tx=-Deep-Link fängt seinen Wert deshalb bereits im useState-Initializer ab (Kommentar Z. 78–81 sagt das ausdrücklich).
- Tutorial-Anker fehlen in der fokussierten Dichte (ADR Regel 5): 'filter-reset' hat sein data-tour-id nur im 'hidden lg:flex'-Zweig (TransactionsListPane Z. 150); 'filter-timerange/category/account/contract/essential' sitzen in TransactionFilters.tsx und existieren unter 1024 px nur, solange das Filter-Sheet offen ist. Kapitel 'transactionsFilter' (tutorial-steps.ts Z. 137–144) zeigt dort ins Leere.
- TransactionStats.tsx, TransactionDayList.tsx und TransactionFilters.tsx liegen unter src/components/dashboard/, werden aber AUSSCHLIESSLICH von TransactionsListPane importiert (nachgemessen, keine weiteren Importeure ausser Tests). Sie sind 3 der 11 gezählten Feature-UI-Importe in slice-presentation-budget.json.
- Voreingestellter Zeitraum ist 'Gesamt' (DEFAULT_DASHBOARD_FILTERS.range). Beim Öffnen ohne Filter zeigt der 'Saldo' aus TransactionStats also den Netto-Saldo ALLER Buchungen seit Beginn — eine Zahl, die dem Kontostand direkt daneben fast gleicht. Zwei nahezu identische Zahlen nebeneinander, beide gross gesetzt.

### Entwurf — die Aussagen

**1. Die eine Zahl über der Liste — sie wechselt mit dem Filterzustand, statt zwei Zahlen gleichzeitig zu zeigen**

OHNE Filter (filters.activeCount === 0): Label 'Kontostand (alle Konten)' klein/uppercase, darunter der Betrag als text-3xl tabular-nums, darunter eine gedämpfte Ergänzungszeile '1.284 Buchungen'. Der Kontostand steht hier nicht als Schmuck, sondern weil er der ANKER der laufenden Salden in der Liste ist (balances.showRunningBalance ist genau dann true, wenn kein Inhaltsfilter greift) — ohne ihn ist die Saldospalte je Tag eine Zahl ohne Herkunft.

MIT Filter (activeCount > 0): dieselbe Stelle zeigt stattdessen 'Saldo der Auswahl' + den vorzeichenbehafteten Betrag (text-3xl, text-positive/text-warning wie heute), Ergänzungszeile '42 von 1.284 Buchungen · Letzte 30 Tage'. Der Kontostand fällt hier weg, weil showRunningBalance dann ohnehin false ist — sein Job existiert nicht mehr. Beim Zeitraumwechsel zählt der Wert hoch wie heute (useAnimatedNumber, Prinzip 2), er poppt nicht auf.

Die Ergänzungszeile ist bewusst KEINE eigene Aussage: sie qualifiziert die Zahl darüber ('aus welcher Menge'), sie steht nicht für sich. Dieselbe Bauform wie in CoachFokussiert bei 'noch X Tage · Y € Fixkosten offen'.

Keine Box: kein Rahmen, kein Hintergrund, kein Verlauf. Getrennt wird zur Liste hin über eine Haarlinie (border-t border-border/60) und Weissraum.

*Datenquelle:* Beide Zahlen aus DEMSELBEN ViewModel, das die Fläche heute schon hat, keine neue Abfrage: Kontostand = model.balances.scopedCurrent (use-transactions-overview.ts, computeScopedBalance aus features/transactions/domain/transactions-scope.ts über computeEffectiveBalances aus features/shared/domain/balance-calculations.ts). Auswahl-Saldo/Anzahl = model.stats.balance / model.stats.count (computeTransactionStats, features/transactions/domain/transaction-stats.ts). Gesamtzahl = model.transactions.all.length. Filterzustand = model.filters.activeCount (countActiveFilters, transactions-scope.ts). Aktiver Zeitraum-Text = der bestehende useRangeLabel-Schalter in src/components/dashboard/TransactionFilters.tsx (dafür als kleine Funktion aus der Komponente herauszuziehen — siehe gemeinsameDateien). Query-Keys unverändert: transactionsKeys.transactionsAll ['transactions','all'] / .categories / .accounts / .contractDecisions.

*Aktion:* Der ganze Block ist Anzeige, nicht klickbar (Prinzip 8: ohne Box wird auch nichts versprochen). Der Sprung ins Detail hängt darunter als Textlink 'Einnahmen und Ausgaben →' und setzt ?summen=offen — ein Detail-Verweis, der nach Regel 9 nicht mitzählt.

**2. Die Buchungsliste — die benannte Ausnahme, unverändert**

TransactionDayList wie heute: Tagesüberschriften mit laufendem Saldo, Zeilen mit Betrag/Kategorie/Konto, aufklappbare Split-Zeilen, Fenstervirtualisierung ab 150 Einträgen gegen das SEITEN-Scroll. Kein overflow-Container darum (Virtualisierungs-Constraint der Slice-README, verbindlich). Erste Buchungszeile muss beim Öffnen sichtbar sein — das ist das Ziel des ganzen Umbaus: heute stehen zwischen App-Leiste und erster Zeile PageHeader (~70 px) + Suchfeld (~56) + Filterzeile (~56) + Kennzahlenbox (~230), also rund 410 px; danach h1 (~24) + eine Zahl mit zwei Zeilen (~90) + eine Bedienzeile (~56), also rund 170 px.

Null sichtbare Zeilen heisst hier immer 'die Filter treffen nichts' (Leer- und Fehlerfall fängt die Page vorher ab) — dafür bleibt FilteredEmptyState mit describeActiveFilters unverändert an seiner Stelle.

*Datenquelle:* model.transactions.visible, model.categories, model.accounts, model.hidden.ids, model.balances.ending, model.balances.showRunningBalance, model.splits.byTransaction / .matchedIds — alles aus use-transactions-overview.ts, identisch zum heutigen Aufruf in TransactionsListPane Z. 183–195. Kein einziger Wert neu.

*Aktion:* Zeile antippen → onOpenDetails → TransactionsDetailSheet (presentation/mobile/, unverändert; die 768-px-Dialog/Sheet-Weiche steckt intern in TransactionDetailsModal und bleibt unangetastet).

### Detailschritt
- Adresse: /transactions?summen=offen — gleiche Route, adressierbar, mit der Zurück-Taste schliessbar (ADR Regel 5). Parametername BEWUSST nicht 'lage' wie beim Coach: dort steht die Finanzlage dahinter, hier die Summen des gewählten Ausschnitts. Ein Name, der benennt, was er öffnet, ist billiger als ein Name, der ein Muster kopiert.
- Bauform: Sheet side='bottom', max-h-[90dvh] overflow-y-auto, pb-[max(1.5rem,env(safe-area-inset-bottom))] — exakt CoachFokussiert. Im bewusst geöffneten Detail DARF gescrollt werden.
- Inhalt 1 — Einnahmen (model.stats.income) und Ausgaben (model.stats.expenses). Das sind die zwei Zahlen, die von der Oberfläche verschwinden; sie werden NICHT gelöscht (AGENTS.md §4 'Anpassen, nicht amputieren').
- Inhalt 2 — Saldo der Auswahl (model.stats.balance) und 'n von m Buchungen' (model.stats.count / model.transactions.all.length), damit das Sheet für sich vollständig ist.
- Inhalt 3 — Kontostand im gewählten Konto-Scope (model.balances.scopedCurrent). Steht IMMER hier, auf der Oberfläche nur im ungefilterten Fall.
- Inhalt 4 — der aktive Filtersatz im Klartext über describeActiveFilters(model.filters.values) (features/shared/domain/active-filters, in TransactionsListPane bereits importiert) plus 'Filter zurücksetzen' auf model.filters.reset. Das ist die Stelle, an der 'filter-reset' seinen Tutorial-Anker in der fokussierten Dichte bekommt.
- Darstellung: InfoStatStrip aus @/features/shared/presentation (der vorgeschriebene rahmenlose Readout-Baustein) oder ein blosses dl mit border-t-Haarlinien. Ausdrücklich NICHT TransactionStats — dessen Verlaufsbox ist die Box, die Regel 9 verbietet. TransactionStats bleibt unverändert für die kompakte Dichte im Einsatz.
- Konfiguration bleibt ein EIGENER Schritt (ADR Regel 3: Aussage → Detail → Konfiguration): das Filter-Sheet (TransactionFilters stacked) bleibt getrennt vom Summen-Sheet und hängt weiter am Filterknopf. Zwei Sheets, zwei Fragen — 'was ist da' gegen 'was will ich sehen'.
- Umsetzungsbedingung: der URL-Sync-Effekt in TransactionsPage.tsx (Z. 60–62) muss MERGEN statt ERSETZEN, sonst löscht der nächste Tastendruck im Suchfeld den Parameter wieder. Konkret: die von encodeDashboardFilters gelieferten Parameter in die bestehenden searchParams schreiben und nur die BEKANNTEN Filterschlüssel entfernen, statt das ganze Objekt zu verwerfen. Das ist eine Änderung in meiner Fläche, sie berührt encodeDashboardFilters selbst nicht — der ?tx=-Deep-Link profitiert davon mit.

### Begründung

Die Frage des Auftrags war 'was steht über der Liste und wie wenig davon reicht'. Antwort: EINE Zahl reicht, und welche das ist, entscheidet der Nutzer bereits durch sein eigenes Filtern.

Drei Gründe, jeder am Bestand gemessen:

1. Regel 9 gibt drei Aussagen, die Liste ist davon schon eine. Es bleiben zwei — heute stehen dort fünf. Von den fünf sind Einnahmen und Ausgaben Bestandteile des Saldos (die Kennzahlen-Rangfolge in TransactionStats sagt das selbst: 'ihre Bestandteile, kleiner'), und 'n von m' ist die Beschriftung einer Menge, keine eigene Feststellung. Also gehören drei der fünf einen Schritt tiefer, und von den verbleibenden zwei ist immer nur eine relevant.

2. Kontostand und Auswahl-Saldo sind beim Öffnen fast dieselbe Zahl. Der voreingestellte Zeitraum ist 'Gesamt' — der 'Saldo' ist dann der Netto-Saldo aller Buchungen seit Beginn und liegt dicht am Kontostand. Zwei fast gleiche grosse Zahlen nebeneinander sind keine zwei Aussagen, sondern eine Aussage und ein Rätsel. Sobald ein Filter greift, laufen sie auseinander — und genau dann wird der Auswahl-Saldo die Aussage und der Kontostand entbehrlich, weil showRunningBalance dann false ist und der Kontostand seinen einzigen Job (Anker der Saldospalte) verliert. Der Wechsel folgt also einer bestehenden Invariante des ViewModels, er ist keine Designlaune.

3. Der Kontostand ist auf /coach bereits die erste und grösste Zahl der App — und zwar mit einer ANDEREN Kontenmenge (nur Zahlungskonten) unter demselben Wort. Ihn hier ein zweites Mal als Hero zu setzen würde die Verwechslung vergrössern, die schon existiert. Klein gesetzt, mit geschärftem Label und nur dort, wo er etwas trägt, macht sie kleiner. Die Zahl selbst bleibt dabei dieselbe Quelle wie heute (balances.scopedCurrent) — es kommt kein dritter Rechenweg dazu.

Keine Boxen: die Verlaufsbox von TransactionStats verschwindet aus der fokussierten Fassung (sie bleibt für die kompakte). Gegliedert wird über zwei Haarlinien (border-t) und Weissraum. Suchfeld, Filterknopf mit Trefferzahl und Hinzufügen-Knopf rücken in EINE Bedienzeile (je min-h-11 min-w-11, aria-label — check:a11y-names und check:touch-targets stehen beide auf 0 und dürfen nicht steigen); das spart gegenüber PageHeader + zwei Zeilen rund 130 px. Der Seitenname 'Buchungen' steht wie beim Coach als kleines h1 im Inhalt, nicht im PageHeader.

Der dritte Aussage-Platz bleibt ABSICHTLICH frei: DataIntegrityWarning (skippedTransactionsCount > 0) ist im Normalbetrieb null und wird im Schadensfall zur zweiten Aussage über der Liste. Ein Budget ohne Luft für den Warnfall wäre ein Budget, das im Warnfall gebrochen wird.

Nichts ist amputiert: Einnahmen, Ausgaben, Kontostand, Auswahl-Saldo, Anzahl und der Filter-Klartext liegen vollständig unter ?summen=offen, unter derselben Route.

### Benötigte Texte (für S2)

| Schlüssel | de | en |
|---|---|---|
| `transactions.focusedBalanceLabel` | Kontostand · alle Konten | Account balance · all accounts |
| `transactions.focusedBalanceScoped` | Saldo · {account} | Balance · {account} |
| `transactions.focusedSelectionLabel` | Saldo der Auswahl | Balance of this selection |
| `transactions.focusedSelectionCount` | {count} von {total} Buchungen | {count} of {total} transactions |
| `transactions.focusedMore` | Einnahmen und Ausgaben | Income and expenses |
| `transactions.focusedDetailTitle` | Der gewählte Ausschnitt | The selected range |

### Gemeinsame Dateien (entscheiden über Parallelisierbarkeit)
- `src/i18n/translations/de.ts — sechs neue Schlüssel unter transactions.* (PFLICHT, check:i18n verbietet sichtbaren Text im Quelltext)`
- `src/i18n/translations/en.ts — dieselben Schlüssel (PFLICHT, locale-parity.test.ts vergleicht alle SUPPORTED_LOCALES blattweise gegen de)`
- `src/i18n/translations/ru.ts — dieselben Schlüssel (PFLICHT, SUPPORTED_LOCALES = ['de','en','ru'])`
- `src/i18n/translations/tlh.ts — INACTIVE_LOCALES, von locale-parity nicht erzwungen; der Baum wird laut locale.ts bewusst vollständig gehalten, deshalb hier gelistet statt verschwiegen`
- `card-rule-budget.json — maxFokussiert (Stand 2, Ziel 0) darf nicht steigen: die neue Datei features/transactions/presentation/mobile/TransactionsFokussiert.tsx liegt genau im Prüfbereich. max (149) sinkt NICHT durch diesen Umbau, weil die Verlaufsbox von TransactionStats vom Wächter gar nicht gezählt wird — das ist im Selbst-Review zu benennen, nicht in der Zahl`
- `slice-presentation-budget.json — max steht auf 11, davon 5 in dieser Fläche (TransactionsListPane → TransactionDayList/TransactionStats/TransactionFilters, DetailSheet → TransactionDetailsModal, DetailAside → TransactionDetailsPanel). ACHTUNG: Eine zweite Präsentationsdatei, die TransactionDayList erneut importiert, TREIBT die Ratsche auf 12 und blockiert den Umbau — dieselbe Falle wie bei WP 6.2/6.3. Empfehlung: TransactionStats.tsx und TransactionDayList.tsx nach features/transactions/presentation/shared/ ziehen (nachgemessen haben sie ausser Tests KEINEN anderen Importeur, und sie bringen keine neuen gezählten Importe mit — TransactionDayList importiert nichts aus src/components/, TransactionStats nur GentleModeProvider, der per istInfrastruktur() ausgenommen ist). Das senkt max von 11 auf 9 und erfüllt die ADR-Forderung 'jede migrierte Fläche muss die Zahlen senken'`
- `view-data-budget.json — Stand 204. Der Entwurf fügt KEINE Abfrage hinzu; die Zahl muss nach dem Umbau erneut 204 zeigen (bei einem Umzug von TransactionStats/TransactionDayList aus src/components/ heraus sinkt sie nicht, beide tragen keinen Datenzugriff)`
- `bundle-size-budget.json — ADR Regel 6 verlangt lazy() je Dichte; das erzeugt zwei neue Chunks aus dist/assets, die check:bundle-size gegen dieses Budget hält (Einzelbudget ab 20 kB plus Gesamtgrenze)`
- `src/components/dashboard/TransactionStats.tsx — bleibt als kompakte Fassung UNVERÄNDERT in Betrieb, wird aber Ziel des empfohlenen Umzugs in die Slice (siehe slice-presentation-budget.json). Ohne Umzug: nur gelesen, nicht geändert`
- `src/components/dashboard/TransactionDayList.tsx — dito; enthält die Tutorial-Anker transactions-day-header / transactions-running-balance / transactions-first-row, die in beiden Dichten existieren müssen`
- `src/components/dashboard/TransactionFilters.tsx — der useRangeLabel-Schalter (Z. 38–54) liefert den Zeitraum-Text, den die Ergänzungszeile der Aussage 1 braucht. Er muss aus der Komponente heraus in eine wiederverwendbare Funktion (Vorschlag: src/features/shared/domain/ bzw. ein kleiner Hook neben den bestehenden Filter-Bausteinen), sonst entsteht ein zweiter Ort für dieselben zehn Beschriftungen. Ausserdem tragen die SelectTrigger dieser Datei fünf filter-*-Tutorial-Anker, die in der fokussierten Dichte nur im geöffneten Sheet existieren`
- `src/components/dashboard/AusgabenklasseFilter.tsx — wird von TransactionFilters UND von features/dashboard/presentation/shared/TransactionCharts.tsx benutzt. Nur relevant, falls TransactionFilters mit umzieht: dann entsteht ein neuer gezählter Import, netto 0 statt −1. Nach AGENTS.md §3 (von ≥2 Slices gebraucht) gehörte die Datei eigentlich nach features/shared/presentation/ — eigener Befund, nicht Teil dieses Umbaus`
- `src/lib/tutorial-steps.ts — Kapitel transactions (Z. 123–129) und transactionsFilter (Z. 137–144). 'transactions-stats' zeigt heute auf die Kennzahlenbox; nach dem Umbau muss der Anker auf den neuen Zahlenblock wandern. 'filter-reset' und die fünf filter-*-Anker existieren in der fokussierten Dichte nicht (ADR Regel 5 verletzt) — entweder bekommt der Schritt eine Option, die das Sheet öffnet (Änderung in dieser Datei), oder die Anker werden im Sheet dupliziert`
- `e2e-tests/fixtures/routes.ts — /transactions steht bereits drin (Z. 17); die Routenliste soll laut ADR in BEIDEN Dichten laufen. Der Scroll-Nachweis von Regel 9 gilt für Auswertungsflächen, nicht für Listen — die prüfbare Zusicherung hier ist stattdessen: die erste Buchungszeile ist im ersten Viewport sichtbar`
- `src/hooks/useDisplayDensity.ts — wird nur GELESEN (useDisplayDensity() === 'fokussiert'), keine Änderung. Genannt, weil die Fläche diesen Hook heute nicht benutzt und ihn neu importieren muss`
- `src/features/shared/presentation/InfoStatStrip.tsx — wird nur benutzt (rahmenloser Readout im Detail-Sheet), keine Änderung`
- `src/pages/__tests__/TransactionsPage.{aaa,data-integrity,deeplink,error-state,filters,masterdetail,tutorial-anchor}.test.tsx — sieben Bestandssuiten in src/pages/__tests__/, also ausserhalb der Slice. Sie erwarten Einzeltreffer ohne within()-Scoping und prüfen unter anderem die Tutorial-Anker; jede muss um die Dichte-Achse erweitert werden (ADR: 'doppelte Zustands-Abdeckung in den Tests, wo sich die Darstellung eines Zustands unterscheidet')`
- `src/components/dashboard/__tests__/TransactionDayList.{perf,reorganization,splits,}.test.tsx und TransactionFilters.{range-i18n,stacked,viewmodel-parity}.test.tsx — sieben Testdateien, die beim empfohlenen Umzug mitwandern müssen (check:test-structure erzwingt __tests__/ neben der Datei)`

### Offene Fragen
- WELCHER Kontostand gilt? /coach zeigt NUR Zahlungskonten (use-coach-overview.ts: istZahlungskonto-Filter über computeTotalEffectiveBalance), /transactions ALLE Konten im Filter-Scope (balances.scopedCurrent). Im ADR-Beispiel 3.162,69 € gegen 2.806,66 €, gleiches Wort. Ich schlage vor, die Zahl NICHT anzugleichen (die Fragen sind verschieden: 'was kann ich ausgeben' gegen 'was besitze ich' — so steht es im Kommentar von use-coach-overview.ts) und stattdessen das Label zu schärfen: 'Kontostand · alle Konten' hier, 'Kontostand' dort. Alternative wäre, den Coach-Wert zu übernehmen — das wäre aber eine Änderung an einer FREMDEN Fläche und würde die Saldospalte der Liste falsch verankern. Entscheidung liegt nicht bei mir.
- ADR Regel 6 (nur eine Fassung gemountet, lazy je Dichte) kollidiert mit dem Virtualisierungs-Constraint dieser Slice. Die README verbietet ausdrücklich ein Ternary über den ganzen Baum, weil jeder Übertritt der Schwelle die fenstervirtualisierte Liste REMOUNTET (Scrollposition, Fokus, Virtualizer-Cache weg) — und Regel 8 verlangt, dass ein Dichtewechsel nichts verliert. Faltgeräte melden 600–770 px, überschreiten die 768 also im Betrieb (ADR, offener Punkt 3). Mein Entwurf löst das so: TransactionDayList bleibt in EINEM immer gemounteten Kern, nur der Block ÜBER der Liste und die Detail-Region verzweigen je Dichte. Damit ist Regel 6 für den teuren Teil nicht buchstäblich erfüllt (die Liste ist in beiden Dichten dieselbe Instanz). Ist das die richtige Auflösung, oder soll die Liste doch per Dichte lazy geladen werden?
- Darf ich den URL-Sync in TransactionsPage.tsx von 'ersetzen' auf 'mergen' umstellen? Ohne das überlebt kein ?summen=offen einen Tastendruck im Suchfeld. Die Umstellung ändert nichts an encodeDashboardFilters (shared domain), aber sie ändert eine Zusicherung, auf die der ?tx=-One-Shot-Mechanismus heute baut ('der Filter-Sync entfernt den fremden Param') — die Ref-Logik dort wird dadurch überflüssig statt falsch, sollte aber bewusst zurückgebaut werden.
- Wer repariert die fehlenden Tutorial-Anker (filter-reset nur im lg-Zweig, fünf filter-*-Anker nur im geöffneten Sheet)? Das ist eine bestehende Verletzung von ADR Regel 5 auf meiner Fläche, aber die Behebung fasst src/lib/tutorial-steps.ts an (Schritt-Option 'öffnet vorher das Sheet') — eine Datei, die jede andere Fläche ebenfalls braucht. Meine Empfehlung: als eigener, kleiner Commit VOR dem Umbau, damit er nicht mit fünf anderen Flächen in derselben Datei kollidiert.
- Parametername des Detailschritts: ich schlage ?summen=offen statt des im Auftrag genannten ?lage=offen vor, weil hinter dem Schritt die Summen des Ausschnitts liegen und nicht die Finanzlage (die liegt beim Coach unter genau diesem Namen). Falls stattdessen EIN einheitlicher Parametername über alle Flächen gewünscht ist, sagt das bitte jemand vor dem ersten Commit — nach dem Merge steht der Name in geteilten Adressen.
- Soll TransactionStats.tsx / TransactionDayList.tsx wirklich in die Slice ziehen? Das senkt slice-presentation-budget.json max von 11 auf 9 und nimmt die Dateien aus dem Zugriffsbereich eines parallel laufenden Dashboard-Arbeiters. Es bewegt aber vier Testdateien und ist ein eigener, mechanischer Commit — der Umbau nach Regel 9 funktioniert auch ohne ihn, dann muss aber garantiert bleiben, dass genau EINE Slice-Datei TransactionDayList importiert.

---

## Steuer /tax, EÜR /euer, Export /export, CSV-Import /csv
**Routen:** `/tax`, `/euer`, `/export`, `/csv`
**Ist-Zustand:** Slice nein · 6 Kartenrahmen · 25 Abfragen in der Darstellung

### Befunde
- Keine der vier Routen ist verzweigt: kein presentation/mobile/, kein useDisplayDensity, kein lazy je Dichte. src/features/tax/ existiert, enthaelt aber NUR domain/questions.ts; src/features/tax/README.md sagt ausdruecklich, dass die Oberflaeche noch in der Alt-Oberflaeche liegt (src/pages/, src/components/tax/, src/components/euer/).
- /tax traegt heute mindestens 9 Aussagen untereinander: TaxSummaryStrip (Markierte Ausgaben, Steuerermaessigung, Buchungen = allein schon 3), EuerPointerCard, TaxSuggestionsSection, n Rubrikkarten, TaxCommuteCard, TaxExportCard, Fussnote 'Werte fuer Veranlagungszeitraum', TaxDisclaimer. Die Kennzahlenreihe fuellt das Drei-Aussagen-Budget vollstaendig, alles darunter ist ueber der Grenze.
- /euer traegt mindestens 8: EuerSummaryStrip (Einnahmen, Abziehbare Ausgaben, Gewinn = 3), EuerWarningsCard, zwei EuerLinesCard, EuerPrivatTransfersLine, TaxReserveTankCard, EuerExportCard, TaxDisclaimer.
- /export ist EIN Bildschirm mit drei gleichzeitigen Entscheidungen (Zeitraum aus 4 Knoepfen, Format aus 2 Kacheln, Ausloesen) plus Vorschau-Box (p-4 rounded-lg bg-muted) plus zwei Alert-Boxen. Genau der Dichtebruch, den die ADR an FeaturesStep beschreibt.
- /csv hat drei Bildschirme, aber jeder traegt mehrere Entscheidungen: Schritt 1 Zielkonto + Kontoart + Dropzone; Schritt 2 Kontoart ein ZWEITES Mal + Trennzeichen + 7 Spaltenzuordnungen = 9 Auswahlfelder auf einem Bildschirm; Schritt 3 eine 8-spaltige Tabelle mit Paginierung, Mehrfachauswahl und Sammelzuordnung.
- Doppelte Frage im CSV-Fluss: 'Kontoart' steht in CsvUploader.tsx:241 (Upload-Schritt) und erneut in :304 (Mapping-Schritt). Sie ist aus dem bereits gewaehlten Konto ableitbar (account.type === 'credit_card', vgl. accountTypeToKind in src/lib/forecast-flows.ts:26).
- Kartenrahmen nach scripts/card-rule-core.mjs zaehleKartenrahmen: 6 in der Flaeche (DataExport.tsx 1, CsvUploader.tsx 2, ReviewTable.tsx 2, TaxCommuteCard.tsx 1). Zusaetzlich 4 Ad-hoc-Boxen (rounded-lg border border-border/60 bg-muted/20) in TaxRubricCard.tsx:108, TaxSuggestionsSection.tsx:152, EuerLinesCard.tsx:55, TaxReserveTankCard.tsx:123 — die zaehlt der Kartenrahmen-Zaehler nicht (kein bg-card), zaehleBoxenInFokussiert schon: gemessen 10 Boxen, wenn diese Dateien unveraendert nach presentation/mobile/ wandern wuerden. maxFokussiert steht auf 2 mit Ziel 0.
- TaxSuggestionsSection.tsx:152 rendert je Vorschlag ein <li className='rounded-lg border border-brand/40 bg-brand/5 p-3'> — ein wiederholter Eintrag mit Karte je Stueck. Das verbietet ADR Regel 10 in BEIDEN Dichten, nicht erst in der fokussierten.
- 25 useQuery/useMutation stehen in der Darstellung: TaxReportPage 3, EuerPage 5, TaxSuggestionsSection 5, TaxCommuteCard 2, TaxReserveTankCard 2, DataExport 2, CsvUploader 1, ReviewTable 5. Dazu 20 direkte Service-Import-Zeilen. Solange das so ist, laesst sich keine zweite Praesentation danebenstellen (view-data-budget.json max 204).
- Kein Befund an den Kennzahlenreihen selbst: InfoStatStrip (src/features/shared/presentation/InfoGroup.tsx:64-85) ist bereits dichtebewusst — kompakt:rounded-xl kompakt:bg-muted/30 gegen fokussiert:divide-y, also keine Box. TaxSummaryStrip und EuerSummaryStrip erfuellen 'keine Boxen' heute schon. Das Problem ist die Zahl der Aussagen, nicht ihr Chrome.
- Tutorial-Anker kosten hier nichts: TUTORIAL_STEPS fuehrt fuer csv (Z. 117-119), tax (252-254), euer (256-258) und export (269-271) nur Routen, keine data-tour-id. ADR Regel 5 (Anker in beiden Fassungen) ist damit erfuellt, solange die Route erhalten bleibt.
- Die Register-Deep-Links auf /euer tragen deepLinkArt 'kontext', nicht 'quelle' (src/features/tax/domain/questions.ts:29, 78, 129) — sie versprechen keine exakte Treffermenge. Ein Detailschritt darf sie also aufnehmen, ohne ein unpruefbares Versprechen zu erzeugen.
- state-coverage-allowlist.json fuehrt /csv und /export mit 'leer: entfaellt'; /tax und /euer stehen NICHT drin und brauchen damit weiterhin je einen [ZUSTAND …:leer]- und [ZUSTAND …:fehler]-Test — nach der Verzweigung in beiden Dichten.
- Der Fehler-vor-Leerzustand-Vorrang ist in allen vier Flaechen bereits sauber gebaut und mit [REGRESSION]-Tests belegt (TaxReportPage.tsx:103/131, EuerPage.tsx:90/137, DataExport.tsx:190, CsvUploader.tsx:198). Der Umbau darf ihn nicht verlieren — er ist die teuerste Regression, die hier moeglich ist.

### Entwurf — die Aussagen

**1. /tax — 'Absetzbar {Jahr}'**

Aussage 1: report.markedTotal als groesste Zahl der Flaeche, darueber die Beschriftung aus dem bestehenden Schluessel tax.page.markedTotal ('Markierte Ausgaben'). Aussage 2, kleiner gesetzt, getrennt durch eine border-t-Haarlinie: 'Steuerermaessigung {Betrag}' aus report.creditTotal (Schluessel tax.page.creditTotal), der Aufbau ueber useCountUp bleibt. Aussage 3, der EINE naechste Schritt: '{n} Buchungen zum Pruefen' aus buildPendingTaxSuggestions(...).length, als Textzeile mit Pfeil auf den ersten Vorschlag; ist n = 0, steht dort 'Alles markiert'. Weg fallen vom Bildschirm: report.txCount (Buchungen) — das ist eine Zaehlung, keine Feststellung, und es ist die dritte Zahl derselben Reihe; ausserdem EuerPointerCard, Rubrikenliste, TaxCommuteCard, TaxExportCard, Fussnote und TaxDisclaimer. Keine Box, kein Rahmen: gegliedert wird ueber Weissraum und je eine border-t. Der Seitenname steht im Inhalt (h1, text-sm text-muted-foreground) wie in CoachFokussiert, nicht in der App-Leiste. Die Jahreswahl (TaxYearPicker) ist Rahmen und zaehlt nicht mit.

*Datenquelle:* buildTaxYearReport(transactions, year, profile) aus src/lib/tax-report.ts — markedTotal, creditTotal, rubrics, txCount stehen dort als Felder von TaxYearReport (Z. 91-98). Gespeist aus useQuery ['transactions', locale] -> getAllTransactions() (src/services/transaction-service.ts) und ['taxYearProfile', year] -> getTaxYearProfile (src/services/tax-profile-service.ts), beides heute in src/pages/TaxReportPage.tsx:45-75. Offene Vorschlaege: buildPendingTaxSuggestions(transactions, categories, decided, 50, businessAccountIds) aus src/lib/tax-suggestions.ts ueber ['automationSuggestions'] -> getAutomationSuggestions und ['accounts'] -> getAccounts, heute in src/components/tax/TaxSuggestionsSection.tsx:33-42. Keine neue Abfrage, kein zweiter Rechenweg.

*Aktion:* Detail-Verweis 'Alles zur Steuer' -> /tax?lage=offen (Bottom-Sheet, zaehlt als Rahmen)

**2. /euer — 'Gewinn {Jahr}'**

Aussage 1: report.gewinn als groesste Zahl (Schluessel euer.page.profit), Faerbung positiv/kritisch wie heute in EuerSummaryStrip, Aufbau ueber useAnimatedNumber bleibt. Aussage 2 unter einer Haarlinie: 'Noch zurueckzulegen {Betrag}' aus computeTaxTank(...).gap; ist gap = 0 und target > 0, steht dort 'Ruecklage steht' statt einer 0. Aussage 3, der EINE naechste Schritt: '{n} Ausgaben ohne EUeR-Blatt' aus report.unassignedExpenseTxIds.length mit Sprung auf die erste Buchung (/transactions?tx=…), sonst 'Alles zugeordnet'. Weg vom Bildschirm: report.einnahmen.total und report.ausgaben.deductibleTotal — sie sind die Rechnung HINTER dem Gewinn und gehoeren damit nach ADR Regel 3 in die Detailebene, nicht neben die Aussage; ebenso EuerWarningsCard, beide EuerLinesCard, EuerPrivatTransfersLine, der Tank selbst, EuerExportCard, TaxDisclaimer. Keine Box, zwei Haarlinien.

*Datenquelle:* buildEuerReport(transactions, accounts, year) aus src/lib/euer-report.ts — gewinn, einnahmen.total, ausgaben.deductibleTotal, unassignedExpenseTxIds sind Felder von EuerReport (Z. 57-72). Gespeist aus den vier heutigen Abfragen in src/pages/EuerPage.tsx:45-67 (['transactions', locale], ['categories', locale], ['accounts'], ['userSettings']). Ruecklage: computeTaxTank(report.einnahmen.total, percent, movements) aus src/lib/tax-reserve-tank.ts (Felder target, saved, gap, fillRatio), percent aus reserve?.percent_override ?? resolveTaxReservePercent(settings) (src/lib/tax-reserve.ts), movements aus ['taxReserve', year] -> getTaxReserveState (src/services/tax-reserve-service.ts). Das sind EXAKT die Funktionen, aus denen die Chat-Registereintraege steuer.gewinn und steuer.ruecklage rechnen (src/features/tax/domain/questions.ts:43-129) — ein Weg zur Zahl, ADR Regel 1 erfuellt.

*Aktion:* Detail-Verweis 'Deine EUeR im Detail' -> /euer?lage=offen (Bottom-Sheet)

**3. /export und /csv — Regel 9 als 'ein Schritt pro Bildschirm'**

Beides sind Ablaeufe, keine Auswertungen: Es gibt keine Zahl, wegen der man die Flaeche oeffnet. Die Drei-Aussagen-Grenze greift hier nicht, wohl aber das Prinzip, das die ADR selbst als Quelle nennt — One Thing Per Page. Ein Bildschirm = eine Entscheidung. /export: Schritt 1 'Welcher Zeitraum?' (die vier Optionen als Liste mit Zeilen >= 44 px, Voreinstellung 'Alle', nicht als 2x2-Knopfraster), Schritt 2 'Welches Format?' (CSV / PDF, je eine Zeile mit Kurzbeschreibung statt zwei h-20-Kacheln), Schritt 3 'Export starten' mit Anzahl und Dateiname als zwei Textzeilen — die p-4 rounded-lg bg-muted-Box entfaellt, der Speicherhinweis wird Fliesstext statt Alert-Box, die zweite Alert-Box ('keine Transaktionen') wird zur Zeile unter dem Knopf. /csv: Schritt 1 'Datei waehlen' (nur die Ablageflaeche, gestrichelter Rahmen bleibt, weil er ein Bedienelement ist), Schritt 2 'Auf welches Konto?' (Kontenliste als Zeilen, nicht als Select), Schritt 3 'Welche Spalte ist was?' nur mit den drei PFLICHTfeldern Datum/Betrag/Empfaenger plus Trennzeichen, Schritt 4 'Optionale Spalten' (Beschreibung, Waehrung, Kategorie, IBAN), Schritt 5 'Pruefen'. Fortschritt 'Schritt {n} von {m}' als eine Zeile im Rahmen. Die Kontoart wird NICHT mehr gefragt (siehe offene Frage).

*Datenquelle:* /export: useQuery ['transactions', 'export'] -> getAllTransactions() und transactionStorage.exportToCSV bzw. der jsPDF-Zweig, alle heute in src/components/DataExport.tsx:31-39, 62-73, 102-151. filteredTransactions.length ist die einzige Zahl der Flaeche und bleibt dieselbe Rechnung (DataExport.tsx:41-60). /csv: useQuery ['accounts'] -> getAccounts (src/components/CsvUploader.tsx:25) und applyAutoCategorization (src/services/transaction-service.ts); Pruefschritt aus den vier ReviewTable-Abfragen getHierarchicalCategories, getAllTransactions, getMerchantRules, getAccounts (src/components/ReviewTable.tsx:27-33). Keine neue Abfrage, keine neue Rechnung.

*Aktion:* Schritte adressierbar unter DERSELBEN Route: /export?schritt=format|bestaetigen, /csv?schritt=konto|spalten|optional|pruefen

### Detailschritt
- /tax?lage=offen — Bottom-Sheet (max-h-[90dvh], overflow-y-auto, wie CoachFokussiert): alle Rubriken als entrahmte Liste (Ueberschrift + divide-y; TaxRubricCard verliert InteractiveCard UND ihre Innenbox rounded-lg border bg-muted/20), die Vorschlagsliste ohne Karte je Eintrag (das <li rounded-lg border> aus TaxSuggestionsSection.tsx:152 wird eine Zeile mit Haarlinie), Arbeitsweg & Homeoffice (TaxCommuteCard ohne <Card>), CSV-Export als Textknopf statt InteractiveCard, EUeR-Verweis als Zeile, 'Werte fuer Veranlagungszeitraum {year}' und TaxDisclaimer als Fussnoten. Buchungen (report.txCount) steht hier, nicht oben.
- /euer?lage=offen — Bottom-Sheet: Betriebseinnahmen (report.einnahmen.total + lines) und Betriebsausgaben (report.ausgaben.deductibleTotal + lines) als zwei aufklappbare Abschnitte mit Haarlinie statt EuerLinesCard, Warnungen als Zeilen, Privatentnahmen/-einlagen, Steuerruecklage mit Tank samt Bewegungsliste und den beiden Aktionen 'zurueckgelegt'/'Steuer gezahlt' (DecimalInput bleibt Pflicht nach check:decimal-inputs), CSV-Export als Textknopf, TaxDisclaimer.
- Die Jahreswahl bleibt der bestehende Query-Parameter ?year= auf /tax und /euer (TaxReportPage.tsx:87-91, EuerPage.tsx:107-111). Er darf NICHT umbenannt werden — der Deep-Link bricht sonst (ADR Regel 5). Der neue Detailschritt bekommt daneben ?lage=offen wie beim Coach; beide Parameter muessen sich vertragen.
- /export?schritt=format und /export?schritt=bestaetigen — Zurueck-Taste geht einen Schritt zurueck, nicht aus dem Fluss. Ohne Parameter startet Schritt 1.
- /csv?schritt=konto, ?schritt=spalten, ?schritt=optional, ?schritt=pruefen. Der geparste Dateikopf lebt heute nur in React-State (rawHeaderLine, CsvUploader.tsx:167) — ADR Regel 8 verlangt, dass ein Dichtewechsel mitten im Fluss nichts verliert; Vorbild ist features/onboarding/data/onboarding-draft-store.ts.
- /csv?schritt=pruefen ist die BENANNTE Listen-Ausnahme und darf scrollen. Je Zeile nur Datum, Empfaenger, Betrag; Auto-Kategorie, Zuordnung und Dubletten-Hinweis in ein Bottom-Sheet je Buchung. Sammelzuordnung als Aktionszeile UEBER der Liste statt als eingefaerbter Kasten darin (ReviewTable.tsx:284-303). Die Paginierung (PAGE_SIZE, ReviewTable.tsx:240) entfaellt zugunsten der Liste — sie ist ein Tabellen-Hilfsmittel, kein Telefon-Muster.

### Begründung

Zur ausdruecklich gestellten Frage: JA, auf /export und /csv ist Regel 9 als 'ein Schritt pro Bildschirm' zu lesen, nicht als 'drei Aussagen'. Die ADR nennt One Thing Per Page (Jarrett/GOV.UK) selbst als das Prinzip, dem die fokussierte Fassung folgt, und der ausloesende Befund war ein ABLAUF (SituationStep/FeaturesStep mit 17 bzw. 12 gleichzeitigen Entscheidungen). Regel 9 formuliert das Mass fuer Auswertungsflaechen, weil dort keine Entscheidungen, sondern Aussagen die Einheit sind — die Grenze selbst ist in beiden Faellen dieselbe: die Zahl der Dinge, die gleichzeitig zu verarbeiten sind. Fuer einen Ablauf ist diese Einheit die Entscheidung. Zwei Folgen: (a) /export und /csv duerfen MEHR Bildschirme bekommen als heute, das ist kein Verstoss gegen 'ein Bildschirm', sondern seine Umsetzung; (b) die Drei-Aussagen-Zaehlung ist dort nicht anzuwenden, wohl aber 'keine Boxen' — die sechs Kartenrahmen und die Alert-/Vorschau-Kaesten fallen unabhaengig von der Ablauf-Frage. /tax und /euer sind dagegen echte Auswertungsflaechen und werden nach der vollen Regel 9 gebaut. Zur Rangfolge auf /tax und /euer: Beide Flaechen oeffnet man mit genau einer Frage — 'was kann ich absetzen' und 'was habe ich verdient'. markedTotal bzw. gewinn sind diese Antwort und stehen deshalb als groesste Zahl zuerst. Die zweite Aussage ordnet die erste ein (creditTotal sagt, was davon wirklich Geld ist; gap sagt, was vom Gewinn schon dem Finanzamt gehoert) — dieselbe Bauform wie Kontostand/frei-bis-Gehalt bei CoachFokussiert. Die dritte ist der EINE naechste Schritt, nicht eine dritte Zahl: Regel 3 verlangt Aussage vor Detail vor Konfiguration, und eine Zaehlung wie txCount ist Detail. Bewusst NICHT als Aussage gewaehlt: report.paramsExact/paramsUsedYear (eine Einschraenkung, kein Ergebnis; gehoert als Fussnote in den Detailschritt) und der Tank-Fuellstand als Grafik (er zeigt dieselbe Zahl wie gap ein zweites Mal). Nichts wird amputiert: Alle heute sichtbaren Bausteine bleiben erreichbar, unter derselben Route, hinter ?lage=offen bzw. ?schritt=. Kein Wert dieser Flaeche entsteht neu — jede genannte Zahl kommt aus buildTaxYearReport, buildEuerReport, computeTaxTank oder buildPendingTaxSuggestions, also aus denselben reinen Funktionen, die auch die Chat-Registereintraege in src/features/tax/domain/questions.ts benutzen. src/App.tsx muss NICHT angefasst werden: die vier Routen bleiben unveraendert, die Schritte sind Query-Parameter. Voraussetzung fuer den Umbau ist der Slice-Schnitt, den src/features/tax/README.md selbst ankuendigt: die 25 Abfragen und 20 Service-Importe wandern nach src/features/tax/application/use-tax-report.ts und use-euer-report.ts, die Darstellung nach src/features/tax/presentation/{desktop,mobile}/; /export und /csv brauchen einen eigenen Slice (Vorschlag: src/features/data-transfer/) oder bleiben duenne Seiten mit einem application-Hook. Ohne diesen Schritt laesst sich die zweite Praesentation nicht danebenstellen, ohne die Datenbeschaffung ein zweites Mal zu schreiben — genau das misst view-data-budget.json.

### Benötigte Texte (für S2)

| Schlüssel | de | en |
|---|---|---|
| `common.next` | Weiter | Next |
| `tax.focused.detailTitle` | Alles zur Steuer | Everything on tax |
| `tax.focused.more` | Rubriken, Arbeitsweg und Export | Categories, commute and export |
| `tax.focused.openSuggestions` | {count} Buchungen zum Prüfen | {count} transactions to review |
| `tax.focused.allMarked` | Alles markiert | Everything marked |
| `euer.focused.detailTitle` | Deine EÜR im Detail | Your income statement in detail |
| `euer.focused.reserveGap` | Noch zurückzulegen | Still to set aside |
| `euer.focused.reserveDone` | Rücklage steht | Reserve is covered |
| `euer.focused.unassigned` | {count} Ausgaben ohne EÜR-Blatt | {count} expenses without a tax schedule |
| `euer.focused.allAssigned` | Alles zugeordnet | Everything assigned |
| `dataExport.focused.stepRange` | Welcher Zeitraum? | Which period? |
| `dataExport.focused.stepFormat` | Welches Format? | Which format? |
| `dataExport.focused.stepConfirm` | Export starten | Start export |
| `csv.focused.stepFile` | Datei wählen | Choose file |
| `csv.focused.stepAccount` | Auf welches Konto? | Into which account? |
| `csv.focused.stepRequiredColumns` | Welche Spalte ist was? | Which column is which? |
| `csv.focused.stepOptionalColumns` | Optionale Spalten | Optional columns |
| `csv.focused.stepReview` | {count} Buchungen prüfen | Review {count} transactions |
| `csv.focused.progress` | Schritt {step} von {total} | Step {step} of {total} |

### Gemeinsame Dateien (entscheiden über Parallelisierbarkeit)
- `C:/Users/bosed/dyad-apps/fintracker-mobile-ui/src/i18n/translations/de.ts — 15 neue Schluessel (Basissprache, Pflicht). HOECHSTES Konfliktrisiko: jede parallel laufende Flaeche schreibt in dieselbe Datei.`
- `C:/Users/bosed/dyad-apps/fintracker-mobile-ui/src/i18n/translations/en.ts — dieselben Schluessel; src/i18n/__tests__/locale-parity.test.ts vergleicht alle Blaetter der SUPPORTED_LOCALES gegen de.`
- `C:/Users/bosed/dyad-apps/fintracker-mobile-ui/src/i18n/translations/ru.ts — ebenfalls SUPPORTED_LOCALE, paritaetspflichtig.`
- `C:/Users/bosed/dyad-apps/fintracker-mobile-ui/src/i18n/translations/tlh.ts — INACTIVE_LOCALES, NICHT paritaetspflichtig; nur mitziehen, wenn dort fuer diese Flaeche schon Text steht.`
- `C:/Users/bosed/dyad-apps/fintracker-mobile-ui/card-rule-budget.json — max steht auf 149 und muss um die 6 aufgeloesten Kartenrahmen dieser Flaeche SINKEN (DataExport 1, CsvUploader 2, ReviewTable 2, TaxCommuteCard 1). maxFokussiert (2, Ziel 0) darf durch die neuen presentation/mobile/-Dateien NICHT steigen — gemessen waeren es +10, wenn die Bausteine unveraendert mitzoegen.`
- `C:/Users/bosed/dyad-apps/fintracker-mobile-ui/view-data-budget.json — max steht auf 204 und muss um die 25 Abfragen/Mutationen plus 20 Service-Importe dieser Flaeche sinken, sobald sie nach features/tax/application wandern. Jede parallele Migration zieht dieselbe Zahl.`
- `C:/Users/bosed/dyad-apps/fintracker-mobile-ui/slice-presentation-budget.json — max steht auf 11, maxBausteine auf 0. Beides ist heikel: Jeder Import der neuen features/tax/presentation/ aus src/components/tax|euer, DataExport.tsx, CsvUploader.tsx oder ReviewTable.tsx ERHOEHT max. Die Bausteine muessen also mitziehen oder props-getrieben werden (Kochrezept Schritt 8) — sonst verurteilt die Ratsche genau diese Migration, wie beim Coach und bei Trading.`
- `C:/Users/bosed/dyad-apps/fintracker-mobile-ui/bundle-size-budget.json — ADR Regel 6 verlangt lazy je Dichte; vier Flaechen ergeben bis zu acht neue Chunks, darunter ReviewTable (515 Zeilen) und CsvUploader (403 Zeilen). Einzelbudgets ab 20 kB plus Gesamtgrenze.`
- `C:/Users/bosed/dyad-apps/fintracker-mobile-ui/touch-target-budget.json — max 0 und maxVarianten 0, also kein Backlog mehr, sondern ein Waechter gegen den Rueckfall. DataExport.tsx:203 benutzt size='sm' fuer die Zeitraum-Knoepfe; die neuen Listenzeilen in /export und /csv brauchen fokussiert:min-h-11 (bei quadratischen Zielen zusaetzlich min-w-11).`
- `C:/Users/bosed/dyad-apps/fintracker-mobile-ui/state-coverage-allowlist.json — /csv und /export tragen dort 'leer: entfaellt' mit Begruendungen ('Einstiegspunkt und immer bedienbar', 'Ausgabewege stehen immer zur Verfuegung'). Nach der Aufteilung in adressierbare Schritte sind beide Begruendungen nachzupruefen. /tax und /euer stehen NICHT in der Liste und brauchen weiterhin [ZUSTAND /tax:leer|fehler]- und [ZUSTAND /euer:leer|fehler]-Tests, nach der Verzweigung in beiden Dichten.`
- `C:/Users/bosed/dyad-apps/fintracker-mobile-ui/e2e-tests/fixtures/routes.ts — /tax, /euer, /csv, /export stehen bereits in ALL_ROUTES (Z. 26, 27, 35, 36). Keine neue Zeile noetig, aber die ADR verlangt den Lauf in BEIDEN Dichten; die Umstellung der Suite ist gemeinsame Infrastruktur.`
- `C:/Users/bosed/dyad-apps/fintracker-mobile-ui/src/components/tax/TaxCategorySelect.tsx — WICHTIGSTER Kopplungspunkt ausserhalb der Flaeche: Die Datei liegt in src/components/tax/, wird aber von DREI fremden Flaechen benutzt (src/components/dashboard/TransactionDetailsPanel.tsx:12, src/components/settings/CategoryForm.tsx:13, src/components/transactions/TransactionFormDialog.tsx:20). Ein Umzug von src/components/tax/ nach features/tax/presentation/ fasst damit die Buchungs-, Dashboard- und Einstellungsflaechen an. Empfehlung: TaxCategorySelect NICHT mitziehen bzw. nach features/shared/presentation/ legen (>= 2 Slices, AGENTS.md Paragraf 3).`
- `C:/Users/bosed/dyad-apps/fintracker-mobile-ui/src/components/dashboard/TransactionDetailsPanel.tsx — nur falls TaxCategorySelect umzieht (Importpfad).`
- `C:/Users/bosed/dyad-apps/fintracker-mobile-ui/src/components/settings/CategoryForm.tsx — nur falls TaxCategorySelect umzieht (Importpfad).`
- `C:/Users/bosed/dyad-apps/fintracker-mobile-ui/src/components/transactions/TransactionFormDialog.tsx — nur falls TaxCategorySelect umzieht (Importpfad).`
- `C:/Users/bosed/dyad-apps/fintracker-mobile-ui/src/__tests__/layout-overlap.sweep.test.tsx — laedt alle vier Seiten (Z. 72, 73, 76, 77). Die Sweep-Liste muss die neuen Praesentationen abdecken, sonst prueft sie ab dem Umbau die falsche Fassung.`
- `C:/Users/bosed/dyad-apps/fintracker-mobile-ui/src/pages/__tests__/screens.empty-state.test.tsx — importiert TaxReportPage direkt (Z. 24, 58).`
- `C:/Users/bosed/dyad-apps/fintracker-mobile-ui/src/lib/tutorial-steps.ts — heute unkritisch (keine Anker), ABER: csv fuehrt step('upload','/csv') und step('review','/csv') (Z. 117-119) und export step('ownership','/export') (Z. 269-271). Der Lauf navigiert auf die ROUTE; mit ?schritt= landet die Fuehrung immer auf Schritt 1, und der Schritt 'review' zeigt dann nicht mehr, was er benennt. Route-Eintraege muessen um den Schritt-Parameter ergaenzt werden.`
- `C:/Users/bosed/dyad-apps/fintracker-mobile-ui/src/features/tax/README.md — sagt woertlich 'Wandert die Oberflaeche spaeter hierher, kommen presentation/ und application/ daneben'. Der Abschnitt ist beim Umbau nachzufuehren.`
- `C:/Users/bosed/dyad-apps/fintracker-mobile-ui/docs/architecture/darstellungsdichte.md — Abschnitt 'Was das fuer den Bestand heisst' (3 von rund 25 Flaechen verzweigt) und die Zaehlung in 'Folgen fuer die Waechter' nachziehen.`
- `C:/Users/bosed/dyad-apps/fintracker-mobile-ui/src/features/shared/presentation/InfoGroup.tsx — nur lesen/pruefen. InfoStatStrip ist bereits dichtebewusst (fokussiert:divide-y, keine Box). Wird sie fuer die fokussierte Fassung geaendert (z. B. eine Variante mit EINEM grossen Wert), beruehrt das JEDE Flaeche der App — dann ist es ein eigener, koordinierter Schritt.`
- `C:/Users/bosed/dyad-apps/fintracker-mobile-ui/src/features/shared/presentation/InteractiveCard.tsx — nur lesen. In der fokussierten Fassung darf sie nicht vorkommen (Regel 9/10); in der kompakten bleibt sie fuer TaxRubricCard, EuerLinesCard, TaxReserveTankCard, TaxExportCard, EuerExportCard, EuerPointerCard die richtige Bauform.`
- `C:/Users/bosed/dyad-apps/fintracker-mobile-ui/platform-parity-allowlist.json — nur falls doch ein hidden <bp>:*-Paar entsteht. Bei lazy je Dichte (ADR Regel 6) darf es keines geben; wenn diese Datei angefasst werden muss, ist der Umbau falsch gebaut.`

### Offene Fragen
- Kontoart im CSV-Fluss ableiten statt fragen? Sie wird heute ZWEIMAL abgefragt (CsvUploader.tsx:241 und :304) und ist aus dem gewählten Konto ableitbar (account.type === 'credit_card'). Ableiten würde eine Entscheidung und einen ganzen Schritt sparen — es ist aber eine Verhaltensänderung an der Vorzeichenlogik des Imports (creditNegated) und braucht deshalb eine ausdrückliche Entscheidung plus [REGRESSION]-Test. NICHT nebenbei mitmachen.
- Wie viele Schritte bekommt /export wirklich? One Thing Per Page sagt drei (Zeitraum, Format, Bestätigen). Für einen Export mit genau zwei Vorgaben und sinnvollen Voreinstellungen ('Alle', CSV) kann das mehr Reibung als Klarheit sein. Alternative: ein Bildschirm mit EINER Entscheidung (Format) und dem Zeitraum als Textknopf, der ein Sheet öffnet. Ich empfehle drei Schritte, weil die Flächen sonst wieder auseinanderdriften — aber die Entscheidung gehört benannt.
- Welche drei Felder bleiben in einer Zeile der Prüfliste (/csv?schritt=pruefen) sichtbar? Vorschlag Datum, Empfänger, Betrag; Auto-Kategorie, Zuordnung und Dubletten-Hinweis in ein Sheet je Buchung. Das ist die Import-Prüfung — wer hier etwas versteckt, lässt eine Dublette durch. Braucht Bestätigung, bevor die 8-spaltige Tabelle fällt.
- Die Vorschlagszahl auf /tax setzt voraus, dass buildPendingTaxSuggestions aus src/components/tax/TaxSuggestionsSection.tsx in ein ViewModel wandert. Das ist KEINE neue Abfrage (['automationSuggestions'] und ['accounts'] existieren), aber ein Ortswechsel, der view-data-budget.json und slice-presentation-budget.json gleichzeitig bewegt. Reihenfolge mit den parallel laufenden Migrationen abstimmen.
- Sprache der Query-Parameter: der Bestand benutzt ?year= (englisch), CoachFokussiert ?lage= (deutsch). ?year= darf nicht umbenannt werden (Deep-Link, ADR Regel 5). Bleibt es bei der Mischung, oder bekommt die App eine Regel? Das ist ein Fall für 'letzter günstiger Zeitpunkt' — jetzt eine Konvention, nach dem Merge eine Migration von Lesezeichen.
- ADR Regel 8 (Dichtewechsel darf nichts verlieren) trifft /csv hart: rawHeaderLine, mapping, selectedAccountId und die bearbeiteten Zeilen der Prüfliste leben ausschließlich in React-State. Wird der Entwurfs-Mechanismus aus features/onboarding/data/onboarding-draft-store.ts hier übernommen, oder gilt der Verlust beim Drehen des Geräts als hinnehmbar? Ich halte ihn nicht für hinnehmbar — ein halb zugeordneter Import ist teurer als ein halb ausgefülltes Onboarding.
- Bekommen /export und /csv einen eigenen Slice (Vorschlag src/features/data-transfer/) oder bleiben sie dünne Seiten mit je einem application-Hook? Sie teilen keine Domänenlogik mit tax/euer; ein gemeinsamer Slice wäre nur ein Ordner, kein Feature.

---

## Budgets /budgets und Liquiditaet /liquidity (src/pages/BudgetsPage.tsx, src/pages/LiquidityPage.tsx, src/components/dashboard/LiquidityReport.tsx, src/components/budgets/**)
**Routen:** `/budgets`, `/liquidity`, `/simulation (nur Navigate auf /liquidity?mode=simulation, src/pages/SimulationPage.tsx)`
**Ist-Zustand:** Slice nein · 16 Kartenrahmen · 14 Abfragen in der Darstellung

### Befunde
- KEIN Slice fuer beide Flaechen. src/features/budgets/ hat NUR domain/questions.ts (Abfrage-Register) — kein data/, kein application/, kein presentation/. Fuer Liquiditaet existiert gar kein Slice; die Fachlogik liegt in src/components/dashboard/. Damit gibt es nichts, woran eine zweite Praesentation andocken koennte (ADR Regel 1/6).
- KEINE fokussierte Fassung, keine Dichte-Weiche. Weder BudgetsPage.tsx noch LiquidityPage.tsx ruft useDisplayDensity(); es gibt kein lazy je Dichte (ADR Regel 6/7). Verzweigt wird ausschliesslich per responsivem CSS (grid-cols-3 sm:4 md:6 lg:8 bzw. xl:grid-cols-[...]).
- 14 Datenzugriffe in der Darstellung (check:view-data zaehlt genau das): BudgetsPage 3 useQuery + 2 useMutation + 3 Service-Importe (budget-service, transaction-service, account-service) = 8; SweepCard 2 useQuery + 2 Service-Importe = 4; LiquidityReport 1 useQuery + 1 Service-Import (getCategories) = 2. LiquidityPage selbst 0.
- 16 Kartenrahmen/Boxen in der Flaeche: BudgetsPage 1 (<Card> Leerzustand), SuggestedBudgets 1 (<Card>), BudgetTile 1 (rounded-2xl border bg-card — zur Laufzeit N-mal, ein Rahmen je Budget, genau die von ADR Regel 10 verbotene Form 'ein wiederholter Eintrag bekommt keine Karte je Stueck'), BudgetDetailDialog 2, BudgetFormDialog 6, SweepCard 1 (rounded-xl bg-muted/20), WaterfallPanel 1 (Warnbox), LiquidityReport 3 (<Card> um die Grafik, rounded-xl border als Heatmap-Platzhalter, <details class='rounded-xl border bg-card'>).
- /liquidity ist die schwerste Verletzung von Regel 9. Auf einem Bildschirm stehen heute gleichzeitig: 3 Auswahlfelder (Horizont/Puffer/Basis), DataQualityNotice, Chat-Szenario-Alert, AskYourMoney (278 Zeilen Hero mit eigener Eingabe), Risiko-Alert, Grafik + Statuschip + Umschalter + Bildunterschrift, 4 KPIs im InfoStatStrip, Risikotreiber-Liste, Empfehlung, StressPresetQuickAdd (403 Zeilen), ForecastPlanner (418), ActiveChangesPanel, RiskSummaryCard, AdaptiveSpendingToggle, SimulationControls, BudgetOptimizerPanel (488) hinter <details>, MonthlyOverviewTable und darueber WaterfallPanel mit 5 Balkenstufen. Rund 25 Aussagen statt drei; ohne Scrollen ist davon nichts erfassbar.
- /budgets zeigt heute Kacheln, die auf dem Telefon nichts aussagen. BudgetTile ist bewusst textarm (nur Emoji, Statuspunkt, Tank-SVG, Uebertragsabzeichen) — die Zahl steht ausschliesslich im aria-label. In einem 3-spaltigen Raster auf 412 CSS-Pixeln liest ein Mensch also KEINEN Betrag; er muss jede Kachel einzeln oeffnen. Genau der Fehler 'Mobile als kleinerer Desktop' (AGENTS.md §4).
- Zwei Wege zur selben Zahl bestehen schon heute (ADR Regel 1): src/features/budgets/domain/questions.ts rechnet in budget.rest und budget.tagesrate 'Rest = Summe(budget.limit) − Summe(spent)' aus dem BASISlimit, waehrend BudgetStatus.remaining (src/lib/budget-logic.ts:169) bei Rollover-Budgets gegen effectiveLimit rechnet. Chat und Flaeche koennen fuer denselben Monat verschiedene Restbetraege nennen.
- ?mode=simulation wird an 6 Stellen geschrieben (features/debts/domain/questions.ts 3x, money-questions/presentation/ZielAntwort.tsx 2x, pages/SimulationPage.tsx) und von NIEMANDEM gelesen — der Deep-Link landet auf der Seite, nicht auf dem Inhalt (ADR Regel 5). Gelesen werden auf /liquidity nur szenario, betrag, inTagen, und zwar in LiquidityReport.tsx, also in der Darstellung.
- Die e2e-Vertikale haengt am heutigen DOM von /budgets: e2e-tests/fixtures/vertical-slice.ts erwartet heading 'Budgets' (exact), einen Vorschlags-Button mit /\/Mo\./ und ein Kachel-aria-label /ausgeschoepft/. Alle drei verschwinden beim Umbau.
- Tutorial-Anker in der Flaeche: budgets-add (BudgetsPage.tsx:119) und budgets-edit (BudgetDetailDialog.tsx:173). Beide muessen laut ADR Regel 5 in BEIDEN Dichten existieren. /liquidity hat keine Anker (tutorial-steps.ts: forecast, buffer ohne Anker).

### Entwurf — die Aussagen

**1. /budgets — Aussage 1: 'Diesen Monat noch frei'**

Ganz oben, groesste Zahl der Flaeche: Label 'Diesen Monat noch frei' (text-xs, uppercase, muted), darunter die Summe der Restbetraege aller monatlichen Budgets in text-5xl tabular-nums. Ist die Summe negativ, wechselt das Label auf 'Diesen Monat ueberzogen' und der Betrag steht in text-warning als Fehlbetrag — ein ueberzogenes Budget als '0 EUR uebrig' auszugeben waere die halbe Wahrheit (dieselbe Entscheidung, die budget.rest schon getroffen hat). Kein Rahmen, kein Hintergrund, kein Schatten.

*Datenquelle:* getBudgetOverview() aus src/services/budget-service.ts:90, Query-Key ['budget-overview'] — DERSELBE Key, den BudgetsPage.tsx:33 und src/hooks/useGlobalAtmosphere.ts:57 heute benutzen, also kein zusaetzlicher Ladevorgang. Summiert wird BudgetStatus.remaining (src/lib/budget-types.ts:146, berechnet in src/lib/budget-logic.ts:169). Die Summe entsteht in einer NEUEN reinen Funktion budgetMonatsstand(statuses, jetzt) unter src/features/budgets/domain/ — keine neue Abfrage.

*Aktion:* Keine. Reines Readout, deshalb ausdruecklich ohne Karten-Chrome (Prinzip 8: ein Rahmen verspraeche eine Aktion, die es nicht gibt).

**2. /budgets — Aussage 2: 'Pro Tag bis Monatsende'**

Unter einer Haarlinie (border-t, pt-5): der Tagesbetrag in text-3xl tabular-nums, darunter in text-sm 'fuer die restlichen {n} Tage'. Sie ordnet die grosse Zahl ein — ein Restbetrag beantwortet nicht, ob er noch 3 oder 26 Tage tragen muss. Bewusst kleiner gesetzt, wie 'frei bis Gehalt' im Coach. Bei negativem Rest entfaellt die Zeile und es steht stattdessen die Zahl der ueberzogenen Budgets ('2 von 7 ueberzogen') — eine Tagesrate aus einem Fehlbetrag waere eine erfundene Auskunft.

*Datenquelle:* Dieselbe Funktion budgetMonatsstand(statuses, jetzt): Rest / verbleibende Tage einschliesslich heute. Die Arithmetik EXISTIERT HEUTE bereits — src/features/budgets/domain/questions.ts, Eintrag budget.tagesrate (letzterTag/verbleibend, ca. Z. 200-215). Sie wird dorthin zurueckgefuehrt, statt ein zweites Mal geschrieben zu werden (ADR Regel 1). Die Zahl der Ueberzogenen ist statuses.filter(s => s.health === 'over').length — dasselbe Praedikat wie useGlobalAtmosphere.ts:75 (budgetOvercount).

*Aktion:* Keine.

**3. /budgets — Aussage 3: die Budgetliste (Listen sind die benannte Ausnahme)**

Unter einer zweiten Haarlinie eine divide-y-Liste ohne jeden Rahmen, eine Zeile je Budget, sortiert: ueberzogene zuerst, dann nach Auslastung absteigend. Zeile = Emoji + Name links, rechts '{Rest} uebrig' bzw. '{Betrag} drueber' (text-warning), darunter eine 2 px hohe Fuellstandslinie in der Ampelfarbe — kein Tank, keine Kachel, kein Rahmen je Stueck (ADR Regel 10). Ganze Zeile antippbar, min-h-11. Gibt es noch kein Budget, steht an derselben Stelle die Vorschlagsliste in derselben Zeilenform ('+ {Limit}/Mo.'): Die Liste bleibt die eine Aussage, der Leerzustand braucht keine eigene Box. Darunter EINE Zeile mit den beiden Rahmen-Aktionen '+ Budget' (data-tour-id='budgets-add') und 'Vorschlaege & Details'.

*Datenquelle:* statuses[] bzw. suggestions[] aus demselben getBudgetOverview(); Felder budget.icon, budget.name, remaining, fillPercent, health (src/lib/budget-types.ts:146) sowie BudgetSuggestion.name/limit/icon. Baustein: src/features/shared/presentation/ListRow.tsx (divide-y, Touch-Ziel >= 44 px, kein Rahmen je Zeile) — vorhanden, wird nur benutzt.

*Aktion:* Zeile -> Detail-Sheet ?lage=budget&id=<budgetId> (ersetzt BudgetDetailDialog); '+ Budget' -> ?lage=neu (BudgetFormDialog als Sheet); 'Vorschlaege & Details' -> ?lage=offen.

### Detailschritt
- /budgets ?lage=offen (Bottom-Sheet, darf scrollen — Regel 9 richtet sich an das, was man beim Oeffnen sieht): SuggestedBudgets ENTRAHMT (Ueberschrift + Zeilenliste statt <Card> + Chip-Buttons), Uebersicht ueber nicht-monatliche Budgets (weekly/yearly), Drift-Hinweise ('Limit anpassen?') gesammelt.
- /budgets ?lage=budget&id=<id> (Sheet, ersetzt BudgetDetailDialog): BudgetTank in Grossform, Ampel-Abzeichen, Ausgegeben/Limit/Rest, carryIn/carryOut, swept, Drift-Knopf, SweepCard (Prognose-Gate + GiroCode/ETF-Projektion). data-tour-id='budgets-edit' bleibt hier — ADR Regel 5.
- /budgets ?lage=neu bzw. ?lage=bearbeiten&id=<id> (Sheet): BudgetFormDialog unveraendert im Inhalt. Konfiguration steht damit auf einer eigenen Ebene, nie neben der Aussage (ADR Regel 3, Rang 3). Die sechs rounded-lg-border-Boxen des Formulars sind Bedienelemente, kein Befund.
- /liquidity ?lage=offen (Bottom-Sheet, darf scrollen), in dieser Reihenfolge: AskYourMoney ('Frag dein Geld') · Heatmap-Ansicht (RiskDensityChart) samt ChartViewToggle · die restlichen zwei KPIs (Min. Giro, Min. verfuegbar) · Risikotreiber + Empfehlung aus analysis · RiskSummaryCard · ActiveChangesPanel · Steuerung Horizont/Puffer/Basis · StressPresetQuickAdd · ForecastPlanner · AdaptiveSpendingToggle · SimulationControls · BudgetOptimizerPanel · MonthlyOverviewTable · WaterfallPanel · DataQualityNotice. Die FeatureGate feature='simulation' bleibt exakt dort, wo sie heute sitzt, samt PremiumTeaser (tourId 'liquidity-simulation-teaser').
- /liquidity: ?mode=simulation oeffnet diesen Detailschritt. Der Parameter wird an 6 Stellen geschrieben und heute von niemandem gelesen — der fokussierte Umbau ist der Zeitpunkt, an dem der Deep-Link auf dem INHALT landet statt auf der Seite (ADR Regel 5).
- /liquidity: ?szenario= (plus betrag/inTagen) bleibt wirksam und ersetzt weiterhin den Basislauf. Auf dem fokussierten Bildschirm steht dafuer EINE Zeile unter der Grafik: 'Szenario aktiv · verwerfen'. Ohne sie zeigte der Link 'volle Analyse' veraenderte Zahlen, ohne zu sagen, dass sie veraendert sind.

### Begründung

DIE DREI AUSSAGEN VON /liquidity (im Schema stehen nur drei Plaetze, deshalb hier in derselben Strenge):

(1) TIEFSTSTAND — die groesste Zahl der Flaeche, mit dem vorhandenen Label liquidityReport.lowestBalanceLabel ('Tiefststand'), darunter als Bildunterschrift das Datum ueber fmtDate(). Farbton: text-destructive bei < 0, text-warning bei Pufferbruch, sonst neutral (schwellwertbewusst, Prinzip 2). QUELLE: useForecast({months, safetyBuffer, bufferBasis}) -> forecast.risk.lowestBalance / .lowestBalanceDate — exakt die Felder, die LiquidityReport.tsx heute im InfoStatStrip zeigt. Query-Key ['forecast-input'] (src/hooks/useForecast.ts:27), geteilt mit Coach und Dashboard; die Engine rechnet danach rein im useMemo, eine Konfigurationsaenderung loest KEIN Nachladen aus.

(2) PUFFER — eine Zeile unter einer Haarlinie: entweder 'Erster Pufferbruch {Datum} · {n} Tage unter Puffer' (vorhandene Keys firstBreachLabel/daysUnderBuffer) oder 'Puffer {Betrag} haelt ueber {months} Monate' (ein neuer Key). Der Puffer-BETRAG wird genannt, weil die Aussage sonst nicht nachpruefbar ist — er ist eine Einstellung und liegt hinter dem Detailschritt. QUELLE: forecast.risk.firstBelowSafetyBufferDate, forecast.risk.daysBelowSafetyBuffer sowie overrides.safetyBuffer/months aus useForecastOverrides() — dieselben Werte wie in der heutigen KPI-Leiste.

(3) DER VERLAUF — ChartLinesView unveraendert (src/components/dashboard/liquidity/ChartLinesView.tsx), Hoehe ~40 dvh, OHNE <Card> darum, ohne Umschalter (die Heatmap wandert in den Detailschritt, es bleibt eine Grafik pro Bildschirm). Plan-Linie, Wahrscheinlichkeitsband und Puffer-Referenzlinie wie heute. QUELLE: das chartData-Memo, das heute in LiquidityReport.tsx steht (forecast.daily + risk.daily aus useScenarioRisk); es wandert unveraendert ins ViewModel.

WARUM DIESE DREI. Auf /liquidity fragt jemand genau eines: 'wird es knapp, und wann'. Das sind Tiefstwert (Zahl), Pufferbruch (Feststellung) und der Verlauf (Bild). Alles andere auf der heutigen Seite ist entweder Konfiguration (Horizont, Puffer, Basis, Planner, Presets, Simulationsregler) — die gehoert nach ADR Regel 3 auf eine eigene Ebene, nie neben die Aussage — oder Vertiefung (Heatmap, Treiber, Optimierer, Monatstabelle). Auf /budgets fragt jemand 'wie viel kann ich noch ausgeben', deshalb Restbetrag (Zahl), Tagesrate (Einordnung) und die Liste (die Ausnahme, die selbst eine Aussage ist).

WAS DER UMBAU STRUKTURELL VERLANGT. Beide Flaechen brauchen zuerst einen Slice, sonst gibt es nichts, woran zwei Praesentationen andocken (ADR Regel 1): src/features/budgets/{data/budget-query-keys.ts, application/use-budget-overview.ts, domain/budget-monatsstand.ts, presentation/{desktop,mobile}} und src/features/liquidity/{data,application/use-liquidity-forecast.ts, presentation/{desktop,mobile}}. Die 14 Datenzugriffe der Darstellung wandern dorthin und senken check:view-data von 204 — eine Migration, die die Zahl hebt, ist falsch gebaut. Die Seiten bleiben duenne Einstiege mit useDisplayDensity() und lazy je Dichte (Regel 6/7), Vorbild src/pages/CoachPage.tsx.

DER QUERY-KEY 'budget-overview' DARF SICH NICHT AENDERN. Er wird an vier Stellen als roher String geschrieben (BudgetsPage.tsx:33, useGlobalAtmosphere.ts:57 mit enabled:false, settings-query-keys.ts:16, use-budget-action.ts:50). Ein Schluesselmodul im Slice muss genau diesen Wert liefern, sonst lauscht die Atmosphaere ins Leere und die Chat-Aktion invalidiert den falschen Eintrag.

KEINE NEUE ABFRAGE. Jede Zahl im Entwurf kommt aus ['budget-overview'], ['forecast-input'], useForecastOverrides und (nur im Detailschritt) ['waterfall-plan'] und useScenarioRisk. Alle Betraege laufen ueber useMoneyFormat(): format() maskiert im Sanften Modus selbst, die vorhandenen lokalen Intl-Formatierer (chart-shared.eur, WaterfallPanel, SweepCard, BudgetDetailDialog) bleiben in money.mask() gewickelt — check:money-format prueft genau den Aufruf, nicht die Deklaration.

### Benötigte Texte (für S2)

| Schlüssel | de | en |
|---|---|---|
| `budgets.focused.freeThisMonth` | Diesen Monat noch frei | Still free this month |
| `budgets.focused.overThisMonth` | Diesen Monat überzogen | Over budget this month |
| `budgets.focused.perDay` | {amount} pro Tag | {amount} per day |
| `budgets.focused.perDayHint` | für die restlichen {days} Tage | for the remaining {days} days |
| `budgets.focused.overCount` | {over} von {total} Budgets überzogen | {over} of {total} budgets over |
| `budgets.focused.rowRemaining` | {amount} übrig | {amount} left |
| `budgets.focused.rowOver` | {amount} drüber | {amount} over |
| `budgets.focused.moreLink` | Vorschläge & Details | Suggestions & details |
| `budgets.focused.detailTitle` | Budgets im Detail | Budgets in detail |
| `budgets.focused.addShort` | Budget | Budget |
| `budgets.focused.suggestionAdd` | {amount}/Mo. übernehmen | Use {amount}/mo. |
| `budgets.focused.nonMonthlyHint` | {count} Budgets mit anderem Zeitraum | {count} budgets with a different period |
| `liquidityReport.focused.lowestOn` | am {date} | on {date} |
| `liquidityReport.focused.bufferHolds` | Puffer {amount} hält über {months} Monate | Buffer of {amount} holds for {months} months |
| `liquidityReport.focused.bufferBreaks` | Puffer {amount} bricht am {date} | Buffer of {amount} breaks on {date} |
| `liquidityReport.focused.scenarioActive` | Szenario aktiv | Scenario active |
| `liquidityReport.focused.scenarioClear` | verwerfen | discard |
| `liquidityReport.focused.moreLink` | Annahmen & Analyse | Assumptions & analysis |
| `liquidityReport.focused.detailTitle` | Annahmen & Analyse | Assumptions & analysis |

### Gemeinsame Dateien (entscheiden über Parallelisierbarkeit)
- `src/i18n/translations/de.ts — neue Keys budgets.focused.* und liquidityReport.focused.*; nach JEDER Aenderung sofort pnpm exec tsc --noEmit (doppelter Namespace ist sonst unsichtbar)`
- `src/i18n/translations/en.ts — paritaetspflichtig (locale-parity.test.ts, vollstaendiger Blattvergleich)`
- `src/i18n/translations/ru.ts — paritaetspflichtig`
- `src/i18n/translations/tlh.ts — INACTIVE_LOCALES, NICHT paritaetspflichtig; nur anfassen, wenn ohnehin gepflegt`
- `src/i18n/overlays/everyday/de.ts — Alltagssprache-Overlay, Pflicht je Sprache (overlay-coverage.test.ts prueft Existenz UND Mindestumfang)`
- `src/i18n/overlays/everyday/en.ts`
- `src/i18n/overlays/everyday/ru.ts`
- `card-rule-budget.json — max steht auf 149 und MUSS sinken (16 Boxen liegen in dieser Flaeche); maxFokussiert steht auf 2 mit Ziel 0 und darf durch die neuen presentation/mobile/-Dateien NICHT steigen`
- `view-data-budget.json — max steht auf 204; die 14 Zugriffe dieser Flaeche wandern in application/ und muessen die Zahl senken`
- `slice-presentation-budget.json — max 11 / maxBausteine 0; der Umzug von LiquidityReport und den budgets-Komponenten in Slices verschiebt beide Zaehlungen (ui/ und providers/ sind ausgenommen, features/shared/presentation nicht)`
- `bundle-size-budget.json — zwei lazy Buendel je Flaeche (ADR Regel 6, 'Preis')`
- `touch-target-budget.json — steht auf 0/0; jede neue verkleinerte Schaltflaeche macht sie sofort rot (fokussiert:min-h-11 neben die optische Groesse)`
- `src/App.tsx — Zeile 193 (/liquidity) und die /budgets-Route zeigen kuenftig auf duenne Einstiege mit Dichte-Weiche`
- `src/pages/SimulationPage.tsx — Weiterleitung auf /liquidity?mode=simulation; der Parameter wird erstmals gelesen`
- `src/features/budgets/domain/questions.ts — budget.rest und budget.tagesrate rechnen dieselben Zahlen (Rest, Tagesrate) und muessen auf dieselbe reine Funktion umgestellt werden, sonst zwei Wege zu einer Zahl (ADR Regel 1). LIEGT IN MEINER SLICE, WIRD ABER VOM ABFRAGE-REGISTER (money-questions) GELESEN — hoechste Kollisionsgefahr`
- `src/features/budgets/domain/__tests__/questions.test.ts — Ratschen/Korpus des Registers haengen an den Antworttexten`
- `src/hooks/useGlobalAtmosphere.ts — liest ['budget-overview'] mit enabled:false; der Schluesselwert darf sich nicht aendern, sonst lauscht die Atmosphaere ins Leere`
- `src/features/settings/data/settings-query-keys.ts — fuehrt budgetOverview: ['budget-overview'] als zweite Stelle desselben Schluessels`
- `src/features/money-questions/application/use-budget-action.ts — invalidiert ['budget-overview'] nach schreibenden Chat-Aktionen`
- `src/services/cloud-mcp-sync-service.ts — ruft getBudgetOverview direkt; nur betroffen, falls sich die Service-Signatur aendert`
- `src/components/dashboard/liquidity/ChartLinesView.tsx — wird von der fokussierten Fassung importiert bzw. in die Slice gezogen`
- `src/components/dashboard/liquidity/LiquidityViews.tsx — ChartViewToggle, ActiveChangesPanel, MonthlyOverviewTable, SimulationControls wandern in den Detailschritt`
- `src/components/dashboard/liquidity/chart-shared.ts — eur/fmtDate/HORIZON_OPTIONS/maxBreach, geteilt mit check:money-format (importierte Formatierer zaehlen mit)`
- `src/components/dashboard/ForecastPlanner.tsx — Detailschritt`
- `src/components/dashboard/StressPresetQuickAdd.tsx — Detailschritt`
- `src/components/dashboard/BudgetOptimizerPanel.tsx — Detailschritt`
- `src/components/dashboard/DataQualityNotice.tsx — Detailschritt`
- `src/components/dashboard/finrisk/AskYourMoney.tsx — Detailschritt`
- `src/components/dashboard/finrisk/RiskDensityChart.tsx — Detailschritt (Heatmap)`
- `src/components/dashboard/finrisk/RiskSummaryCard.tsx — Detailschritt`
- `src/components/dashboard/finrisk/AdaptiveSpendingToggle.tsx — Detailschritt`
- `src/components/premium/PremiumTeaser.tsx + src/components/FeatureGate.tsx — die simulation-Gates muessen in der fokussierten Fassung an derselben Stelle sitzen (Feature-Paritaet)`
- `e2e-tests/fixtures/vertical-slice.ts — createBudgetFromSuggestion() haengt an heading 'Budgets' (exact), Vorschlags-Button /\/Mo\./ und Kachel-aria-label /ausgeschoepft/; alle drei verschwinden`
- `e2e-tests/fixtures/routes.ts — /budgets und /liquidity muessen in BEIDEN Dichten laufen (ADR 'Folgen fuer die Waechter')`
- `e2e-tests/vertical-slice-visual.spec.ts — Referenzbilder der Budget-Strecke`
- `e2e-tests/vertical-slice-a11y.spec.ts`
- `e2e-tests/all-screens-a11y.spec.ts`
- `e2e-tests/all-screens-performance.spec.ts`
- `src/lib/tutorial-steps.ts — Anker budgets-add und budgets-edit muessen in BEIDEN Dichten existieren (ADR Regel 5); nur aendern, falls ein Anker nicht erhalten werden kann`
- `state-coverage-allowlist.json — der Eintrag zu /simulation verweist ausdruecklich auf /liquidity; je neuer Praesentation braucht es [ZUSTAND /route:leer] und :fehler`
- `src/pages/__tests__/BudgetsPage.states.test.tsx — traegt heute die Zustands-Tags fuer /budgets, wandert mit`
- `src/components/dashboard/__tests__/LiquidityReport.states.test.tsx — Zustands-Tags fuer /liquidity`
- `src/components/dashboard/__tests__/LiquidityReport.error-state.test.tsx`
- `src/components/dashboard/__tests__/LiquidityReport.overrides-error-state.test.tsx`
- `src/components/budgets/__tests__/BudgetTile.test.tsx und BudgetFormDialog.test.tsx — wandern mit den Komponenten`
- `src/features/debts/domain/questions.ts — schreibt /liquidity?mode=simulation an 3 Stellen (Deep-Link muss auf dem Inhalt landen)`
- `src/features/money-questions/presentation/ZielAntwort.tsx — schreibt /liquidity?mode=simulation&betrag=&inTagen=`
- `src/features/money-questions/presentation/SzenarioAntwort.tsx — schreibt /liquidity?szenario=`
- `src/features/accounts/domain/questions.ts und src/features/dashboard/domain/questions.ts — verlinken /liquidity (nur pruefen, ob das Ziel weiter die genannte Menge zeigt)`
- `src/components/income/IncomeStressTestDialog.tsx, src/lib/life-situations.ts, src/components/layout/nav-config.ts, src/features/coach/presentation/shared/DisposableTankCard.tsx — verlinken /liquidity (nur pruefen)`
- `src/features/shared/presentation/ListRow.tsx, StatHero.tsx, InfoGroup.tsx, BudgetTank.tsx — werden BENUTZT, nicht geaendert; falls doch eine boxfreie Variante fehlt, trifft die Aenderung jede andere Flaeche`

### Offene Fragen
- WELCHES LIMIT ZAEHLT? BudgetStatus.remaining rechnet bei Rollover-Budgets gegen effectiveLimit (Basislimit + Übertrag), budget.rest und budget.tagesrate in features/budgets/domain/questions.ts gegen budget.limit. Beide heissen 'Rest'. Empfehlung: das EFFEKTIVE Limit, weil es der Nutzer im Tank und im Detail sieht — dann muss das Abfrage-Register mitgezogen werden. Ohne Entscheidung nennt der Chat eine andere Zahl als die Fläche (ADR Regel 1).
- NICHT-MONATLICHE BUDGETS. period 'weekly'/'yearly' haben keinen gemeinsamen Nenner mit 'diesen Monat noch frei'. Empfehlung: nur period === 'monthly' summieren und die übrigen als Zeile im Detailschritt führen (Text budgets.focused.nonMonthlyHint ist dafür vorgesehen). Bestätigung nötig, sonst ist die grosse Zahl still falsch.
- PUFFERBETRAG ALS VIERTE AUSSAGE? Die Puffer-Zeile nennt den Betrag, damit sie nachprüfbar ist. Zählt 'Puffer 1.000 EUR hält über 12 Monate' als EINE Aussage (so entworfen) oder als zwei? Nach ADR ist das nicht maschinell entscheidbar — gehört ins Selbst-Review mit Bildschirmfoto vom Gerät.
- ?mode=simulation: soll der fokussierte Detailschritt ihn übernehmen (Empfehlung ja) und was tut die kompakte Fassung damit? Heute schreiben ihn 6 Stellen, gelesen wird er nirgends. Wird er nur in einer Dichte gelesen, ist Regel 5 halb erfüllt.
- PARAMETER-NAMENSRAUM auf /liquidity: szenario, betrag, inTagen, mode sind belegt. Der Detailschritt bekommt lage=offen wie beim Coach — bestätigen, dass lage frei bleibt und nicht anderweitig geplant ist.
- SCROLLNACHWEIS: 'ein Bildschirm ohne Scrollen' ist in jsdom nicht prüfbar. Die Playwright-Suite braucht dafür einen Schritt (Scrollhöhe gegen Viewporthöhe) für /budgets und /liquidity — ist das Teil dieses Umbaus oder ein eigener Auftrag?
- DESKTOP-FASSUNG: Der Auftrag beschreibt die fokussierte. Die kompakte Fassung entsteht durch Verschieben der heutigen Dateien nach presentation/desktop/ — ohne inhaltliche Änderung, aber sie muss im selben Commit mitlaufen (ADR 'Was das für den Bestand heisst'). Bestätigen, dass das zum Auftrag gehört.

---

## Meilensteine, Einkommen, Anlaesse (3 Routen, 3 getrennte fokussierte Bildschirme)
**Routen:** `/milestones`, `/income`, `/occasions`
**Ist-Zustand:** Slice nein · 2 Kartenrahmen · 7 Abfragen in der Darstellung

### Befunde
- ZEILEN: MilestonesPage.tsx 100, IncomePage.tsx 18 (nur Huelle), SpecialCategoriesPage.tsx 150 = 268. Der eigentliche Inhalt von /income liegt in src/components/income/ (11 Dateien, 1085 Zeilen), Einstieg IncomeStreamsPanel.tsx 151 Zeilen.
- SLICE (hatSlice=false gilt fuer 2 von 3): NUR /occasions hat features/special-categories/{domain,data,application,presentation}; seine 3 Abfragen liegen korrekt in application/use-special-categories-overview.ts und zaehlen deshalb nicht gegen check:view-data. /milestones und /income haben KEINE Slice.
- FOKUSSIERTE FASSUNG (hatFokussiertePraesentation=false gilt im Sinne der ADR fuer alle 3): keine der drei Routen kennt useDisplayDensity. /occasions hat presentation/mobile/SpecialCategoriesMobileStory.tsx (50 Zeilen), aber nach dem ALTEN Muster — beide Fassungen werden gemountet und per 'hidden lg:block' / 'lg:hidden' weggeblendet (SpecialCategoriesPage.tsx Zeile 91 und 98). Das verletzt ADR Regel 6 (nur eine Fassung mounten und laden) und benutzt lg=1024 statt der einen Dichte-Schwelle 768.
- ABFRAGEN IN DER DARSTELLUNG, 7 Zaehleinheiten von check:view-data: MilestonesPage.tsx 1 useQuery ['milestones', locale] + 1 Service-Import evaluateMilestones = 2. IncomeStreamsPanel.tsx 2 useQuery (['transactions','all'], ['categories']) + 1 Service-Import transaction-service = 3. IncomeTaxReserveHint.tsx 1 useQuery ['userSettings'] + 1 Service-Import = 2. SpecialCategoriesPage.tsx 0. Dazu useAllocationMap (eigener Hook in src/hooks, zaehlt nicht).
- KARTENRAHMEN (check:card-rule max, Stand 149): 2 in meiner Flaeche — IncomeBreakdownCard.tsx:181 und IncomeOverTimeCard.tsx:47, beide <Card className="card-premium">. Tote Schachteln um ein Diagramm ohne Folgeaktion.
- BOXEN IN FOKUSSIERT (check:card-rule maxFokussiert, Stand 2, Ziel 0): EINE davon gehoert mir — SpecialCategoriesMobileStory.tsx:26 <div className="rounded-lg border border-dashed p-6"> (Leerzustand). Die zweite ist DashboardMobileStory.tsx:62 und gehoert einer anderen Flaeche.
- NICHT GEZAEHLTE, ABER ECHTE BOXEN: MilestonesPage.tsx:42 Verlaufsbox (rounded-xl bg-gradient-to-br p-5) und Zeile 76 eine getoente Box PRO Meilenstein (9 Stueck, rounded-lg p-3). Genau der Fall, den ADR Regel 10 in BEIDEN Dichten verbietet: 'ein wiederholter Eintrag bekommt keine Karte je Stueck'.
- DASSELBE BEI /occasions: SpecialCategoryTree.tsx:61 rendert eine InteractiveCard JE Anlass. InteractiveCard zaehlt in der Ratsche bewusst nicht mit, Regel 10 trifft sie trotzdem — zehn Anlaesse sind keine zehn Aktionen, sondern eine Liste mit neunfachem Rand.
- AUSSAGEN HEUTE, gezaehlt nach Regel 9: /milestones = 2 Kopfzahlen (3/9 und 33 %) + 9 Meilensteinzeilen mit Titel UND Beschreibung = 11+. /income = 3 KPI + Zeitraumschalter + Payout-Radar + Kreisdiagramm + Verlaufsdiagramm + Steuerhinweis + Upsell + 8 Strom-Karten + Stresstest = 15+. /occasions = Titel + Untertitel + je Anlass Name/Buchungszahl/Summe/Vorschlagszahl/Loeschen. Alle drei scrollen; alle drei sind kompakte Flaechen, keine fokussierten Bildschirme.
- ZWEI WEGE ZU EINER ZAHL — GEPRUEFT, HEUTE SAUBER: Der Meilenstein-Key ['milestones', locale] ist byte-identisch in MilestonesPage.tsx:14, features/coach/data/coach-query-keys.ts und features/finance-city/application/use-city-model.ts:95, ausdruecklich so kommentiert. Eine neue features/milestones/data/*-query-keys.ts MUSS dasselbe Literal fuehren.
- TUTORIAL-ANKER: data-tour-id="occasions-create" existiert in BEIDEN Fassungen (Desktop Zeile 25, Mobile Zeile 41); tutorial-steps.ts:246 haengt daran. /income (sources, stability) und /milestones (goals, progress) haben Schritte ohne Anker.
- TOTER DEEP-LINK: features/special-categories/domain/questions.ts verlinkt an 6 Stellen auf '/special-categories?event=<id>'. Diese Route steht nicht in App.tsx (dort nur /occasions), und '?event=' wird von keiner Praesentation gelesen. Das Registerversprechen laeuft heute ins Leere.

### Entwurf — die Aussagen

**1. /milestones — 'Als Naechstes: Notgroschen, 1.240 von 3.600 EUR'**

Ein Bildschirm, drei Aussagen, keine Box. A1 DER NAECHSTE MEILENSTEIN, groesste Zahl der Flaeche: Titel des ersten nicht erreichten Meilensteins (text-2xl), darunter seine Beschreibung in einer Zeile, darunter — falls quantifizierbar — '1.240 von 3.600 EUR' in tabular-nums plus ein 4px-Balken ohne Rahmen. A2 nach einer Haarlinie (border-t pt-5), kleiner gesetzt: '3 von 9 erreicht'. Die Prozentzahl 33 % faellt weg — dieselbe Feststellung ein zweites Mal. A3 wieder border-t: 'Zuletzt erreicht — Erste Schuld abbezahlt', eine Zeile. Feuert justAchieved, ERSETZT der SignatureMoment diese dritte Aussage, statt eine vierte zu werden. Weg sind: Verlaufsbox mit Gradient, Progress-Bauteil, die neun Icon-Kreise mit Verbindungslinie und die getoente Box je Meilenstein. Der Detail-Verweis 'Alle Meilensteine ->' zaehlt als Rahmen, nicht als Aussage.

*Datenquelle:* EINE Abfrage, unveraendert: evaluateMilestones() aus src/services/milestones-service.ts unter dem BESTEHENDEN Key ['milestones', locale] (MilestonesPage.tsx:14; identisch in coach-query-keys.ts und use-city-model.ts:95, geteilter Cache). A1 = milestones.find(m => !m.achieved) — exakt die nextGoalKey-Regel aus MilestonesPage.tsx:21; die Zahlen darin aus MilestoneStatus.progress {amount, target, unit}, src/lib/milestone-types.ts:26. A2 = milestones.filter(m => m.achieved).length / milestones.length — exakt MilestonesPage.tsx:18-19. A3 = [...milestones].reverse().find(m => m.achieved) — exakt die Regel aus MilestonesStrip.tsx:28. Keine neue Abfrage, keine neue Rechnung.

*Aktion:* Detailschritt ?stand=alle: Sheet mit dem vollstaendigen Fortschrittspfad (alle Meilensteine mit Symbol, Titel, Beschreibung, Erreicht-Kennzeichen) als divide-y-Liste OHNE Box je Eintrag, dazu der prozentuale Gesamtstand. Dort darf gescrollt werden.

**2. /income — '18.400 EUR in den letzten 12 Monaten'**

A1 DIE SUMME als groesste Zahl, darunter klein der Zeitraum 'letzte 12 Monate' — eine Summe ohne Zeitraum ist eine stille Behauptung (AGENTS.md Paragraf 3). Der Block fuehrt zu den Buchungen. A2 border-t pt-5, kleiner: EIN Satz zur Konzentration — 'Gehalt Musterfirma traegt 78 % — stark konzentriert'. Das ordnet A1 ein: eine hohe Summe aus einer Quelle ist etwas anderes als dieselbe Summe aus fuenf. A3 border-t: DIE STROMLISTE, entrahmt — Ueberschrift 'Einkommensstroeme', darunter ul.divide-y ohne Rahmen je Zeile: links Bezeichner plus eine Zeile Kadenz/Trend/zuletzt erhalten, rechts monthlyAverage in tabular-nums. Die Liste IST die dritte Aussage und die benannte Scroll-Ausnahme. NICHT auf diesem Bildschirm: Zeitraumschalter, Kreisdiagramm, Verlaufsdiagramm, Payout-Radar, Steuerruecklage-Hinweis, Stresstest, Teilen, Wrapped, Upsell. Der Bildschirm bleibt schalterfrei und trotzdem widerspruchsfrei, weil die Stroeme laut IncomeStreamsPanel.tsx:72-74 ohnehin immer auf 12 Monaten rechnen.

*Datenquelle:* deriveIncomeStreams(txs, cats, {windowMonths: 12}) aus src/lib/income-streams.ts, gespeist aus den BESTEHENDEN Abfragen getAllTransactions und getCategories — kuenftig unter financeKeys.transactionsAll und financeKeys.categories statt der Literale in IncomeStreamsPanel.tsx:47/56 (byte-identisch, derselbe Cache wie Dashboard und Buchungsseite). A1 = IncomeStreamsResult.totalIncome und .windowMonths — exakt der Wert hinter income.kpiTotal, IncomeKpiStrip.tsx:25. A2 = IncomeStreamsResult.largestShare und .diversification (dieselben Werte wie income.kpiLargestShare, IncomeKpiStrip.tsx:28-31) plus streams.streams[0].label (die Liste ist laut Typ absteigend nach totalInWindow sortiert). A3 = IncomeStream.monthlyAverage/.cadence/.trend/.lastDateISO — dieselben Felder, die IncomeStreamList.tsx:47-59 heute rendert. Alle Betraege durch useMoneyFormat().mask (check:money-format). Keine neue Abfrage.

*Aktion:* Detailschritt ?einnahmen=details: Sheet mit Zeitraumschalter 12m/Gesamt, Aufteilung (IncomeBreakdownCard OHNE <Card>), Verlauf (IncomeOverTimeCard OHNE <Card>), Payout-Radar, Steuerruecklage-Hinweis, Plattform-Stresstest, 'Als Bild teilen', Wrapped-Einstieg, PremiumUpsell. Nichts amputiert (ADR Regel 2/5).

**3. /occasions — 'Urlaub Italien — 2.340 EUR'**

A1 DER GROESSTE ANLASS: Name plus Gesamtsumme inkl. Unter-Anlaessen als groesste Zahl, gerendert mit dem bestehenden EventTotalAmount (macht bereits Cents-Umdeutung, Hochzaehlen und Sanften Modus). Antippen oeffnet seinen Detailschritt. A2 border-t pt-5: DIE ANLASSLISTE, entrahmt — statt einer InteractiveCard je Knoten eine ul.divide-y: links Symbol, Name und '12 Buchungen · 3 Vorschlaege', rechts die Summe. Nur die obersten Anlaesse; Unter-Anlaesse liegen im Detailschritt statt als eingerueckter Baum auf der Startflaeche. Die Liste ist die benannte Scroll-Ausnahme. Das Loeschen-Icon verschwindet aus jeder Zeile (heute SpecialCategoryTree.tsx:132-144) und liegt im Detailschritt — eine Ebene tiefer, nicht amputiert. A3 entfaellt bewusst: 'Neuer Anlass' ist eine Aktion, keine Aussage, und steht als EIN Knopf am Fuss — mit data-tour-id="occasions-create", sonst zeigt tutorial-steps.ts:246 in einer Dichte ins Leere. LEERZUSTAND OHNE BOX: Ueberschrift, ein Satz, derselbe Knopf; der gestrichelte Rahmen aus SpecialCategoriesMobileStory.tsx:26 faellt weg — das ist die eine maxFokussiert-Box, die mir gehoert.

*Datenquelle:* Unveraendert useSpecialCategoriesOverview() aus features/special-categories/application — 3 Abfragen, die Buchungen darunter unter dem geteilten financeKeys.transactionsAll. A1 = Maximum ueber model.tree[].total.subtreeMinor (Auswahl ueber ein BESTEHENDES Feld aus computeEventTotals, domain/event-totals.ts — keine neue Summe, keine neue Abfrage). A2 = model.tree mit total.subtreeMinor, total.transactionCount und der Laenge von model.suggestionsFor(id) — genau die Werte, die SpecialCategoryTree.tsx:74-82 heute zeigt. Betraege ueber EventTotalAmount wie bisher.

*Aktion:* Detailschritt ?anlass=<id> (adressierbar, gleiche Route, Zurueck-Taste): Sheet mit Unter-Anlaessen, zugeordneten Buchungen, den Zeitfenster-Vorschlaegen samt Ein-Klick-Zuordnung und dem Loeschen. Dieser Parameter ist zugleich das erste erreichbare Ziel fuer die sechs Register-Deep-Links, die heute auf die nicht existierende Route /special-categories?event= zeigen.

### Detailschritt
- /milestones ?stand=alle — Sheet: vollstaendiger Fortschrittspfad (alle Meilensteine mit Symbol, Titel, Beschreibung, Erreicht-Kennzeichen) als divide-y-Liste ohne Box je Eintrag; dazu der prozentuale Gesamtstand, der von der Hauptflaeche gefallen ist.
- /income ?einnahmen=details — Sheet: Zeitraumschalter 12m/Gesamt, Aufteilung nach Hauptkategorie (Kreis plus antippbare Liste), Verlauf ueber die Zeit, Payout-Radar, Steuerruecklage-Hinweis, Plattform-Stresstest, 'Als Bild teilen', Wrapped-Einstieg, PremiumUpsell fuer Nicht-Creator.
- /occasions ?anlass=<id> — Sheet je Anlass: Unter-Anlaesse mit ihren Summen, zugeordnete Buchungen, Zeitfenster-Vorschlaege mit Ein-Klick-Zuordnung, Loeschen.
- Alle drei sind Query-Parameter auf DERSELBEN Route (ADR Regel 5), gesetzt per setSearchParams(..., {replace:true}) und mit der Zurueck-Taste schliessbar — exakt die Bauform aus CoachFokussiert.tsx (DETAIL_PARAM = 'lage').
- In den Sheets DARF gescrollt werden (max-h-[90dvh] overflow-y-auto): Regel 9 richtet sich an die Flaeche, die man beim Oeffnen sieht, nicht an einen bewusst geoeffneten Detail.
- Der 'Neuer Anlass'-Dialog bleibt ein Dialog und wandert nicht in den Detailschritt — er ist Konfiguration nach Regel 3 und haengt am Tutorial-Anker.

### Begründung

WARUM DREI AUSSAGEN FUER DREI ROUTEN. Das Schema laesst drei Aussagen zu, meine Flaeche hat drei Routen — und Regel 5 verbietet, sie zusammenzulegen. Jede der drei Aussagen unten IST deshalb ein vollstaendiger fokussierter Bildschirm mit seinem EIGENEN Budget von hoechstens drei Aussagen; das Feld 'inhalt' schreibt aus, was auf ihm steht (A1/A2/A3), 'datenquelle' nennt je Zahl Datei und Feld. Wer die Arbeit aufteilt, kann jede der drei Zeilen einzeln vergeben.

WAS DIE HEUTIGEN FASSUNGEN FALSCH MACHEN. Bei allen dreien dasselbe Muster wie beim ersten Coach-Umbau: ein aufgeraeumter Desktop statt eines fokussierten Bildschirms. /milestones legt die Kopfzahl in eine Verlaufsbox und darunter neun getoente Boxen — die Zahl der Aussagen ist die Zahl der Meilensteine. /income stapelt drei KPI, zwei Diagrammkarten, Radar, Steuerhinweis, Upsell, acht Strom-Karten und den Stresstest untereinander. /occasions hat zwar schon eine mobile Datei, aber sie ist per lg-Breakpoint weggeblendet statt per Dichte gewaehlt, und sie gibt jedem Anlass eine eigene Karte.

DIE GEMEINSAME ENTWURFSREGEL. Aus jeder Flaeche wird die EINE Zahl herausgezogen, wegen der man sie oeffnet (naechster Meilenstein / Einnahmen im Fenster / teuerster Anlass), darunter kommt genau eine einordnende Zweitzahl, und die Liste ist die dritte und letzte Aussage — sie ist die benannte Scroll-Ausnahme. Getrennt wird ausschliesslich ueber Weissraum und border-t. Alles Uebrige wandert hinter einen Query-Parameter auf DERSELBEN Route, wie CoachFokussiert.tsx es mit ?lage=offen vormacht: adressierbar, mit der Zurueck-Taste schliessbar, nichts geloescht.

WAS ICH BEWUSST GESTRICHEN HABE, OBWOHL ES EINE ZAHL IST. Auf /milestones faellt die Prozentzahl weg: '3 von 9' und '33 %' sind dieselbe Feststellung zweimal und kosten eine der drei Aussagen. Auf /income faellt der Zeitraumschalter vom Startbildschirm, ohne dass etwas falsch wird — die Stroeme rechnen laut IncomeStreamsPanel.tsx:72-74 ohnehin immer auf 12 Monaten, der Schalter wirkt nur auf Aufteilung und Verlauf, und genau die wandern in den Detailschritt. Auf /occasions faellt der eingerueckte Unterbaum von der Startflaeche; er steht im Detailschritt des jeweiligen Anlasses.

KEINE ERFUNDENE ZAHL. Jede genannte Groesse existiert heute. Wo ein naheliegender Wert NICHT existiert — ein Monatsdurchschnitt ueber alle Einkommensstroeme — zeige ich stattdessen die vorhandene Summe MIT genanntem Zeitraum und habe die Alternative als offene Frage markiert, statt still eine neue Rechnung einzufuehren.

### Benötigte Texte (für S2)

| Schlüssel | de | en |
|---|---|---|
| `milestones.focusedProgressCount` | {achieved} von {total} erreicht | {achieved} of {total} reached |
| `milestones.focusedGoalProgress` | {amount} von {target} | {amount} of {target} |
| `milestones.focusedAllLink` | Alle Meilensteine | All milestones |
| `milestones.focusedDetailTitle` | Dein Fortschrittspfad | Your progress path |
| `income.focusedWindow` | letzte {months} Monate | last {months} months |
| `income.focusedConcentration` | {name} trägt {percent} — {verdict} | {name} contributes {percent} — {verdict} |
| `income.focusedDetailLink` | Aufteilung und Verlauf | Breakdown and trend |
| `income.focusedDetailTitle` | Einnahmen im Detail | Income in detail |
| `specialCategories.focusedLargest` | Teuerster Anlass | Most expensive occasion |
| `specialCategories.focusedListTitle` | Alle Anlässe | All occasions |
| `specialCategories.focusedSuggestionsCount` | {count} Vorschläge | {count} suggestions |
| `specialCategories.focusedDetailTitle` | Anlass im Detail | Occasion in detail |

### Gemeinsame Dateien (entscheiden über Parallelisierbarkeit)
- `card-rule-budget.json — PFLICHT, hoechstes Konfliktrisiko. max 149 -> 147 (die beiden <Card> in IncomeBreakdownCard.tsx:181 und IncomeOverTimeCard.tsx:47 fallen). maxFokussiert 2 -> 1 (der gestrichelte Leerzustand in SpecialCategoriesMobileStory.tsx:26 faellt; die verbleibende 1 ist DashboardMobileStory.tsx:62 und gehoert einer anderen Flaeche). Jede parallel laufende Flaeche schreibt dieselbe Datei.`
- `view-data-budget.json — PFLICHT, hohes Konfliktrisiko. max 204 muss um 7 sinken (2 aus MilestonesPage.tsx, 3 aus IncomeStreamsPanel.tsx, 2 aus IncomeTaxReserveHint.tsx), sobald die Abfragen nach features/milestones/application bzw. features/income/application ziehen. Die Ratsche darf nur sinken.`
- `slice-presentation-budget.json — PFLICHT, hohes Konfliktrisiko UND Falle. max steht auf 11. Sobald features/income/presentation existiert, zaehlen deren Importe nach src/components/ mit: PremiumUpsell und JEDE noch unter src/components/income/ liegende Datei wuerden die Zahl HEBEN. Deshalb muessen alle 11 Dateien aus src/components/income/ (inkl. wrapped/) IM SELBEN Commit in die Slice ziehen; fuer PremiumUpsell braucht es vorher eine Entscheidung. Dieselbe Lehre wie WP 6.2/6.3 und die Coach-Migration.`
- `src/i18n/translations/de.ts — neue Schluessel fuer alle drei fokussierten Fassungen. Nach jeder Aenderung sofort `pnpm exec tsc --noEmit` (doppelter Namespace faellt sonst spaet auf).`
- `src/i18n/translations/en.ts — Key-Symmetrie erzwungen durch src/i18n/__tests__/locale-parity.test.ts.`
- `src/i18n/translations/ru.ts — dito, paritaetspflichtig (SUPPORTED_LOCALES = de, en, ru).`
- `src/i18n/overlays/everyday/de.ts — fuer die Schluessel, deren Basistext Fachsprache ist (Diversifikation, Meilenstein, Anlass); overlay-coverage.test.ts prueft Existenz UND Mindestumfang je Sprache.`
- `src/i18n/overlays/everyday/en.ts — dito.`
- `src/i18n/overlays/everyday/ru.ts — dito.`
- `bundle-size-budget.json — ADR Regel 6 verlangt lazy JE DICHTE. Drei Flaechen mal zwei Fassungen ergeben neue Chunks; die gzip-Budgets sind nach einem `pnpm build` nachzuziehen. Konflikt mit jeder anderen migrierenden Flaeche.`
- `e2e-tests/fixtures/routes.ts — /milestones (Z. 24), /income (Z. 25) und /occasions (Z. 31) stehen dort bereits. Die Liste soll laut ADR kuenftig in BEIDEN Dichten laufen; der Nachweis 'ein Bildschirm ohne Scrollen' (Scrollhoehe gegen Viewporthoehe) gehoert genau dorthin, nicht in jsdom.`
- `src/lib/tutorial-steps.ts — Zeile 246 haengt am Anker occasions-create; er MUSS in der fokussierten Fassung erhalten bleiben (ADR Regel 5). Anzufassen nur, falls fuer /income (Z. 202-204) oder /milestones (Z. 227-229) Anker ergaenzt werden — die Datei ist trotzdem flaechenuebergreifend und zu pruefen.`
- `src/features/special-categories/domain/questions.ts — sechs Deep-Links auf '/special-categories?event=<id>', eine Route, die es nicht gibt. Der neue Detailschritt ?anlass=<id> ist das erste erreichbare Ziel. Aenderung beruehrt das Abfrage-Register und damit die money-questions-Flaeche.`
- `src/features/shared/domain/question-registry.ts sowie features/money-questions/data/__tests__/question-catalog.test.ts — die Invariante 'genannte Zahl und verlinkte Liste zeigen dieselbe Menge' prueft die Deep-Links; ein geaenderter Link faellt hier auf.`
- `src/App.tsx — nur falls eine Weiterleitung /special-categories -> /occasions fuer die Alt-Deep-Links ergaenzt wird. Die drei Routen selbst bleiben unveraendert (Regel 5).`
- `src/features/coach/data/coach-query-keys.ts — fuehrt milestones: ['milestones', locale]. Eine neue features/milestones/data/milestone-query-keys.ts MUSS dasselbe Literal fuehren; sauber ist, dass Coach den neuen Schluessel importiert statt eine zweite Definition zu halten. Beruehrt die Coach-Flaeche.`
- `src/features/finance-city/application/use-city-model.ts — Zeile 95, dritter Leser desselben Meilenstein-Keys (evaluateMilestones, geteilter Cache, ausdruecklich kommentiert). Wandert die Abfrage in eine Milestones-Slice, muss diese Stelle mit, sonst entstehen zwei Wege zu derselben Zahl (ADR Regel 1).`
- `src/features/shared/presentation/MilestonesStrip.tsx — wird vom Detailschritt der Coach-Fassung benutzt (CoachFokussiert.tsx, variant='compact') und rendert je Meilenstein eine getoente Box (Regel 10, beide Dichten). Wer sie entrahmt, aendert die Coach-Flaeche mit.`
- `src/features/shared/data/finance-query-keys.ts — die Income-Migration ersetzt die Literale ['transactions','all'] und ['categories'] aus IncomeStreamsPanel.tsx:47/56 durch financeKeys.transactionsAll/.categories. Byte-identisch, damit der geteilte Cache nicht zerfaellt.`
- `src/components/income/** (11 Dateien inkl. wrapped/) und src/components/income/__tests__/** — liegen ausserhalb meiner genannten Dateien, muessen aber vollstaendig nach features/income/ ziehen (siehe slice-presentation-budget.json).`
- `src/components/PremiumUpsell.tsx — von der Income-Flaeche importiert; sein Ort muss entschieden sein, bevor die Slice entsteht (Infrastruktur wie FeatureGate oder Umzug nach features/shared/presentation/).`
- `state-coverage-allowlist.json — /milestones hat einen 'entfaellt'-Eintrag fuer 'leer' (fester Katalog). Neue Tests [ZUSTAND /income:leer|fehler] und [ZUSTAND /occasions:leer|fehler] gehoeren je Dichte geschrieben; die Datei nur anfassen, falls der Umbau die Begruendung aendert.`
- `query-error-allowlist.json — der Umzug der Abfragen in application-Hooks veraendert, wo check:query-errors hinsieht; Zahl pruefen.`
- `touch-target-budget.json — max und maxVarianten stehen beide auf 0 und sind ab jetzt Waechter gegen den Rueckfall. Jede neue Listenzeile und jeder neue Knopf braucht fokussiert:min-h-11; die Datei darf NICHT gehoben werden.`
- `src/pages/__tests__/ (IncomePage.states, IncomePage.error-state, MilestonesPage.error-state, SpecialCategoriesPage.states/.error-state/.gating) und src/components/income/__tests__/IncomePage.test.tsx — pruefen heute die kompakte Fassung; nach ADR braucht jeder unterschiedlich dargestellte Zustand doppelte Abdeckung.`

### Offene Fragen
- TOTER DEEP-LINK, zu entscheiden BEVOR der /occasions-Detailschritt gebaut wird: features/special-categories/domain/questions.ts verlinkt sechsmal auf '/special-categories?event=<id>'. Diese Route steht nicht in App.tsx (nur /occasions), und '?event=' liest keine Praesentation. Vorschlag: Parameter '?anlass=<id>' auf /occasions plus Weiterleitung fuer den Altpfad, Register und Registertests im selben Commit. Gehoert der money-questions-Flaeche mit — nicht einseitig aendern.
- /income: EIN MONATSWERT UEBER ALLE STROEME EXISTIERT HEUTE NICHT. IncomeStream.monthlyAverage ist je Strom, IncomeStreamsResult.totalIncome ist die 12-Monats-SUMME. Mein Entwurf zeigt deshalb bewusst die Summe MIT genanntem Zeitraum. Soll 'was kommt monatlich rein' die Leitaussage sein, braucht deriveIncomeStreams eine neue abgeleitete Groesse — ausdruecklich als offen markiert, nicht heimlich eingebaut.
- /occasions Aussage 1: 'Teuerster Anlass' ist ein Math.max ueber ein BESTEHENDES Feld (tree[].total.subtreeMinor aus computeEventTotals) — keine neue Abfrage, aber eine neue Auswahl. Falls stattdessen eine Gesamtsumme aller Anlaesse gewuenscht ist, waere das eine neue Aggregation ueber die Wurzelknoten und braucht eine Entscheidung.
- PREMIUM-GATE /occasions: die Route haengt an RouteGuard path='/occasions' -> FeatureGate, damit Free/Anonym den Locked-Preview sehen (Defense-in-Depth, [SECURITY]). Ungeklaert: bekommt dieser Locked-Preview ebenfalls eine fokussierte Fassung, oder rendert das Gate vor der Dichte-Weiche? Betrifft SpecialCategoriesPage.gating.test.tsx.
- MilestonesStrip.tsx wird vom Coach-Detailschritt benutzt und rendert je Meilenstein eine getoente Box (Regel 10, beide Dichten). Entrahmen aendert die Coach-Flaeche mit. Wer macht es — diese Flaeche oder die Coach-Flaeche? Doppelt ist es ein Merge-Konflikt, gar nicht bleibt es ein offener Befund.
- PremiumUpsell (src/components/PremiumUpsell.tsx): Infrastruktur wie FeatureGate — dann darf features/income/presentation sie importieren, ohne slice-presentation zu heben — oder app-eigener Baustein und damit Umzug nach features/shared/presentation/? Die Antwort entscheidet, ob die Income-Migration die Ratsche hebt.
- 'Ein Bildschirm ohne Scrollen' ist laut ADR nur am Geraet bzw. in Playwright messbar, nicht in jsdom. Fuer die drei Flaechen fehlt die Playwright-Pruefung (Scrollhoehe gegen Viewporthoehe). Bauen wir sie in diesem Zug mit, oder bleibt der Beleg vorerst ein Bildschirmfoto vom Geraet?
- /milestones und /income haben Tutorial-Schritte ohne DOM-Anker (tutorial-steps.ts:202-204 und 227-229). Soll die fokussierte Fassung Anker nachziehen, oder bleibt das ausserhalb dieses Umbaus?

---

## Übersicht /dashboard (src/pages/DashboardPage.tsx, src/components/dashboard/Dashboard.tsx, src/features/dashboard/**)
**Routen:** `/dashboard`, `/dashboard?lage=offen (Detailschritt, gleiche Route — ADR Regel 5)`
**Ist-Zustand:** Slice ja · 7 Kartenrahmen · 3 Abfragen in der Darstellung

### Befunde
- DashboardPage.tsx hat 5 Zeilen und delegiert an src/components/dashboard/Dashboard.tsx (365 Zeilen) — der faktische Seiten-Wirt liegt in der Alt-Oberfläche. Slice vorhanden: features/dashboard/{domain,data,application,presentation}, ViewModel useFinanceOverview() (396 Zeilen) ist sauber und wird von beiden Fassungen geteilt.
- Die Dichte entscheidet auf dieser Fläche NICHT: Dashboard.tsx rendert BEIDE Fassungen (`<DashboardMobileStory className="lg:hidden">` Zeile 243, `<DashboardDesktopView className="hidden lg:block">` Zeile 246). useDisplayDensity() wird nicht benutzt, die wirksame Schwelle ist 1024 statt 768, und beide Bäume liegen im DOM und im Bündel — ADR Regel 4, 6 und 7 verletzt.
- DashboardMobileStory.tsx (199 Zeilen) ist exakt das Muster, das Regel 9 ablöst: 6er-Registerraster mit Icons (role=tablist), horizontale Wisch-Geste (resolveSwipeTarget), Punkt-Indikator, eine Diagramm-Karte je Ansicht, min-h-[60vh] plus alles darüber und darunter.
- Rund 15 Aussagen auf dem Telefon-Bildschirm gegen die Grenze 3: Coach-Hinweis-Satz, aktueller Kontostand (StatHero), Saldo-Feststellung als Caption, City-Vorschau ('{count} Viertel'), Einnahmen, Ausgaben, Zeitraum-Saldo, Buchungsanzahl ('12 von 44'), Analysemodus-Ergebnis, 2 KPI-Kacheln (Voreinstellung savings_rate + average_daily_expenses), aktive Diagramm-Ansicht, 5 Buchungszeilen, 2 Sprung-Links (Finanzgesundheit, Meilensteine).
- Konfiguration steht VOR der Aussage (Regel 3 verlangt Aussage → Detail → Konfiguration): Suchfeld und Filterknopf liegen in Dashboard.tsx Zeile 176-197, also oberhalb von TransactionStats, KPI und Diagrammen.
- DashboardMobileStory hält eine EIGENE useQuery in der Darstellung: `useQuery({ queryKey: ['financial-health', locale], queryFn: getFinancialHealth })` (Zeile 53) — dieselbe Frage, die useCoachOverview über coachKeys.financialHealth(locale) stellt. Cache wird geteilt, der Zugriff steht aber in der Präsentation statt im ViewModel. Dazu 2 useQuery in TransactionDetailsPanel, das Dashboard.tsx über TransactionDetailsModal mountet.
- 6 der 11 vom Wächter gezählten Feature-UI-Importe gehören dieser Fläche (nachgemessen mit scripts/slice-presentation-core.mjs): DashboardDesktopView und DashboardMobileStory importieren je AdvancedBalanceChart, accounts/AccountCards und premium-dashboard/SankeyChart. Ratsche steht auf 11 und darf nur sinken.
- 1 der 2 repo-weiten 'Boxen in fokussiert' (card-rule-budget.json maxFokussiert=2) steht hier: das <Card> in LandscapeView (DashboardMobileStory Zeile 62). Kartenrahmen im Dateisatz der Fläche: 7 (AdvancedBalanceChart 2, TransactionCharts 2, SankeyChart 1, AnalysisModePanel 1, DashboardMobileStory 1).
- Zwei Tutorial-Anker liegen auf /dashboard (src/lib/tutorial-steps.ts Zeile 179-183): `dashboard-flow` und `kpi-customize`. `dashboard-flow` existiert in der mobilen Fassung nur, wenn das Register 'fluss' gewählt ist — der Anker ist schon heute bedingt.
- Die e2e-Vertical-Slice-Fixture (e2e-tests/fixtures/vertical-slice.ts Zeile 101) wartet auf /dashboard auf data-testid='stat-hero-value' als Lade-Anker.

### Entwurf — die Aussagen

**1. Ausgegeben — mit dem Zeitraum darunter**

Grösste Zahl der Fläche: die Ausgaben im gewählten Zeitraum, darunter klein der Zeitraumname ('Letzte 30 Tage'). Der ganze Block ist ein Link auf die Buchungsliste mit denselben Filtern. Kein Kontostand hier — die Übersicht beantwortet 'wohin ist es geflossen', der Coach 'was habe ich'.

*Datenquelle:* model.stats.expenses aus src/features/dashboard/application/use-finance-overview.ts (stats-useMemo, Zeile 225-251) → computeFlowTotals() in src/features/dashboard/domain/overview-calculations.ts. Speist sich aus dashboardKeys.transactionsAll = financeKeys.transactionsAll (['transactions','all']). Zeitraumname aus model.filters.values.range + den bestehenden Schlüsseln transactionFilters.rangeAll/rangeYear/… (heute in der lokalen Funktion useRangeLabel in src/components/dashboard/TransactionFilters.tsx Zeile 38).

*Aktion:* Link auf model.filters.transactionsLink (ViewModel, Zeile 209-223) — dieselbe Menge, kein zweiter Filterweg.

**2. Saldo in diesem Zeitraum — hat es gereicht?**

Direkt darunter, bewusst kleiner: der Zeitraum-Saldo mit Vorzeichen und Farbe an der Schwelle 0 (text-positive / text-warning), darunter die bestehende Feststellung 'Du gibst weniger/mehr aus als du einnimmst'. Sie ordnet Aussage 1 ein: eine Ausgabensumme allein sagt nicht, ob sie gedeckt war.

*Datenquelle:* model.stats.balance, gleiche Quelle wie Aussage 1 (computeFlowTotals in use-finance-overview.ts). Texte bestehen bereits: dashboard.heroBalanceLabel, dashboard.heroBalancePositive, dashboard.heroBalanceNegative.

*Aktion:* keine eigene — die Zeile gehört zum Block darüber.

**3. Grösster Posten**

Name der grössten Ausgaben-Hauptkategorie im Zeitraum, ihr Betrag und ihr Anteil an den Ausgaben ('38 % deiner Ausgaben'). Das ist die eine Zeile, die ein Nutzer aus einem Kuchendiagramm ohnehin abliest. Gibt es keine Ausgaben, steht dort ein Satz ('In diesem Zeitraum keine Ausgaben'), keine 0.

*Datenquelle:* model.stats.sunburst.outer[0] und model.stats.sunburst.total aus demselben stats-useMemo (buildSpendingSunburst, src/lib/chart-data/sunburst.ts — `outer` ist bereits absteigend sortiert). Dieselbe Menge, aus der Dashboard.tsx heute schon cityDistrictCount = sunburst.outer.length zieht.

*Aktion:* Öffnet den Detailschritt (?lage=offen) — dort steht die vollständige Aufschlüsselung.

### Detailschritt
- Adressierbar über ?lage=offen unter DERSELBEN Route, als Bottom-Sheet wie in CoachFokussiert (max-h-[90dvh], overflow-y-auto). Hier DARF gescrollt werden — Regel 9 gilt für die Fläche beim Öffnen, nicht für den bewusst geöffneten Detail. Reihenfolge nach Regel 3: erst die restlichen Zahlen, dann die Aufschlüsselung, Konfiguration zuletzt.
- 1. Die übrigen Kennzahlen als Text ohne Box: aktueller Kontostand (model.stats.currentBalance), Einnahmen (model.stats.income), Buchungsanzahl (model.stats.count von model.transactions.all.length). Gleiche Quellen wie heute in TransactionStats/StatHero, nur ohne die Verlaufs-Box — die bleibt der kompakten Dichte.
- 2. Letzte Buchungen: model.transactions.preview über TransactionListMobile (macht es innen schon richtig: divide-y, kein Rahmen je Zeile) plus 'Alle {count} Buchungen anzeigen' auf model.filters.transactionsLink.
- 3. Die Diagramme untereinander statt als Register — kein Wischen, kein Punkt-Indikator: Verlauf (AdvancedBalanceChart), Kategorien (SpendingBreakdownCard), Ausgaben über Zeit (ExpensesOverTimeCard), Cashflow (SankeyChart, trägt data-tour-id='dashboard-flow'), Konten (AccountCards). Alle bekommen dasselbe `model`, keine eigenen Abfragen.
- 4. KPI-Abschnitt (KpiSection mit data-tour-id='kpi-customize') und Analysemodus (AnalysisModePanel) — unverändert, nur eine Ebene tiefer.
- 5. Sprünge, die heute als Pillen bzw. Karten oben stehen: /city (mit der bestehenden Vorschauzeile aus dashboard.cityLinkPreview), /coach (Finanzgesundheit und Finanzlandschaft), /milestones. Als Textlinks mit Pfeil, ohne Rahmen.
- 6. Zuletzt die Konfiguration (Regel 3): Zeitraum und Filter über TransactionFilters (stacked) samt 'Filter zurücksetzen'. Damit verschwindet die Filterzeile vom ersten Bildschirm, die dort heute vor der Aussage steht.
- Der Öffner selbst trägt data-tour-id='dashboard-detail' und ist ein echter <button> — damit kann src/lib/tutorial-steps.ts ihn als openAnchor benutzen und die beiden Dashboard-Anker bleiben in beiden Dichten erreichbar (ADR Regel 5).

### Begründung

Der erste Bildschirm beantwortet die eine Frage, für die es die Übersicht gibt — 'wohin ist mein Geld in diesem Zeitraum geflossen': Summe, Deckung, grösster Posten. Drei Aussagen, gegliedert über Weissraum und zwei Haarlinien (border-t), keine Karte, kein Hintergrund, kein Schatten. Der Kontostand steht bewusst NICHT oben: Er ist seit der Coach-Migration die erste Aussage auf /coach, und zwei grosse Kontostandszahlen, die verschieden gerechnet sind (hier alle Konten über computeTotalEffectiveBalance, im Coach nur Zahlungskonten), sind genau der Fall, vor dem ADR Regel 1 warnt — er ist deshalb einen Schritt tiefer, nicht weg. Amputiert ist nichts: Register, Wisch-Geste und Punkt-Indikator entfallen als Bauform, ihre sechs Inhalte stehen vollständig im Detailschritt unter derselben Route. Strukturell wird DashboardPage.tsx zur Dichte-Weiche nach dem Vorbild von CoachPage.tsx (useFinanceOverview einmal, Fehler vor Leerzustand, dann lazy DashboardFokussiert bzw. lazy kompakte Fassung) — das erfüllt Regel 6 und lässt nebenbei den Filterzustand einen Dichtewechsel überleben (Regel 8), weil er im ViewModel der Seite hängt und nicht in der abgebauten Präsentation.

### Benötigte Texte (für S2)

| Schlüssel | de | en |
|---|---|---|
| `dashboard.focusedSpentLabel` | Ausgegeben | Spent |
| `dashboard.focusedBiggestLabel` | Grösster Posten | Biggest item |
| `dashboard.focusedBiggestShare` | {share} % deiner Ausgaben | {share}% of your spending |
| `dashboard.focusedNoExpenses` | In diesem Zeitraum keine Ausgaben | No spending in this period |
| `dashboard.focusedTransactionsAction` | Buchungen dazu ansehen | See the transactions |
| `dashboard.focusedMore` | Alles ansehen | See everything |
| `dashboard.focusedDetailTitle` | Übersicht im Detail | Overview in detail |
| `dashboard.focusedPeriodSection` | Zeitraum und Filter | Period and filters |

### Gemeinsame Dateien (entscheiden über Parallelisierbarkeit)
- `src/i18n/translations/de.ts — neue Schlüssel im dashboard-Namensraum`
- `src/i18n/translations/en.ts — dieselben Schlüssel (locale-parity.test.ts prüft Blatt-Symmetrie)`
- `src/i18n/translations/ru.ts — dieselben Schlüssel`
- `src/i18n/overlays/everyday/de.ts — Alltagssprache für die neuen Schlüssel (overlay-coverage.test.ts)`
- `src/i18n/overlays/everyday/en.ts — dito`
- `src/i18n/overlays/everyday/ru.ts — dito`
- `card-rule-budget.json — maxFokussiert 2 → 1 (das <Card> in LandscapeView entfällt); max bleibt 149, solange die Diagramm-Dateien nur umziehen`
- `slice-presentation-budget.json — max 11 → 5. Die Ratsche darf nur sinken; die fokussierte Fassung ist ohne den Umzug der drei Diagramm-Komponenten NICHT baubar, sonst stiege sie`
- `bundle-size-budget.json — je Dichte ein eigener lazy-Chunk (ADR Regel 6); check:bundle-size hat für neue Bündel keinen Eintrag`
- `src/lib/tutorial-steps.ts — die drei dashboard-Schritte brauchen openAnchor='dashboard-detail', damit dashboard-flow und kpi-customize im Detailschritt erreichbar bleiben (ADR Regel 5)`
- `src/components/AdvancedBalanceChart.tsx — Umzug nach src/features/dashboard/presentation/shared/ (nur die beiden Dashboard-Präsentationen importieren sie)`
- `src/components/accounts/AccountCards.tsx — Umzug nach src/features/dashboard/presentation/shared/ (nur die beiden Dashboard-Präsentationen importieren sie, trotz des Verzeichnisnamens)`
- `src/components/premium-dashboard/SankeyChart.tsx — Umzug nach src/features/dashboard/presentation/shared/`
- `src/components/premium-dashboard/ResponsivePremiumDashboard.tsx — importiert SankeyChart relativ ('./SankeyChart'), Pfad nachziehen`
- `src/components/premium-dashboard/__tests__/SankeyChart.exports.test.tsx — relativer Import '../SankeyChart' nachziehen`
- `src/components/premium-dashboard/__tests__/SankeyChart.flow.test.tsx — dynamischer Import '../SankeyChart' nachziehen`
- `src/components/dashboard/TransactionFilters.tsx — die lokale, nicht exportierte Funktion useRangeLabel (Zeile 38-52) muss heraus, damit die fokussierte Fassung den Zeitraumnamen anzeigen kann, ohne aus src/components/ zu importieren (das hübe check:slice-presentation). ACHTUNG: Diese Datei wird auch von features/transactions/presentation/shared/TransactionsListPane.tsx benutzt`
- `src/features/shared/domain/dashboard-filters.ts (oder eine neue Datei unter src/features/shared/) — neuer Ort für die Zeitraum-Beschriftung als reine Funktion (t) => label`
- `e2e-tests/fixtures/vertical-slice.ts — der Lade-Anker data-testid='stat-hero-value' existiert auf /dashboard in der fokussierten Fassung nicht mehr`
- `e2e-tests/fixtures/routes.ts — die Routenliste muss laut ADR in BEIDEN Dichten laufen; heute tut sie das nicht`
- `e2e-tests/vertical-slice.spec.ts — ruft /dashboard direkt auf (Zeile 84)`
- `src/features/coach/data/coach-query-keys.ts — der Kopfkommentar nennt DashboardMobileStory als Mitnutzer von financialHealth; nach dem Umbau stimmt das nicht mehr`
- `src/components/dashboard/Dashboard.tsx und src/pages/DashboardPage.tsx liegen zwar in meiner Fläche, aber Dashboard.tsx ist der Wirt für TransactionDetailsModal, DeleteConfirmationDialog und den Filter-Dialog — wer die Buchungsliste /transactions parallel umbaut, fasst dieselben Kind-Komponenten an`

### Offene Fragen
- Der aktuelle Kontostand rutscht in den Detailschritt. Das berührt eine ausdrückliche Auftraggeber-Entscheidung (Befund A-1, docs/aaa-plus/critic-reports/wp-4.6-art-ux-motion.md, zitiert in Dashboard.tsx Zeile 135-143: 'Der AKTUELLE KONTOSTAND ist die Hauptaussage'). Begründung für den Vorschlag: /coach führt ihn seit der Coach-Migration als erste Aussage, und die beiden Zahlen sind verschieden gerechnet (hier alle Konten, im Coach nur Zahlungskonten). Bestätigung nötig — ohne sie bliebe der Kontostand Aussage 1 und der grösste Posten fiele in den Detailschritt.
- Die Finanzlandschaft (Register 'landschaft') ist auf /coach in beiden Dichten vollständig vorhanden. Der Vorschlag ersetzt sie auf /dashboard durch einen Verweis und lässt damit die eigene useQuery(['financial-health']) aus der Darstellung fallen. Ist das Entdopplung (Regel 1) oder Amputation (Regel 2/5)? Wenn Amputation, muss die Gesundheits-Abfrage in useFinanceOverview aufgenommen werden — das wäre eine ZUSÄTZLICHE Abfrage im Übersichts-ViewModel und ist hier ausdrücklich nicht vorgeschlagen.
- sunburst.outer ist nach dem Schlüssel `${ausgabenklasse}::${hauptkategorie}` gruppiert — dieselbe Hauptkategorie kann zweimal auftreten, wenn ihre Unterkategorien verschiedenen Ausgabenklassen zugeordnet sind. Für Aussage 3 ist zu entscheiden: grösster Posten (outer[0]) oder grösste Ausgabenklasse (inner[0], z. B. 'Nicht-Essenziell'). Beide Zahlen liegen heute vor, es wird keine neue Abfrage gebraucht.
- check:slice-presentation steht auf 11 und darf nur sinken. Die fokussierte Fassung ist ohne den Umzug von AdvancedBalanceChart, AccountCards und SankeyChart in die Slice nicht baubar, ohne die Ratsche zu heben — mit dem Umzug fällt sie auf 5. Zu bestätigen, dass dieser Umzug Teil desselben Arbeitspakets ist und nicht in ein eigenes wandert.
- Die Tutorial-Anker dashboard-flow und kpi-customize liegen künftig im Detailschritt. Vorschlag: openAnchor='dashboard-detail' in src/lib/tutorial-steps.ts. Das ändert den Ablauf des Kapitels 'dashboard' (drei Schritte) und berührt die Kapiteltexte — Bestätigung nötig.
- Wird useFinanceOverview() in DashboardPage.tsx hochgezogen (Empfehlung: ja, dann überlebt der Filterzustand einen Dichtewechsel nach Regel 8), wandert der Zustand des Detail-Modals (detailsOpen/detailsTransaction, heute Dashboard.tsx Zeile 46-47 und die onDetailsSaved-Option) mit in die Seite. Zu bestätigen, weil es den Zuschnitt von Dashboard.tsx ändert.
- Der Nachweis 'ein Bildschirm ohne Scrollen' ist laut ADR ein Playwright-Maß gegen die Viewport-Höhe; für /dashboard existiert er noch nicht, und die e2e-Routenliste läuft heute nicht in beiden Dichten. Wer misst das — dieses Arbeitspaket oder der Wächter-Ausbau?

---

## Einstellungen /settings — src/pages/SettingsPage.tsx, src/components/settings/**, src/features/settings/**
**Routen:** `/settings (unveraendert, ADR Regel 5)`, `/settings?bereich=kategorien`, `/settings?bereich=automatik`, `/settings?bereich=darstellung`, `/settings?bereich=bereiche`, `/settings?bereich=haushalt`, `/settings?bereich=sicherheit`, `/settings?bereich=backups`, `/settings?bereich=mcp`, `/settings?bereich=technik`, `/settings?bereich=gefahrenzone`
**Ist-Zustand:** Slice ja · 33 Kartenrahmen · 22 Abfragen in der Darstellung

### Befunde
- src/pages/SettingsPage.tsx hat 8 Zeilen und rendert genau <EnhancedSettings />. Kein Dichte-Zweig, kein lazy je Dichte — ADR Regel 6 ist auf dieser Flaeche nicht angefangen.
- Die Slice src/features/settings/ existiert seit WP 6.5b MIT domain/ (settings-overview.ts), data/ (settings-query-keys.ts) und application/ (use-settings-overview.ts, 232 Z.), aber OHNE presentation/. Der Slice-README nennt das einen bewussten Zwischenzustand und benennt die Blockade namentlich: slice-presentation-budget.json.
- EnhancedSettings.tsx (314 Z.) zeigt ELF Abschnitte gleichzeitig untereinander: Kategorien, Erscheinungsbild, Bereiche&Navigation, Sprache, Haushalt, Automatisierung, Sicherheit, Backups, MCP, Technischer Status (Accordion), Gefahrenzone. Jeder Abschnitt traegt einen SectionHeader, dessen Icon in einer 40x40-Box mit rounded-xl + border + bg-card sitzt — die Boxen beginnen also schon bei der Ueberschrift.
- Der Kopfbereich ist selbst eine Box: rounded-3xl border bg-card shadow-sm p-6, darin Badge, h1, Beschreibung und ein InfoStatStrip mit zwei Zahlen (Kategorien-Anzahl, Aufbewahrung).
- Kartenrahmen: 33 in den vier gemessenen Dateien (PrivacySyncAnalyticsSettings 14, LocalEncryptionSettings 8, CategoryPreview 7, CategoryManager 4). Nachgezaehlt kommen ueber alle 23 Dateien von src/components/settings/ 60 Vorkommen von <Card/<CardHeader/<CardContent/<CardTitle in 10 Dateien zusammen. CategoryPreview ist der Musterfall von ADR Regel 10: eine Karte, in der eine Karte steckt, in der eine Liste steckt, in der jede Zeile wieder eine Karte ist (rounded-xl border bg-card je Buchung).
- Datenzugriffe, die noch IN der Darstellung stehen: 22 (Slice-README, Abschnitt 'Offen') — HouseholdSettings 6, PrivacySyncAnalyticsSettings 4, AppearanceSettings 3, NavFeatureSettings 3, TaxReserveSettings 3, DangerZone/LocalEncryption/Telemetry je 1. Fuer den fokussierten Umbau muessen sie NICHT wandern: jede dieser Unterflaechen landet vollstaendig hinter genau einem Schritt.
- Die Flaeche scrollt heute ueber ein Vielfaches der Viewporthoehe. Sie ist keine Auswertungsflaeche — Einstellungen sind nach ADR Regel 3 die dritte Stufe (Konfiguration) und haben gar keine eigene Aussage; ihre natuerliche Form ist ein Verzeichnis, also die benannte Listen-Ausnahme aus Regel 9.
- Regel-1-Altbefund (nicht durch diesen Umbau erzeugt): Der Verschluesselungszustand wird ZWEIMAL unabhaengig gelesen — ueber useLocalEncryption() (LocalEncryptionSettings.tsx:138) und ueber getLocalFinanceStorageStatus() (PrivacySyncAnalyticsSettings.tsx). Zwei Wege zu derselben Feststellung.
- Tutorial-Anker auf /settings: 'backup-create' und 'backup-restore' (src/components/BackupManager.tsx:284/376), 'encryption-setup' (LocalEncryptionSettings.tsx:272). Alle drei liegen heute beim Oeffnen im DOM; hinter einem Detailschritt sind sie das nicht mehr.
- Zwei E2E-Specs fahren /settings an und erwarten Bedienelemente SOFORT: local-encryption.spec.ts (#enc-password, #enc-confirm) und backup-roundtrip.spec.ts (#enc-backup-pw, Knopf 'Lokale Daten loeschen', .ui-card 'Aktueller Datenbestand').
- Zustandsabdeckung: 'fehler' ist durch src/pages/__tests__/SettingsPage.error-state.test.tsx gedeckt (mockt bereits @/hooks/useLocalEncryption), 'leer' entfaellt begruendet in state-coverage-allowlist.json. Der Test laeuft heute nur in der kompakten Dichte, weil jsdom innerWidth 1024 meldet.
- bundle-size-budget.json fuehrt heute genau EIN Buendel 'SettingsPage' mit 32768 Byte gzip.

### Entwurf — die Aussagen

**1. Der Zustand deiner Daten auf diesem Geraet**

Kleines Versalien-Label in muted ('Deine Daten auf diesem Geraet'), darunter als groesste Schrift des Bildschirms der Verschluesselungszustand im Klartext: 'aktiv und entsperrt' / 'aktiv und gesperrt' / 'noch nicht eingerichtet'. Darunter eine Zeile in text-primary mit Pfeil in die Gruppe Sicherheit. Kein Rahmen, kein Hintergrund, kein Schatten — nur Typografie. Warum diese Feststellung fuehrt: Einstellungen haben nach Regel 3 keine eigene Auswertungs-Aussage; die einzige Feststellung auf dieser Flaeche, die eine Folge hat, wenn sie falsch steht, ist ob die lokalen Daten verschluesselt sind — zugleich das Kernversprechen der App (local-first).

*Datenquelle:* useLocalEncryption() aus src/hooks/useLocalEncryption.ts (React-Context, KEINE Abfrage) — dieselbe Quelle, aus der LocalEncryptionSettings.tsx:138 heute denselben Satz baut. Texte bestehen bereits in de/en/ru: privacy.localEncryption.statusActive / statusLocked / statusInactive. Der zweite, unabhaengige Lesepfad getLocalFinanceStorageStatus() aus PrivacySyncAnalyticsSettings wird ausdruecklich NICHT benutzt (ADR Regel 1).

*Aktion:* Der ganze Block ist der Sprung nach /settings?bereich=sicherheit, Tippziel min-h-11.

**2. Das Verzeichnis — zehn Zeilen, getrennt durch eine Haarlinie**

Ein Container mit divide-y divide-border/60, kein Rahmen aussen, keine Karte je Zeile (Regel 10: 'ein wiederholter Eintrag bekommt keine Karte je Stueck'). Je Zeile: Beschriftung, optional ein Untertitel in text-xs muted, rechts ein Chevron, Tippziel min-h-11. Ohne Icon-Kachel — die Kachel von ListRow (rounded-xl bg-muted) ist genau die Schachtelung, die Regel 9 auf dem Telefon vermeiden will. Die zehn Zeilen: (1) Kategorien, Untertitel '{count} Kategorien'; (2) Automatisierung, Untertitel 'Aufbewahrung {months} Monate'; (3) Aussehen & Sprache; (4) Bereiche & Navigation; (5) Haushalt; (6) Lokale Sicherheit & Sync-Datei; (7) Backups; (8) Sprach-/KI-Zugriff (MCP); (9) Technischer Status; (10) Daten & Konto loeschen — abgesetzt durch mt-6 und text-destructive, NICHT durch einen roten Rahmen. Die Liste ist selbst die eine Aussage (Regel 9, benannte Ausnahme); zehn Zeilen a rund 48 px plus Kopfzeile und Aussage 1 ergeben etwa 640 px und passen damit auch ohne die Ausnahme auf einen Telefonbildschirm.

*Datenquelle:* Die Beschriftungen kommen aus dem Sprachbaum und tragen keine Daten. Genau ZWEI Zeilen tragen eine Zahl, beide aus demselben ViewModel useSettingsOverview() (src/features/settings/application/use-settings-overview.ts): categoryCount (Query-Key SETTINGS_QUERY_KEYS.hierarchicalCategories -> getHierarchicalCategories) und retentionMonths (SETTINGS_QUERY_KEYS.userSettings -> getUserSettings, aufgeloest ueber resolveRetentionMonths). Das sind exakt die beiden Werte, die heute im InfoStatStrip des Kopfbereichs stehen — derselbe Weg, keine zweite Abfrage; der InfoStatStrip entfaellt dafuer in der fokussierten Fassung.

*Aktion:* Je Zeile setSearchParams({ bereich: <id> }) und damit ein Bottom-Sheet unter derselben Route.

### Detailschritt
- Mechanik: EIN <Sheet side="bottom"> mit max-h-[90dvh] overflow-y-auto — im bewusst geoeffneten Detail DARF gescrollt werden (Vorbild CoachFokussiert). Adressierbar ueber ?bereich=<id> unter DERSELBEN Route /settings (ADR Regel 5). Abweichung vom Coach-Vorbild mit Grund: setParams OHNE replace:true, damit die Android-Zuruecktaste das Sheet schliesst statt die Flaeche zu verlassen.
- ?bereich=kategorien -> CategoryManager, CategoryPreview (unveraendert, mit ihren heutigen Props aus dem ViewModel)
- ?bereich=automatik -> TimeRangeSettings, AutoCategorizationSettings, LearnedCategorizationSettings, QuestionLearningSettings, BulkAssignment, TaxReserveSettings samt businessMode/FeatureGate-Weiche und PremiumTeaser
- ?bereich=darstellung -> AppearanceSettings, LanguageSettings, WordingSettings
- ?bereich=bereiche -> NavFeatureSettings
- ?bereich=haushalt -> HouseholdSettings hinter FeatureGate familyMode, sonst PremiumTeaser. Die Zeile bleibt IMMER sichtbar, damit die Funktion nicht verschwindet
- ?bereich=sicherheit -> LocalEncryptionSettings, PrivacySyncAnalyticsSettings, TelemetrySettings, Link auf /privacy
- ?bereich=backups -> BackupManager (traegt die Anker backup-create und backup-restore)
- ?bereich=mcp -> CloudMcpSyncCard
- ?bereich=technik -> PerformanceDashboard, DiagnosticsSettings. Das heutige Accordion entfaellt — der Schritt IST die Einklappung
- ?bereich=gefahrenzone -> DangerZoneSettings
- Nichts amputiert: Jede der elf heutigen Sektionen von EnhancedSettings.tsx liegt in genau einer Gruppe. Der einzige Inhalt, der die Flaeche verlaesst, ist der InfoStatStrip des Kopfes — seine beiden Werte stehen als Zeilen-Untertitel weiter da, aus derselben Quelle.
- Der Fehlerzustand bleibt EIN frueher return auf FinanceErrorState (settings.hasLoadError) VOR der Dichte-Verzweigung — sonst behauptet die fokussierte Fassung '0 Kategorien' in einer Zeile, in der in Wahrheit ein Lesefehler steht.
- BAUFORM, damit keine Ratsche steigt (nachgemessen, das ist der Kern des Plans): Die neue Datei src/features/settings/presentation/mobile/EinstellungenFokussiert.tsx importiert NICHTS aus src/components/settings/. Sie bekommt die Gruppen props-getrieben (Kochrezept Schritt 8): gruppen: { id, titel, kennzahl?, inhalt: () => ReactNode }[]. Der Typ liegt in src/features/settings/presentation/settings-group.ts, das Register in src/components/settings/settings-gruppen.tsx (Richtung components -> features ist erlaubt), zusammengesteckt in SettingsPage.tsx hinter useDisplayDensity() plus lazy je Dichte (ADR Regel 6). Nur die geoeffnete Gruppe wird aufgerufen.
- Warum diese Bauform und keine andere: Der direkte Weg — die mobile Praesentation importiert die rund 15 Geschwister aus components/settings/ — haette slice-presentation-budget.json max von 11 auf ueber 25 getrieben. Ein Komplettumzug von components/settings/ in die Slice haette sie auf 17 getrieben; nachgemessen bleiben nach den Ausnahmen fuer ui/, providers/ und FeatureGate sechs echte Fremdimporte uebrig (TaxCategorySelect, ThemeToggle, FeatureSelection, PerformanceDashboard, PremiumTeaser, BackupManager). Beides ist verboten, weil die Zahl nur sinken darf.
- Keine Boxen in der neuen Datei: kein <Card>, kein rounded-* mit border oder shadow, kein bg-card. Gegliedert wird ueber gap-6, Typografie und border-t. Damit bleibt card-rule-budget.json maxFokussiert bei 2 (Ziel 0), statt zu steigen. Die Kartenrahmen INNERHALB der Detailgruppen bleiben zunaechst stehen — genau wie im Coach-Vorbild, dessen Sheet CoachStatusGrid, HealthScoreCard und CoachFeedCard mit ihren 15 Rahmen rendert.

### Begründung

Nur ZWEI Aussagen, nicht drei. Eine Einstellungsflaeche ist nach ADR Regel 3 reine Konfiguration und hat keine Auswertungs-Aussage; ihre Form ist ein Verzeichnis. Die Liste ist selbst die eine Aussage (Regel 9, benannte Ausnahme), und darueber steht genau eine Feststellung — der Verschluesselungszustand, weil er als einziger auf dieser Flaeche eine Folge hat, wenn er falsch steht. Die dritte Aussage bleibt bewusst frei: Kategorienzahl und Aufbewahrungsdauer sind keine eigenstaendigen Aussagen, sondern Merkmale der Zeile, in die sie fuehren — sie stehen deshalb als Untertitel IN der Liste und nicht als eigener Block ueber ihr. Das ist zugleich die Antwort auf den gemessenen Befund: Die 33 Kartenrahmen entstehen nicht, weil einzelne Bausteine falsch gebaut sind, sondern weil elf Gruppen GLEICHZEITIG auf einem Bildschirm liegen und jede eine Klammer brauchte, um sich von der naechsten abzugrenzen. Sobald nur noch eine Gruppe gleichzeitig sichtbar ist, hat keine mehr einen Nachbarn, gegen den sie sich abgrenzen muesste — die Karte wird nicht entfernt, sie wird ueberfluessig. Ein Rahmen um eine Gruppe verspraeche nach Prinzip 8 ausserdem eine Aktion, die eine Ansammlung von Schaltern nicht einloest.

### Benötigte Texte (für S2)

| Schlüssel | de | en |
|---|---|---|
| `settings.fokussiert.dataStateLabel` | Deine Daten auf diesem Gerät | Your data on this device |
| `settings.fokussiert.securityAction` | Verschlüsselung einrichten und verwalten | Set up and manage encryption |
| `settings.fokussiert.categoryCount` | {count} Kategorien | {count} categories |
| `settings.fokussiert.retentionMonths` | Aufbewahrung {months} Monate | Retention {months} months |
| `settings.fokussiert.groupDisplay` | Aussehen & Sprache | Appearance & language |

### Gemeinsame Dateien (entscheiden über Parallelisierbarkeit)
- `src/i18n/translations/de.ts — fuenf neue Schluessel unter settings.fokussiert.*. Die zehn Gruppentitel existieren bereits und werden wiederverwendet: settings.categoriesTitle, settings.automationTitle, onboarding.manage.title, settings.householdTitle, settings.securityTitle, settings.backupsTitle, settings.mcpTitle, settings.technicalStatusTitle, settings.dangerZoneTitle`
- `src/i18n/translations/en.ts — dieselben fuenf Schluessel (Key-Symmetrie erzwungen durch src/i18n/__tests__/locale-parity.test.ts)`
- `src/i18n/translations/ru.ts — dieselben fuenf Schluessel; ru steht in SUPPORTED_LOCALES und ist paritaetspflichtig (nachgeprueft: alle zehn Gruppentitel liegen dort bereits vor)`
- `src/i18n/translations/tlh.ts — optional, tlh steht in INACTIVE_LOCALES und ist NICHT paritaetspflichtig`
- `src/i18n/overlays/everyday/de.ts, en.ts, ru.ts — nur falls 'Lokale Sicherheit & Sync-Datei' oder 'Aussehen & Sprache' eine Alltagssprach-Fassung brauchen (overlay-coverage.test.ts prueft Existenz und Mindestumfang je Sprache, nicht je Schluessel)`
- `card-rule-budget.json — maxFokussiert (2) und max (149) nachmessen. Der Entwurf zielt auf UNVERAENDERT; jede Entkartung in den Detailgruppen muss max SENKEN, nie heben`
- `slice-presentation-budget.json — max (11) und maxBausteine (0) nachmessen. Der Entwurf ist so gebaut, dass beide unveraendert bleiben; das ist die Bedingung, unter der er ueberhaupt gebaut werden darf`
- `view-data-budget.json — max (204) nachmessen. Der Entwurf fuegt keine Abfrage hinzu (useLocalEncryption ist ein Hook, kein Service-Import); Ziel unveraendert`
- `touch-target-budget.json — beide Spalten stehen auf 0. Die neue Datei darf kein size="sm" und keine h-8/h-9-Klasse tragen; Zeilen und Kopfblock brauchen fokussiert:min-h-11`
- `bundle-size-budget.json — der Chunk 'SettingsPage' (32768 gzip) spaltet sich durch lazy je Dichte in zwei Buendel. Neue Chunknamen und -groessen muessen eingetragen werden, sonst ist check:bundle-size rot`
- `src/lib/tutorial-steps.ts — die drei /settings-Anker (backup-create, backup-restore, encryption-setup) liegen in der fokussierten Fassung hinter ?bereich=backups bzw. ?bereich=sicherheit und sind ohne Aenderung nicht mehr erreichbar (ADR Regel 5: jeder Anker in BEIDEN Dichten). Betrifft moeglicherweise die step()-Signatur, wenn das Ziel einen Query-Parameter tragen soll`
- `e2e-tests/local-encryption.spec.ts — erwartet #enc-password und #enc-confirm direkt nach dem Oeffnen von /settings; braucht in der fokussierten Dichte einen Schritt 'Gruppe Sicherheit oeffnen'`
- `e2e-tests/backup-roundtrip.spec.ts — erwartet #enc-backup-pw, den Knopf 'Lokale Daten loeschen' und die .ui-card 'Aktueller Datenbestand' direkt nach dem Oeffnen; betrifft zwei verschiedene Gruppen (backups und gefahrenzone)`
- `e2e-tests/fixtures/routes.ts — die Route /settings bleibt unveraendert, aber die ADR verlangt den Lauf der Liste in BEIDEN Dichten; die Detailschritte ?bereich=* sind neue Ziele fuer die Flaechenpruefungen`
- `playwright.config.ts — nur falls der Zwei-Dichten-Lauf hier verankert wird (heute bewusst keine benannten projects wegen der Visual-Baselines)`
- `src/pages/__tests__/SettingsPage.error-state.test.tsx — liegt ausserhalb von SettingsPage.tsx und muss den frueh returnenden Fehlerzustand in BEIDEN Dichten pruefen (jsdom meldet heute innerWidth 1024 und damit immer kompakt)`
- `state-coverage-allowlist.json — der /settings-Eintrag (leer: 'entfaellt') gilt weiter; nachpruefen, ob der Dichte-Zweig eine zweite Zustandszeile noetig macht`
- `src/features/shared/presentation/ListRow.tsx — nur lesend geprueft. WENN die Zeilen ueber ListRow gebaut werden, braucht es dort eine Fassung ohne Icon-Kachel (rounded-xl bg-muted); der Entwurf vermeidet das, indem er die Zeile lokal baut`
- `docs/architecture/darstellungsdichte.md — der Abschnitt 'Was das fuer den Bestand heisst' zaehlt die migrierten Flaechen; /settings ist nachzutragen`

### Offene Fragen
- Tutorial-Anker (ADR Regel 5): Wie erreicht step('backup', '/settings', 'backup-create') einen Anker, der erst existiert, wenn ?bereich=backups offen ist? Zwei Wege — der Schritt bekommt ein Ziel mit Query-Parameter (Signaturaenderung in src/lib/tutorial-steps.ts, geteilte Datei), oder der Tutorial-Lauf oeffnet die Gruppe vor dem Einrahmen. Muss VOR dem Bau entschieden sein, sonst zeigt die Fuehrung in einer Dichte ins Leere.
- E2E in beiden Dichten: local-encryption.spec.ts und backup-roundtrip.spec.ts laufen heute im Playwright-Standardviewport (1280 breit, also kompakt) und bleiben damit gruen. Wenn die ADR-Forderung 'Routenliste in beiden Dichten' eingeloest wird, brauchen beide je einen Schritt 'Gruppe oeffnen'. Wer besitzt diese Aenderung — diese Flaeche oder das E2E-Paket?
- Regel-1-Altbefund: Der Verschluesselungszustand hat heute zwei unabhaengige Lesepfade (useLocalEncryption() vs. getLocalFinanceStorageStatus() in PrivacySyncAnalyticsSettings). Der Entwurf benutzt den Context. Soll der zweite Pfad in diesem Paket aufgeloest werden oder in einem eigenen?
- Kartenrahmen in den Detailgruppen: Der Entwurf laesst die 33 Rahmen in CategoryManager/CategoryPreview/LocalEncryption/PrivacySync zunaechst stehen — genau wie das Coach-Vorbild, dessen Sheet 15 Rahmen aus presentation/shared rendert. card-rule-budget.json max (149) sinkt damit NICHT. Ist das akzeptiert, oder gehoert mindestens CategoryPreview (Karte in Karte in Liste aus Karten) in dasselbe Paket?
- Umzug von src/components/settings/ in die Slice: nachgemessen kostet er sechs echte Fremdimporte und treibt slice-presentation-budget.json max von 11 auf 17 — verboten. Aufloesbar waere er, indem BackupManager und PerformanceDashboard (nur von den Einstellungen benutzt) in die Slice und ThemeToggle, PremiumTeaser, FeatureSelection, TaxCategorySelect (je >= 2 Slices, nach AGENTS.md Paragraf 3 also ohnehin Kandidaten fuer features/shared/presentation) dorthin wandern. Das ist ein eigenes Paket mit sehr grosser Streuung (AppShell, MobileNav, dashboard, transactions, onboarding). Vorziehen oder wie im Slice-README beschrieben weiter aufschieben?
- Verlaufsverhalten des Detailschritts: Der Entwurf schiebt ?bereich= in den Verlauf (push), damit die Android-Zuruecktaste das Sheet schliesst — CoachFokussiert benutzt replace:true. Zwei Flaechen mit unterschiedlichem Zuruecktasten-Verhalten sind ein Bruch; wird Coach angeglichen oder der Entwurf?
- Bodennavigation und Seitenkopf: Die fokussierte Fassung traegt ihren Namen nach Coach-Vorbild im Inhalt statt in der App-Leiste. Nachzupruefen ist, ob PageHeader auf /settings anderswo erwartet wird (Command-Palette, Suche, Tutorial-Texte).

---

## Schulden /debts (src/pages/DebtsPage.tsx) und Nettovermoegen /net-worth (src/pages/NetWorthPage.tsx)
**Routen:** `/debts`, `/net-worth`
**Ist-Zustand:** Slice nein · 9 Kartenrahmen · 21 Abfragen in der Darstellung

### Befunde
- KORREKTUR DER AUFTRAGSANGABE: /debts hat sehr wohl eine Slice — src/features/debts/{domain,data,application} mit use-debts-overview.ts (351 Zeilen, 4 Abfragen, 5 Mutationen). Was fehlt, ist presentation/. /net-worth hat gar keine Slice: die Abfrage steht mit dem nackten Schluessel ['net-worth'] direkt in NetWorthPage.tsx:145. 'hatSlice: false' steht hier fuer 'keine der beiden Routen hat presentation/' — das ist die Ebene, an der Regel 6 haengt.
- Keine der beiden Routen benutzt useDisplayDensity oder lazy je Dichte (Regel 6/7). Verzweigt wird per CSS: DebtsPage.tsx:174 'lg:hidden' (DebtCard-Liste) gegen :181 'hidden lg:block' (Zeilenliste) und :276 'hidden lg:block' (Zahlungszuordnung). Beide Baeume werden gerendert.
- Kartenrahmen gemessen mit scripts/card-rule-core.mjs (zaehleKartenrahmen): DebtsPage.tsx 4, NetWorthPage.tsx 1, DebtCard.tsx 1, SchufaSelfCheckCard.tsx 1, ReceivablesPanel.tsx 2 = 9 auf der Flaeche. Repo-Stand 149/149, maxFokussiert 2/2 — beide Budgets stehen exakt auf der Grenze.
- Datenzugriffe in der Darstellung gemessen mit scripts/view-data-core.mjs (countDataAccess): DebtsPage 1, NetWorthPage 2, ReceivablesPanel 9, ClaimImportDialog 4, DebtSuggestionsBanner 2, DebtDetailSheet 1, SchufaSelfCheckCard 1, ReceivableFormDialog 1 = 21. Repo-Budget 204.
- /debts zeigt heute rund 12 gleichzeitige Aussagen: Seitenkopf, 2 Register, 2 Knoepfe, Vorschlags-Banner, 3 Kennzahlen (InfoStatStrip), n Schuldkarten, Ursachen-Karte, Tilgungsplan-Karte mit Strategie-Register + Extra-Budget-Feld + 2 Ranglisten, Beratungs-Karte, SCHUFA-Karte. Der gemeldete 500-px-Verbrauch der Kennzahlen-Karte ist damit nicht der eigentliche Befund, sondern sein Symptom.
- REGEL 10 VERLETZT: DebtCard.tsx ist 'eine Karte je wiederholtem Eintrag' (rounded-xl border bg-card p-4 shadow-sm), NetWorthPage NetWorthRow (:55) und SourceRow (:86) ebenso. Drei Stellen, an denen n Eintraege n Rahmen bekommen.
- DATENFEHLER, unabhaengig von der Dichte: NetWorthBreakdown fuehrt manualAssets (src/lib/net-worth-types.ts:89) und rechnet es in netWorth ein — NetWorthPage.tsx zeigt es weder als Zeile noch im AssetVolume, und netWorth.composition nennt die Formel ohne Sachwerte. Hauptzahl und Aufschluesselung widersprechen sich still.
- PARITAETSLUECKE: Die Zahlungszuordnung (DebtsPage.tsx:276) ist 'hidden lg:block'. tutorial-steps.ts:238 vermerkt das ausdruecklich als 'kein ueber beide Breiten stabiler Anker'. Der Wechsel auf die fokussierte Fassung ist der Zeitpunkt, das aufzuloesen statt es zu erben.
- ROUTEN-IDENTITAET: Der Reiter 'Forderungen' (ReceivablesPanel) haengt an Tabs defaultValue, nicht an der URL — heute nicht adressierbar. Regel 5 verlangt, dass jede Funktion unter derselben Adresse erreichbar bleibt; ein Detailschritt mit Suchparameter ist hier ein Gewinn, kein Kompromiss.
- Tutorial-Anker auf der Flaeche: 'debts-add' (DebtsPage.tsx:117) und 'debts-strategy' (:373). Beide muessen in beiden Dichten im DOM stehen (Regel 5). /net-worth hat zwei ankerlose Schritte, davon 'direction' — eine Richtung zeigt die Seite heute gar nicht.
- Keine deepLinkArt: 'quelle' zeigt auf diese Routen (alle 11 Eintraege in src/features/debts/domain/questions.ts sind 'kontext') — das entschaerft die zweite Folge von Regel 5.

### Entwurf — die Aussagen

**1. Die eine Zahl, gross und zuerst**

/debts: Label 'Gesamtschuld' (text-xs uppercase muted), darunter der Betrag in text-5xl font-semibold tabular-nums. Nichts daneben. — /net-worth: Label 'Nettovermoegen', darunter derselbe Satz in text-5xl, Farbton positive/warning nach Vorzeichen. Kein Verlauf, kein rounded-xl, kein StatHero: Regel 9 verbietet auch den weichen Hintergrund um Inhalt.

*Datenquelle:* /debts: useDebtsOverview().totalDebt aus src/features/debts/application/use-debts-overview.ts:186 (= totalOutstandingDebt(debts), src/lib/debt-totals.ts), Abfrage debtsKeys.debts. Genau die Zahl, die heute als InfoStatStrip-Kachel debts.debtsPage.totalDebtStat steht — dieselbe Quelle, kein zweiter Weg. /net-worth: getNetWorthBreakdown().netWorth (src/services/net-worth-service.ts), Query-Key ['net-worth'] = accountKeys.netWorth (src/features/accounts/data/account-query-keys.ts:29); denselben Key benutzen bereits use-net-worth-snapshot.ts:22 und use-money-questions.ts:304, es entsteht also keine zweite Abfrage.

*Aktion:* Kein Link — die Zahl IST die Antwort, auf beiden Flaechen.

**2. Was die Zahl einordnet — durch eine Haarlinie (border-t) getrennt**

/debts: 'Schuldenfrei in {months} Monaten' in text-3xl, darunter eine Zeile text-sm muted '{rate} pro Monat'. Bei payoffPlan.insufficientBudget statt der Zahl der bestehende Satz debts.debtsPage.insufficientBudget in Warnfarbe — eine nicht aufgehende Rechnung darf keine Monatszahl behaupten. Daneben der Detail-Verweis 'Plan ansehen' (Rahmen, zaehlt nicht mit). — /net-worth: der Fremdwaehrungs-Vorbehalt ueber den bestehenden UnconvertedCurrencyNotice, entrahmt. Ist unconvertedInvestments leer, faellt die Aussage ersatzlos weg — zwei Aussagen sind erlaubt, drei sind die Obergrenze.

*Datenquelle:* /debts: useDebtsOverview().payoffPlan.totalMonths und .insufficientBudget (calculatePayoffPlan, src/services/debt-service.ts), Rate = totalMin + extraPayment (totalMinimumPayment, src/lib/debt-totals.ts, plus parseExtraBudget aus features/debts/domain/debt-overview.ts). Alles liegt bereits im ViewModel. /net-worth: data.unconvertedInvestments aus derselben getNetWorthBreakdown-Antwort (src/lib/net-worth-types.ts:106).

*Aktion:* /debts: Verweis auf ?lage=plan. /net-worth: keiner.

**3. Die Liste — die benannte Ausnahme zu 'ein Bildschirm', und selbst nur EINE Aussage**

/debts: Ueberschrift 'Deine Schulden', daneben der Verweis 'Schuld erfassen' (traegt data-tour-id='debts-add'). Darunter divide-y ohne jeden Rahmen: je Zeile Icon, Name (truncate), rechts der Restbetrag tabular-nums; zweite Zeile klein und muted mit Art und Rate. Ganze Zeile ist Trefferflaeche, fokussiert:min-h-11, oeffnet das bestehende DebtDetailSheet. Kein rounded, kein bg-card, kein shadow, kein Fortschrittsbalken je Zeile (der gehoert ins Sheet). — /net-worth: Ueberschrift 'Woraus es besteht', darunter FUENF entrahmte divide-y-Zeilen: Liquiditaet, Investitionen, Sachwerte, Forderungen, Schulden (letzte negativ, text-warning). Jede Zeile oeffnet ihr bestehendes Quellen-Sheet.

*Datenquelle:* /debts: useDebtsOverview().debts (Abfrage debtsKeys.debts, dieselbe wie Aussage 1 — kein zweiter Weg), je Zeile d.name, d.balance, DEBT_TYPE_ICONS[d.type] und debtTypeLabels aus dem ViewModel. /net-worth: data.cash, data.investments, data.manualAssets, data.receivables, data.debts aus DERSELBEN getNetWorthBreakdown-Antwort; die Sheets speisen sich aus data.accountSources, portfolioSources, manualAssetSources, receivableSources, debtSources. manualAssets ist heute vorhanden und ungezeigt — es aufzunehmen ist keine neue Abfrage, sondern die Behebung des Widerspruchs zwischen Hauptzahl und Aufschluesselung.

*Aktion:* /debts: Zeile oeffnet DebtDetailSheet (openDetail aus dem ViewModel). /net-worth: Zeile oeffnet das jeweilige Quellen-Sheet.

### Detailschritt
- /debts?lage=plan — Sheet von unten, max-h-[90dvh] overflow-y-auto wie CoachFokussiert. Inhalt in dieser Reihenfolge: Strategie-Umschalter (traegt data-tour-id='debts-strategy'), Extra-Budget als DecimalInput, Zinsen gesamt, Prioritaetsreihenfolge, voraussichtliche Tilgung, 'Woher kommen deine Schulden?' (causes), Zahlungszuordnung (heute hidden lg:block, also auf dem Telefon gar nicht vorhanden — hier wird die Paritaetsluecke geschlossen), CounselingBridgeCard, SchufaSelfCheckCard, DebtSuggestionsBanner, 'Briefe scannen' (ClaimImportDialog). Konfiguration liegt damit hinter einem eigenen Schritt, nie neben der Aussage (Regel 3).
- /debts?lage=forderungen — Sheet mit ReceivablesPanel. Ersetzt den heutigen Tabs-Reiter, der an keiner URL haengt; die Funktion wird damit erstmals adressierbar (Regel 5).
- /net-worth?lage=aufteilung — Sheet mit AssetVolume (Groessenordnung der Aktiva als flaechenproportionale Kreise), der korrigierten Zusammensetzungsformel und der kontextuellen Hauptaktion (Konto/Depot anlegen). AssetVolume und die Zeilenliste sagen dasselbe; beide gleichzeitig auf dem ersten Bildschirm waeren zwei Wege zu derselben Aussage.
- Mechanik in beiden Faellen: useSearchParams mit setParams(next, { replace: true }) wie CoachFokussiert — Route bleibt /debts bzw. /net-worth, Zurueck-Taste schliesst, Deep-Link oeffnet direkt. Im Sheet DARF gescrollt werden.
- Nicht als Aussage gezaehlt: App-Leiste, Bodennavigation, 'Schuld erfassen', 'Plan ansehen', 'Forderungen', 'Groessenordnung'. Der SignatureMoment bei Schuldenfreiheit bleibt und ist ein Moment, keine Kennzahl.

### Begründung

Beide Flaechen folgen demselben Dreiklang Zahl -> Einordnung -> Liste, weil beide dieselbe Frageform beantworten ('wie viel, und woraus'). Die kompakte Fassung bleibt unveraendert bestehen und wird per useDisplayDensity + lazy je Dichte gewaehlt (Regel 6/7); die fokussierte kommt als src/features/debts/presentation/mobile/SchuldenFokussiert.tsx und src/features/net-worth/presentation/mobile/VermoegenFokussiert.tsx daneben. Amputiert wird nichts: alles Heutige liegt hinter drei benannten Suchparametern unter derselben Route, plus die Zahlungszuordnung, die auf dem Telefon heute FEHLT und dort erstmals ankommt. Die Kennzahl 'Offene Schulden' (debts.filter(!is_paid_off).length) entfaellt als eigene Zahl — die Liste darunter zeigt sie, und eine Zahl zweimal zu setzen ist genau das, was Regel 1 verbietet. Der Ersatz von StatHero durch reine Typografie ist nicht Geschmack: StatHero traegt 'rounded-xl bg-gradient-to-br ... p-5', also Hintergrund um Inhalt, und Regel 9 nennt genau das.

### Benötigte Texte (für S2)

| Schlüssel | de | en |
|---|---|---|
| `debts.fokussiert.debtFreeInMonths` | Schuldenfrei in {months} Monaten | Debt-free in {months} months |
| `debts.fokussiert.monthlyRate` | {amount} pro Monat | {amount} per month |
| `debts.fokussiert.planLink` | Plan ansehen | View plan |
| `debts.fokussiert.listTitle` | Deine Schulden | Your debts |
| `debts.fokussiert.addLink` | Schuld erfassen | Add debt |
| `debts.fokussiert.planDetailTitle` | Schuldenabbau im Detail | Debt payoff in detail |
| `netWorth.fokussiert.compositionTitle` | Woraus es besteht | What it consists of |
| `netWorth.fokussiert.scaleLink` | Groessenordnung | Scale |
| `netWorth.manualAssets` | Sachwerte | Tangible assets |
| `netWorth.manualAssetsDesc` | Manuell gepflegte Werte wie Auto oder Immobilie — jeweils mit dem Datum der letzten Schaetzung. | Manually maintained values such as a car or property — each with the date of the last estimate. |
| `netWorth.noManualAssets` | Keine Sachwerte hinterlegt. | No tangible assets recorded. |
| `netWorth.composition` | Liquiditaet + Investitionen + Sachwerte + Forderungen − Schulden | Liquidity + investments + tangible assets + receivables − debts |

### Gemeinsame Dateien (entscheiden über Parallelisierbarkeit)
- `src/i18n/translations/de.ts — neue Schluessel unter debts.fokussiert und netWorth (u. a. netWorth.manualAssets); ausserdem Korrektur von netWorth.composition, das die Sachwerte heute verschweigt`
- `src/i18n/translations/en.ts — Pflicht, locale-parity.test.ts vergleicht alle Blaetter gegen de`
- `src/i18n/translations/ru.ts — Pflicht, SUPPORTED_LOCALES = ['de','en','ru'] (src/i18n/locale.ts:20)`
- `src/i18n/translations/tlh.ts — INACTIVE_LOCALES, faellt aus der Paritaetspruefung; nur der Vollstaendigkeit halber genannt`
- `src/i18n/overlays/everyday/de.ts — traegt heute eigene Fassungen von debts.debtsPage und netWorth (Alltagssprache); ohne Nachzug driftet die Alltagssprache still auf den Fachtext zurueck`
- `src/i18n/overlays/everyday/en.ts`
- `src/i18n/overlays/everyday/ru.ts`
- `card-rule-budget.json — max steht auf 149/149, maxFokussiert auf 2/2. Der Umbau muss max senken (mindestens 5 Rahmen fallen auf der Flaeche) und darf maxFokussiert nicht heben: die neuen presentation/mobile/-Dateien duerfen KEINE Box enthalten`
- `view-data-budget.json — max 204. Die 2 Zugriffe aus NetWorthPage und 1 aus DebtsPage wandern in features/*/application; die Zahl muss sinken`
- `slice-presentation-budget.json — DAS GROESSTE RISIKO. max 11, maxBausteine 0. Jede neue Datei unter features/*/presentation/, die aus src/components/debts/ oder src/components/networth/ importiert, HEBT max. Betroffen sind zehn Dateien (DebtDetailSheet, DebtFormDialog, DebtCard, ClaimImportDialog, ReceivablesPanel, CounselingBridgeCard, SchufaSelfCheckCard, DebtSuggestionsBanner, ReceivableFormDialog, AssetVolume). Sie muessen im selben Zug in die Slices ziehen, sonst verurteilt die Ratsche die Migration, fuer die sie gebaut wurde (Lehre aus WP 6.2/6.3 im Budget-Kommentar)`
- `bundle-size-budget.json — zwei neue lazy-Chunks je Route (kompakt/fokussiert); check:bundle-size setzt einen pnpm build voraus`
- `touch-target-budget.json — max und maxVarianten stehen beide auf 0. Die neuen Listenzeilen und Detail-Verweise brauchen fokussiert:min-h-11 (bei quadratischen Zielen zusaetzlich min-w-11)`
- `src/lib/tutorial-steps.ts — 'debts-strategy' (heute DebtsPage.tsx:373) liegt nach dem Umbau im Sheet ?lage=plan und existiert in der fokussierten Fassung nicht im DOM. Entweder route auf '/debts?lage=plan' oder openAnchor auf 'Plan ansehen'. 'debts-add' muss in beiden Dichten bleiben. Der ankerlose Schritt netWorth.direction zeigt weiterhin ins Leere`
- `src/lib/__tests__/tutorial-steps.test.ts — prueft Anker-Existenz und Kapitelstruktur`
- `src/components/debts/DebtCard.tsx — traegt die verbotene Karte je Eintrag; wird fuer fokussiert durch entrahmte Zeilen ersetzt, bleibt fuer kompakt und zieht in features/debts/presentation/`
- `src/components/debts/DebtDetailSheet.tsx — Ziel beider Dichten, zieht nach features/debts/presentation/shared/`
- `src/components/debts/ReceivablesPanel.tsx — 9 gezaehlte Datenzugriffe, der dickste Brocken der Flaeche; sein Umzug beruehrt view-data- und slice-presentation-Budget zugleich`
- `src/components/debts/DebtSuggestionsBanner.tsx`
- `src/components/debts/ClaimImportDialog.tsx`
- `src/components/debts/CounselingBridgeCard.tsx`
- `src/components/debts/SchufaSelfCheckCard.tsx`
- `src/components/debts/DebtFormDialog.tsx`
- `src/components/debts/ReceivableFormDialog.tsx`
- `src/components/networth/AssetVolume.tsx (samt src/components/networth/__tests__/)`
- `src/features/shared/presentation/InfoGroup.tsx — InfoStatStrip traegt die kompakte Kennzahlen-Zeile von /debts. WIRD GERADE VON JEMAND ANDEREM GEAENDERT (die kompakt:/sm:-Reihenfolge der Varianten hat sich waehrend dieser Analyse veraendert)`
- `src/features/shared/presentation/StatHero.tsx — von NetWorthPage und weiteren Flaechen benutzt; traegt 'rounded-xl bg-gradient-to-br p-5', also eine Box nach Regel 9. Entweder eine fokussiert:-Variante ohne Hintergrund oder StatHero faellt auf /net-worth ersatzlos weg (mein Entwurf tut Letzteres) — die Entscheidung betrifft alle anderen Nutzer der Komponente`
- `src/features/accounts/data/account-query-keys.ts — accountKeys.netWorth = ['net-worth'] ist der Schluessel, den ein neuer features/net-worth/application-Hook benutzen MUSS (Cross-Slice-Import) — alternativ zieht der Schluessel nach features/shared/data/finance-query-keys.ts`
- `src/features/shared/data/finance-query-keys.ts — moeglicher neuer Heimatort des net-worth-Schluessels`
- `src/features/debts/data/debts-query-keys.ts — DEBT_DEPENDENT_KEYS enthaelt ['net-worth'] und verbindet damit beide Routen der Flaeche`
- `src/features/debts/application/use-debts-overview.ts — muss die heute in der Seite gerechnete Zahl offener Schulden (DebtsPage.tsx:169) uebernehmen und ein dichteunabhaengiges Modell fuer beide Praesentationen liefern`
- `src/features/debts/application/__tests__/use-debts-overview.test.tsx — traegt [ZUSTAND /debts:leer] und [ZUSTAND /debts:fehler]`
- `src/pages/__tests__/screens.empty-state.test.tsx — [ZUSTAND /debts:leer] und [ZUSTAND /net-worth:leer]; rendert beide Seiten und wird dichteabhaengig`
- `src/pages/__tests__/screens.error-state.test.tsx — [ZUSTAND /debts:fehler] und [ZUSTAND /net-worth:fehler], je zweisprachig`
- `src/pages/__tests__/NetWorthPage.gentle-mode.test.tsx — prueft den Sanften Modus auf allen Betraegen der Seite`
- `src/pages/__tests__/NetWorthPage.unconverted.test.tsx — [ZUSTAND /net-worth:geladen], haengt genau an meiner Aussage 2`
- `src/__tests__/layout-overlap.sweep.test.tsx — rendert beide Seiten`
- `src/App.tsx (Zeilen 191-192) — Routenpfade bleiben unveraendert; zu pruefen ist nur, ob die Seiteneinstiege dieselben Default-Exporte behalten`
- `e2e-tests/fixtures/routes.ts — /debts und /net-worth stehen bereits drin; der ADR verlangt fuer Regel 9 einen Playwright-Nachweis 'Scrollhoehe gegen Viewport-Hoehe' fuer Auswertungsflaechen, und diese Liste ist sein Ort`
- `state-coverage-allowlist.json — heute kein Eintrag fuer beide Routen; die vorhandenen [ZUSTAND]-Marken muessen den Umbau ueberleben, sonst wird check:state-coverage rot`
- `src/components/layout/nav-config.ts — nur Nachweis: die Pfade /debts und /net-worth bleiben, KEINE Aenderung noetig`

### Offene Fragen
- AUSSAGE 2 AUF /net-worth IST DUENN. Der Fremdwaehrungs-Vorbehalt erscheint nur bei Fremdwaehrungsbestaenden; im Normalfall traegt die Seite dann zwei Aussagen. Die fachlich richtige zweite Aussage waere die RICHTUNG (Delta zum Vormonat) — genau das, was Tutorial-Schritt netWorth.direction seit jeher ankuendigt und die Seite nie zeigt. Die Quelle EXISTIERT: getNetWorthHistory() (src/services/net-worth-history-service.ts:14), abgefragt unter ['net-worth-history'] in use-money-questions.ts:307, ausgewertet von entwicklung() in src/features/accounts/domain/questions.ts:458. Das waere aber eine ZUSAETZLICHE Abfrage auf dieser Flaeche und ein Cross-Slice-Import — deshalb ausdruecklich als offene Frage markiert und NICHT in den Entwurf genommen.
- manualAssets aufzunehmen ist keine Designfrage, sondern eine Korrektur: Das Feld steckt bereits in netWorth. Eigene Zeile 'Sachwerte' (mein Vorschlag) oder in 'Liquiditaet' aufgehen lassen? Letzteres waere falsch — eine Immobilienschaetzung ist kein Kontostand, und AGENTS.md verlangt den Stichtag der Schaetzung sichtbar (manualAssetSources traegt ihn). Die Entscheidung beruehrt netWorth.composition und AssetVolume und gilt fuer BEIDE Dichten.
- Der Tutorial-Anker 'debts-strategy' wandert hinter ?lage=plan. Zwei Wege: TutorialStep.route auf '/debts?lage=plan' (unklar, ob der Lauf einen Suchparameter mitnavigiert — step() typisiert route nur als string) oder openAnchor auf 'Plan ansehen'. Der zweite Weg braucht einen Anker, den es in der KOMPAKTEN Fassung nicht gibt, weil der Plan dort inline steht. Vor der Umsetzung zu entscheiden.
- Der Umzug von zehn Dateien aus src/components/debts/ und src/components/networth/ in die Slices ist die eigentliche Arbeit — ohne ihn steigt slice-presentation-budget.json max von 11 aus. Im selben Commit (dann gross, gegen AGENTS.md Paragraf 11) oder als vorgezogener, rein mechanischer Umzugs-Commit? Empfehlung: vorgezogen. Das entscheidet auch, ob diese Flaeche parallel zu anderen laufen kann.
- ReceivablesPanel traegt 9 Datenzugriffe und ist eine eigene Flaeche im Kleinen. In diesem Auftrag mit zerlegen (features/receivables/application) oder als Ganzes in ?lage=forderungen haengen und spaeter zerlegen? Der Entwurf geht vom Zweiten aus.
- Regel 6 verlangt lazy je Dichte. Fuer /net-worth heisst das eine neue Slice src/features/net-worth/ (domain/data/application/presentation) samt use-net-worth-overview.ts. Soll die Slice 'net-worth' heissen (wie die Route) oder 'vermoegen'? Bezeichnungen in Dateipfaden sind nach 'Absicht vor Auftrag' pruefpflichtig; der Bestand mischt beides (features/accounts neben deutschen Funktionsnamen wie schreibeSchnappschuss).
- Die Kennzahl 'Offene Schulden' (debts.debtsPage.openDebtsStat) faellt im Entwurf von der ersten Flaeche. Ist das in der KOMPAKTEN Fassung ebenfalls gewollt (dann InfoStatStrip auf zwei Kacheln), oder bleibt sie dort? Zwei Fassungen mit verschiedenem Kennzahlensatz sind erlaubt (Regel 2 fordert nur Feature-Paritaet), aber die Entscheidung gehoert benannt.

---

## Trading /trading, Analyse ("Premium") /premium, Simulation /simulation, Abrechnung /billing
**Routen:** `/trading`, `/premium`, `/simulation`, `/billing`
**Ist-Zustand:** Slice ja · 9 Kartenrahmen · 10 Abfragen in der Darstellung

### Befunde
- KEINE der vier Routen hat eine fokussierte Praesentation. `presentation/mobile/` existiert in features/trading und features/billing nicht; `useDisplayDensity` wird in der ganzen Flaeche nirgends benutzt (einziges Vorbild: src/pages/CoachPage.tsx). Regel 6 (nur eine Fassung mounten/laden) ist damit unerfuellt.
- Slice-Lage ungleich: features/trading hat domain+application+presentation (WP 6.3), features/billing hat domain+application+presentation. /premium hat GAR KEINE Slice — sein Bildschirm ist src/components/premium-dashboard/ResponsivePremiumDashboard.tsx (302 Zeilen) und traegt seine Datenschicht selbst. /simulation ist nur ein <Navigate to='/liquidity?mode=simulation'> (10 Zeilen).
- zeilenSeite 518 = die vier Routen-Wurzeln zusammen: TradingDashboard.tsx 184 + ResponsivePremiumDashboard.tsx 302 + BillingPage.tsx 22 + SimulationPage.tsx 10. Die Seiten unter src/pages selbst sind duenn (6/12/10/22) — die Masse haengt darunter: features/trading/presentation misst 3.008 Zeilen in 20 Dateien, davon 1.632 allein in etoro/.
- abfragenInDerDarstellung 10 = 5 von `check:view-data` GEZAEHLTE (alle in ResponsivePremiumDashboard.tsx: 3x useQuery ['transactions','all'] / ['categories'] / ['accounts'] + 2 Service-Import-Zeilen) plus 5 ungezaehlte in features/trading/presentation (ProviderSelector 1, AddPositionDialog 2, EtoroConnectDialog 1, OcrImportDialog 1). Die 5 gezaehlten sind der einzige Hebel der Flaeche auf view-data-budget.json (204).
- kartenrahmen 9, nachgemessen mit scripts/card-rule-core.mjs `zaehleKartenrahmen`: PortfolioCashflowsCard 1, TradingPerformanceTab 1, EtoroPerformanceTab 1, SankeyChart 1, TimelineChart 1, WeeklyPatternCharts 2, KpiCustomizeSheet 2. Die strengere Zaehlung `zaehleBoxenInFokussiert` ergibt 0 — nur weil sie ausschliesslich unter features/*/presentation/mobile/ sucht und es die dort nicht gibt.
- Boxen, die der Waechter NICHT zaehlt, aber Regel 9/10 verletzen wuerden: TradingHeader zwei <Alert>-Kaesten (Privatsphaere-Banner, 'Zuletzt aktualisiert'), PositionTable-Huelle `rounded-md border`, PortfolioCashflowsCard je Zeile `rounded-md border`, PortfolioManager je Depot `border rounded-lg` (Regel 10: wiederholter Eintrag = keine Karte je Stueck), EtoroMirrorsTab/EtoroDiscoverTab je Eintrag eine InteractiveCard, BillingSection Aktiv-Zustand `rounded-lg border bg-positive/10`, KpiCard `rounded-xl bg-muted/30` je Kennzahl.
- TABELLEN OHNE MOBILES GEGENSTUECK — bestaetigt, es sind vier: PositionTable.tsx (10 Spalten, 8 davon sortierbar per Kopfzeilen-Klick — auf dem Telefon gibt es kein Hover und keine 10 Spalten), EtoroHistoryTab.tsx (2 Tabellen: geschlossene Trades 7 Spalten, Cash-Bewegungen 5 Spalten), EtoroAnalysisTab.tsx (Gebuehren/Steuern/P&L, 4 Spalten), EtoroWatchlistsTab.tsx. Keine davon steht in platform-parity-allowlist.json — der Waechter sieht sie nicht, weil sie kein `hidden md:*` benutzen, sondern schlicht schmal gequetscht werden.
- Die Trading-Flaeche zeigt heute 10 gleichrangige Register (7 eToro + Positionen/Performance/Portfolios) in einer horizontal scrollenden Leiste, dazu 6 Knoepfe in der Kopfzeile, dazu 4 Kennzahlen. Auf einem Telefon sind das ueber 20 gleichzeitige Entscheidungen — der Dichtebruch, den der ADR benennt.
- ADR Regel 1 (zwei Wege zu einer Zahl) ist auf /premium heute VERLETZT: ResponsivePremiumDashboard.tsx Zeile 118-150 baut `resolveCategoryHierarchy` als private Kopie von `resolveHierarchy` (src/lib/analysis-data.ts:143) nach; danebensteht `topKategorien` (analysis-data.ts:248), das OHNE Hierarchie-Lauf nur nach `t.category_id` gruppiert. 'Groesste Ausgabenkategorie' hat damit zwei Rechenwege mit verschiedenen Ergebnissen. Ebenso rechnet die Datei Einnahmen/Ausgaben selbst statt ueber `computeFlowTotals` (src/features/shared/domain/flow-calculations.ts), das die Uebersicht benutzt.
- Der aktive Trading-Tab lebt in `useState` (use-etoro-account.ts:73) und steht NICHT in der URL — Regel 5 (jede Funktion unter derselben Adresse) ist fuer die 10 Register heute unerfuellt, in beiden Dichten.
- Tutorial-Anker: src/lib/tutorial-steps.ts erwartet `trading-add-position` auf /trading (interaktiver Schritt). Der Anker MUSS in der fokussierten Fassung existieren, sonst zeigt Kapitel 'trading' ins Leere. Die Schritte fuer /premium ('trends', 'insights') haben keinen Anker und sind unkritisch.
- /billing ist schon fast regelkonform: PageHeader + BillingSection mit vier sauber getrennten Zustaenden. Verstoss ist nur die Box-Optik (Aktiv-Kasten, InteractiveCard) und der PageHeader, der in der fokussierten Fassung in den Inhalt gehoert.
- Waechter-Ausgangswerte, gegen die gearbeitet wird: view-data max 204, slice-presentation max 11 / maxBausteine 0, card-rule max 149 / maxFokussiert 2 (die 2 liegen in DashboardMobileStory und SpecialCategoriesMobileStory — nicht in meiner Flaeche), touch-target 0/0, bundle-size Chunk 'TradingPage' 29.696 B und 'sankey' 31.744 B.

### Entwurf — die Aussagen

**1. Depotwert**

Grosse Zahl, ganz oben, tabular-nums: der Gesamtwert des aktiven Depots in Depotwaehrung (z. B. '12.480,55 €'). Darunter eine graue Zeile 'N Positionen'. Steht in Fremdwaehrung etwas, das nicht im Gesamtwert steckt, kommt EINE Haarlinien-Zeile dazu: '2 Positionen in Fremdwaehrung sind nicht enthalten' — sie qualifiziert die Zahl, sie ist keine eigene Aussage; Antippen oeffnet den Detailschritt.

*Datenquelle:* src/features/trading/application/use-trading-portfolio.ts → `summary.total_value`, `summary.positions_count`, `summary.currency`, `summary.unconverted_positions`. Abfrage: useQuery queryKey ['portfolio-summary', activePortfolio.id], queryFn getPortfolioSummary. Gerechnet in src/features/trading/domain/portfolio-summary.ts `summarizePortfolio`. DIESELBE Quelle wie TradingSummaryStats.tsx heute — kein zweiter Weg.

*Aktion:* Der ganze Block ist ein Link auf den Detailschritt ?lage=verlauf (Wertverlauf), analog zum Kontostand-Block in CoachFokussiert. Rechts daneben, klein und als Rahmen (nicht als Aussage gezaehlt): der Primaerknopf 'Position hinzufuegen' mit data-tour-id='trading-add-position' — er bleibt SICHTBAR, damit der Tutorial-Anker ohne Aenderung an src/lib/tutorial-steps.ts trifft.

**2. Gewinn/Verlust seit Kauf**

Durch eine Haarlinie (border-t) abgesetzt, bewusst kleiner als Aussage 1: vorzeichenbehafteter Betrag in text-positive bzw. text-warning ('+1.204,30 €'), daneben die Prozentzahl ('+10,68 %'). Darunter eine graue Zeile 'Investiert 11.276,25 €'. Kein Rahmen, kein Hintergrund.

*Datenquelle:* Dasselbe `summary` wie Aussage 1: `unrealized_gain_loss`, `unrealized_gain_loss_percent`, `total_cost` aus use-trading-portfolio.ts / summarizePortfolio. Genau die vier Werte, die TradingSummaryStats heute als InfoStatStrip zeigt — die kompakte Fassung behaelt den Strip, die fokussierte setzt zwei davon gross und zwei als Nebenzeile.

*Aktion:* Antippen oeffnet den Detailschritt ?lage=rendite (Wertverlauf + geldgewichtete Rendite + Ein-/Auszahlungen).

**3. Die Positionen**

Ueberschrift 'Positionen' plus rahmenlose Liste (divide-y, KEINE Karte je Zeile, Regel 10). Je Zeile: links Symbol fett und Name grau darunter, rechts der Positionswert und darunter die Prozentangabe in Farbe. Mindesthoehe 44 px je Zeile. Nach Gewinn/Verlust absteigend — dieselbe Voreinstellung wie die Tabelle heute (sortField='gain_loss', desc). Die uebrigen 7 Sortierungen und die 10 Spalten der Tabelle liegen im Detailschritt. Die Liste ist die benannte Ausnahme zu 'ein Bildschirm': ab hier darf gescrollt werden.

*Datenquelle:* use-trading-portfolio.ts → `positions` (useQuery ['portfolio-positions', activePortfolio.id], getPositions). Zeilenwerte ueber src/features/trading/domain/position-metrics.ts: `currentPriceOf`, `calculateGainLoss`, `calculateGainLossPercent` — exakt die Funktionen, die PositionTable.tsx heute schon benutzt. Leerzustand: die bestehenden Texte trading.positionTable.empty / .emptyHint.

*Aktion:* Zeile antippen → Bottom-Sheet mit allen Werten der Tabellenzeile (Menge, Kaufdatum, Einstiegskurs, aktueller Kurs, Betrag, %, p. a.) und den beiden Aktionen Bearbeiten/Loeschen. Bearbeiten oeffnet den bestehenden AddPositionDialog ueber `handleEditPosition`, Loeschen den bestehenden AlertDialog ueber `handleDeletePosition` — keine neue Logik, nur ein anderer Traeger.

### Detailschritt
- /trading, alles unter DERSELBEN Route ueber ?lage=<bereich> (Regel 5, Vorbild ?lage=offen in CoachFokussiert). Ein Bottom-Sheet je Wert, darin darf gescrollt werden.
- ?lage=verlauf — TradingPerformanceTab (Wertverlauf; fuer eToro-Depots EtoroPerformanceTab mit dem echten Kontostand-Verlauf). Der <Card>-Rahmen entfaellt, ChartFigure bleibt.
- ?lage=rendite — PortfolioCashflowsCard: geldgewichtete Rendite, Summe eingezahlt/entnommen, Liste der Ein-/Auszahlungen. Quelle unveraendert use-portfolio-cashflows.ts. Karte wird Abschnitt (Ueberschrift + Liste), die Zeilen verlieren ihr `rounded-md border`.
- ?lage=positionen — die volle Tabelle: alle 10 Spalten und alle 8 Sortierungen. Auf dem Telefon als Sortier-Auswahl (Sheet mit Radiogruppe) ueber derselben Liste, nicht als querscrollende Tabelle. Nichts entfaellt.
- ?lage=depots — PortfolioManager (Depot anlegen/umbenennen/loeschen/aktiv setzen). Die je-Depot-Karten (`border rounded-lg`) werden eine divide-y-Liste.
- ?lage=kurse — ProviderSelector (Yahoo/Stooq inkl. Favorit), 'Kurse aktualisieren', der Zeitpunkt der letzten Aktualisierung (heute ein <Alert>, kuenftig eine graue Zeile) und der Privatsphaere-Hinweis (heute ein <Alert> ganz oben — er ist eine Zusage, keine Aussage von heute).
- ?lage=import — 'Bild importieren' (OcrImportDialog), 'CSV importieren', 'eToro verbinden' (EtoroConnectDialog), 'eToro synchronisieren'.
- ?lage=waehrung — UnconvertedCurrencyNotice mit den nicht umgerechneten Positionen. Ziel der Haarlinien-Zeile unter Aussage 1.
- ?lage=etoro — nur bei eToro-Depots: eine rahmenlose Liste der sieben Bereiche (Uebersicht, Smart Portfolios, Historie, Analyse, Watchlists, News, Entdecken), jeder oeffnet ?lage=etoro-<bereich> mit dem bestehenden Tab-Baustein. Das Gatter `etoroTabEnabled` bleibt unveraendert: Ein Bereich, den niemand geoeffnet hat, fragt eToro nicht ab.
- /premium — Aussage 1 'Ausgaben' (grosse Zahl), Aussage 2 'Groesster Posten: <Hauptkategorie> <Betrag>' mit Anteil in Prozent, Aussage 3 die rahmenlose Rangliste 'Wohin fliesst mein Geld?' (Hauptkategorien mit Betrag und Anteilsbalken als reine Breite, kein Kasten); Zeile antippen = Drilldown in die Unterkategorien, derselbe Drilldown, den das Sankey heute per Klick anbietet. Zeitraum-Umschalter (Alle Daten / Monat / Durchschnitt) liegt als Rahmen in der Kopfzeile, nicht als vierte Aussage. Detailschritt ?lage=offen: Zeitverlauf, Wochenmuster, Insights, Aktivitaetskalender, Kennzahlenband.
- /billing — Aussage 1 der Status ('Aktiv bis 4. Oktober 2026' bzw. 'Kein Abo'), Aussage 2 das Angebot (Titel + Nutzen), Aussage 3 entfaellt; die Kauf-Schaltflaeche ist Rahmen, kein Inhalt. Alle vier Zustaende (loading/unavailable/error/active/empty) bleiben unterschieden, wie use-subscription.ts sie liefert. Keine Boxen: der gruene Aktiv-Kasten wird eine Zeile mit Haken und Haarlinie, die InteractiveCard wird Ueberschrift + Text + Knopf.
- /simulation — kein Entwurf. Die Route ist ein <Navigate to='/liquidity?mode=simulation' replace>; ihre fokussierte Fassung IST die von /liquidity und gehoert der Liquiditaets-Flaeche. Die Route bleibt bestehen (e2e-tests/fixtures/routes.ts, ROUTE_GUARDS).

### Begründung

AUFBAU JE ROUTE: Ein duenner Einstieg (src/pages/*.tsx) liest EIN ViewModel und waehlt per `useDisplayDensity()` + `lazy()` genau eine Praesentation — woertlich das Muster von src/pages/CoachPage.tsx, damit Regel 6 und 7 (nur eine Fassung geladen, Entscheidung vor dem ersten Anstrich) ohne neue Mechanik erfuellt sind.

WARUM DIESE DREI AUSSAGEN AUF /trading: Wer ein Depot oeffnet, sucht zuerst 'was ist es wert', dann 'habe ich gewonnen oder verloren', dann 'woraus besteht es'. Genau diese Reihenfolge ist Regel 3 (Aussage → Detail → Konfiguration). Alles andere auf der heutigen Flaeche ist Konfiguration (Kursanbieter, Import, Depotverwaltung) oder Vertiefung (Verlauf, Rendite, sieben eToro-Bereiche) und gehoert hinter einen Schritt — nicht weg. Der Privatsphaere-Hinweis und der 'zuletzt aktualisiert'-Kasten sind die zwei Kaesten, die heute VOR der ersten Zahl stehen; beide beantworten keine Frage von heute.

KEINE NEUEN ZAHLEN: Jede Zahl im Entwurf kommt aus `summary` bzw. `positions` desselben ViewModels, das TradingDashboard heute liest. Es entsteht keine zusaetzliche Abfrage und kein zweiter Rechenweg — die kompakte Fassung (TradingSummaryStats + PositionTable) und die fokussierte lesen dasselbe `useTradingPortfolio()`.

WAS DIE WAECHTER-ZAHLEN TUN MUESSEN (ADR: 'Jede migrierte Flaeche muss die Zahlen senken'): view-data 204 → 199, indem die 5 gezaehlten Zugriffe aus ResponsivePremiumDashboard.tsx in ein neues `src/features/analysis/application/use-analysis-overview.ts` wandern (das ist der EINZIGE Hebel der Flaeche; features/trading und features/billing tragen dort bereits 0 bei). card-rule 149 → 147, indem PortfolioCashflowsCard (Karte um eine Liste) und WeeklyPatternCharts (zwei Karten fuer einen Abschnitt) entrahmt werden — Regel 10 gilt in BEIDEN Dichten. slice-presentation muss bei 11/0 BLEIBEN: das gelingt nur, wenn die fokussierten Praesentationen nichts aus src/components ausser ui/ importieren; deshalb baut das fokussierte /premium seine Rangliste selbst und greift NICHT auf src/components/premium-dashboard/SankeyChart.tsx oder src/components/kpi/KpiSection.tsx zu. card-rule maxFokussiert muss bei 2 bleiben — die neuen mobile/-Dateien duerfen keine einzige Box enthalten.

VARIANTE A vs. B AUF /premium: B (empfohlen, hier entworfen) — die fokussierte Fassung zeigt die Rangliste, die kompakte behaelt Sankey/Timeline/Heatmap in src/components; kein fremdes Verzeichnis wird angefasst, die Flaeche laeuft parallel zu allen anderen. A (Rueckfallweg) — SankeyChart & Co. ziehen nach src/features/shared/presentation/ bzw. features/analysis/presentation/shared/; dann sind DashboardDesktopView.tsx, DashboardMobileStory.tsx, i18n-allowlist.json und der Bundle-Chunk 'sankey' mitbetroffen und die Flaeche kann NICHT parallel zur Uebersichts-Flaeche laufen. Die Entscheidung gehoert vor den Umbau, nicht hinein.

WAS AUSDRUECKLICH NICHT AMPUTIERT WIRD: die 10 Tabellenspalten und 8 Sortierungen (?lage=positionen), die drei Tabellen der eToro-Bereiche (?lage=etoro-historie/-analyse/-watchlists), alle sechs Kopfzeilen-Aktionen, die Depotverwaltung, der Waehrungshinweis. Nichts davon verschwindet; alles liegt einen Schritt tiefer unter derselben Adresse.

### Benötigte Texte (für S2)

| Schlüssel | de | en |
|---|---|---|
| `trading.fokussiert.detailTitle` | Depot im Detail | Portfolio in detail |
| `trading.fokussiert.more` | Alles zum Depot | Everything about the portfolio |
| `trading.fokussiert.investedHint` | {amount} investiert | {amount} invested |
| `trading.fokussiert.unconvertedHint` | {count} Positionen in Fremdwährung sind nicht enthalten | {count} positions in a foreign currency are not included |
| `trading.fokussiert.sortLabel` | Sortieren nach | Sort by |
| `trading.fokussiert.etoroSections` | eToro-Konto | eToro account |
| `trading.fokussiert.settingsSection` | Kurse & Import | Prices & import |
| `premium.fokussiert.expensesLabel` | Ausgaben | Spending |
| `premium.fokussiert.biggestItem` | Größter Posten | Biggest item |
| `premium.fokussiert.shareOfSpending` | {percent} deiner Ausgaben | {percent} of your spending |
| `premium.fokussiert.detailTitle` | Alle Auswertungen | All analyses |
| `premium.fokussiert.more` | Mehr Auswertungen | More analyses |
| `premium.fokussiert.backToMain` | Zurück zu den Hauptkategorien | Back to main categories |
| `billing.fokussiert.statusLabel` | Dein Zugang | Your access |
| `billing.fokussiert.none` | Kein Abo | No subscription |

### Gemeinsame Dateien (entscheiden über Parallelisierbarkeit)
- `src/i18n/translations/de.ts — neue Schluessel trading.fokussiert.*, premium.fokussiert.*, billing.fokussiert.*. Wird von JEDER Flaechen-Migration angefasst; heisser Konfliktpunkt.`
- `src/i18n/translations/en.ts — dito, Paritaet erzwungen durch src/i18n/__tests__/locale-parity.test.ts.`
- `src/i18n/translations/ru.ts — dito, SUPPORTED_LOCALES, Paritaet erzwungen.`
- `src/i18n/translations/tlh.ts — INACTIVE_LOCALES, strukturell unvollstaendig; nur mitfuehren, wenn der Baum dort schon Nachbarschluessel hat.`
- `src/i18n/overlays/everyday/de.ts — nur falls die neuen Labels eine Alltagssprache-Variante brauchen ('Depotwert' vs. 'Was dein Depot wert ist').`
- `src/i18n/overlays/everyday/en.ts — dito.`
- `src/i18n/overlays/everyday/ru.ts — dito.`
- `view-data-budget.json — max 204 → 199, wenn die 5 Zugriffe aus ResponsivePremiumDashboard in features/analysis/application wandern. MUSS gesenkt werden (ADR-Vorgabe). Jede parallel laufende Flaeche will dieselbe Zeile aendern.`
- `card-rule-budget.json — max 149 → 147 (PortfolioCashflowsCard, WeeklyPatternCharts entrahmt); maxFokussiert muss bei 2 BLEIBEN. Gemeinsame Datei aller Flaechen.`
- `slice-presentation-budget.json — max 11 / maxBausteine 0 duerfen NICHT steigen; ist die Datei, die Variante A auf /premium verbietet, solange die Charts unter src/components liegen.`
- `bundle-size-budget.json — Chunk 'TradingPage' (29.696 B) veraendert sich durch die dichte-abhaengige lazy-Aufteilung; Chunk 'sankey' (31.744 B) nur bei Variante A. Neue Chunks fuer AnalysisPage/BillingPage moeglich.`
- `touch-target-budget.json — beide Spalten stehen auf 0; die neuen fokussierten Listen/Sheets duerfen sie nicht heben (44 px je Zeile, min-h-11 an jedem Icon-Knopf).`
- `platform-parity-allowlist.json — nur falls beim Umbau irgendwo ein `hidden <bp>:*` ohne Gegenstueck entsteht. Der Entwurf verzweigt ueber useDisplayDensity statt ueber CSS und braucht deshalb voraussichtlich KEINEN Eintrag; PositionTable/EtoroHistoryTab/EtoroAnalysisTab/EtoroWatchlistsTab bekommen mit ihren mobilen Gegenstuecken evtl. je einen Paar-Eintrag.`
- `i18n-allowlist.json — Eintrag 'src/components/premium-dashboard/SankeyChart.tsx': 2 haengt am PFAD; nur bei Variante A (SankeyChart zieht um) betroffen.`
- `src/components/premium-dashboard/ResponsivePremiumDashboard.tsx — der /premium-Bildschirm liegt AUSSERHALB der mir genannten Verzeichnisse. Wird prop-getrieben umgebaut (Abfragen raus in features/analysis/application). Gehoert fachlich zu mir, technisch in fremdes Verzeichnis.`
- `src/components/premium-dashboard/TimelineChart.tsx — nur bei Variante A (Umzug); sonst unveraendert.`
- `src/components/premium-dashboard/SankeyChart.tsx — GETEILT mit der Uebersichts-Flaeche (DashboardDesktopView, DashboardMobileStory). Nur bei Variante A angefasst; dann hoher Konflikt.`
- `src/components/premium-dashboard/HeatmapCalendar.tsx — nur bei Variante A.`
- `src/components/premium-dashboard/WeeklyPatternCharts.tsx — zwei Karten fuer einen Abschnitt (Regel 10, gilt auch kompakt); Entrahmung senkt card-rule um 2.`
- `src/components/premium-dashboard/SmartInsightsPanel.tsx — nur bei Variante A.`
- `src/features/dashboard/presentation/desktop/DashboardDesktopView.tsx — NUR bei Variante A (Importpfad von SankeyChart). Datei der Uebersichts-Flaeche.`
- `src/features/dashboard/presentation/mobile/DashboardMobileStory.tsx — NUR bei Variante A (Importpfad von SankeyChart). Datei der Uebersichts-Flaeche; enthaelt ausserdem eine der zwei verbliebenen maxFokussiert-Boxen.`
- `src/components/kpi/KpiSection.tsx — GETEILT mit src/components/dashboard/Dashboard.tsx. Der Entwurf benutzt sie in der fokussierten Fassung NICHT (KpiCard ist eine bg-Box). Nur anfassen, wenn jemand die Kennzahlen auch fokussiert zeigen will.`
- `src/components/kpi/KpiCard.tsx — `rounded-xl bg-muted/30` je Kennzahl ist unter Regel 9 eine Box. Betrifft auch die Uebersicht.`
- `src/lib/analysis-data.ts — nur LESEND geplant (`resolveHierarchy`, `sumIncome`/`sumExpenses`). Wird schreibend beruehrt, falls die offene Frage zu 'groesste Ausgabenkategorie' zugunsten einer Vereinheitlichung von `topKategorien` entschieden wird — dann teilen sich Uebersicht, Buchungen und /premium die Aenderung.`
- `src/features/shared/domain/flow-calculations.ts — nur lesend (`computeFlowTotals`), damit /premium nicht seinen eigenen Weg zu Einnahmen/Ausgaben behaelt.`
- `e2e-tests/fixtures/routes.ts — enthaelt /trading, /premium, /billing, /simulation; die Routenliste soll laut ADR in BEIDEN Dichten laufen. Gemeinsame Datei aller Flaechen.`
- `src/lib/tutorial-steps.ts — voraussichtlich NICHT anzufassen: der Anker 'trading-add-position' bleibt im Entwurf sichtbar auf dem fokussierten Bildschirm. Nur anfassen, falls die Aktion doch in den Detailschritt wandert (dann braucht der Schritt einen `openAnchor`).`
- `src/components/layout/nav-config.ts — nur lesend (ROUTE_GUARDS fuer /premium und /simulation, Nav-Eintraege 'Trends & Berichte' und 'Trading'). Anfassen nur, falls die Benennung Analyse/Premium vereinheitlicht wird.`
- `src/pages/__tests__/TradingPage.states.test.tsx, TradingPage.error-state.test.tsx, TradingPage.tabs.test.tsx, AnalysisPage.states.test.tsx, AnalysisPage.error-state.test.tsx, BillingPage.states.test.tsx — bestehende Zustandstests; sie muessen nach ADR ('doppelte Zustands-Abdeckung') je Dichte laufen. Liegen in src/pages/__tests__, also ausserhalb meiner Verzeichnisse.`

### Offene Fragen
- ENTSCHEIDUNG VOR DEM UMBAU — Variante A oder B auf /premium. B (hier entworfen): die fokussierte Fassung zeigt eine rahmenlose Rangliste mit Drilldown statt des Sankey; nichts ausserhalb meiner Flaeche wird angefasst, die Flaeche laeuft parallel. A: SankeyChart/TimelineChart/HeatmapCalendar/WeeklyPatternCharts/SmartInsightsPanel ziehen nach features/ (SankeyChart nach features/shared/presentation/, Praezedenzfall BudgetTank aus der Coach-Migration); dann sind DashboardDesktopView.tsx, DashboardMobileStory.tsx, i18n-allowlist.json und der Bundle-Chunk 'sankey' mitbetroffen und die Flaeche darf NICHT parallel zur Uebersichts-Flaeche laufen.
- ADR REGEL 1, ungeloest im Bestand: 'Groesste Ausgabenkategorie' hat heute zwei Rechenwege — die private Kopie `resolveCategoryHierarchy` in ResponsivePremiumDashboard.tsx (Hauptkategorie ueber die parent-Kette, aus subcategory_id ?? category_id) und `topKategorien` in src/lib/analysis-data.ts (nur `t.category_id`, kein Hierarchie-Lauf). Aussage 2 des fokussierten /premium zeigt genau diese Zahl. Welcher Weg ist kanonisch? Ich schlage `resolveHierarchy` vor (dieselbe Funktion, die Sankey und Sunburst benutzen) und `topKategorien` entsprechend nachzuziehen — das ist eine Aenderung an src/lib/analysis-data.ts und damit an einer Datei, die Uebersicht und Buchungen mitbenutzen.
- Slice-Benennung: die Fläche heisst heute dreifach — Route /premium, Nav-Label 'Trends & Berichte', Datei AnalysisPage.tsx, Verzeichnis premium-dashboard, i18n-Praefix premium.dashboard. Der neue Slice-Name (features/analysis vs. features/premium) ist eine Bezeichnung mit Bleibewirkung (AGENTS.md 'Absicht vor Auftrag') und gehoert entschieden, bevor Dateien angelegt werden. Ich empfehle `features/analysis` (der Route-Name 'premium' benennt ein Preismodell, nicht eine Fachfrage) — dann sind i18n-Praefix und Nav-Label anzugleichen.
- Register-Zustand: der Entwurf legt die zehn Trading-Bereiche adressierbar unter ?lage=<bereich> (Regel 5). Soll die KOMPAKTE Fassung mitziehen, oder behaelt sie ihr `useState` in use-etoro-account.ts:73? Zwei Wege zu demselben Zustand sind zwei Wege, auf denen er auseinanderlaeuft — ich empfehle, den Tab-Zustand in beiden Dichten aus der URL zu lesen. Das ist eine Aenderung am gemeinsamen ViewModel, nicht an einer Praesentation.
- /simulation: bestaetigen, dass die Route ein reiner Kompatibilitaets-Redirect bleibt und ihre fokussierte Fassung von der Liquiditaets-Flaeche (/liquidity?mode=simulation) mitentworfen wird. Sonst faellt sie zwischen zwei Auftraege.
- Keine neue Abfrage ist im Entwurf noetig — mit einer Ausnahme, die ich ausdruecklich NICHT vorschlage, sondern als Luecke melde: Der fokussierte /trading-Bildschirm hat keine Zahl fuer 'wie hat sich der Wert seit gestern/letzter Woche bewegt'. Fuer Nicht-eToro-Depots existiert dafuer heute keine echte Historie (buildPerformancePreview ist ausdruecklich SIMULIERT, siehe performance-preview.ts). Eine Tagesveraenderung waere eine neue Datengrundlage und ist bewusst nicht Teil des Entwurfs.
- Vier Tabellen ohne mobiles Gegenstueck (PositionTable, EtoroHistoryTab mit 2 Tabellen, EtoroAnalysisTab, EtoroWatchlistsTab) brauchen je eine fokussierte Bauform. Der Entwurf loest PositionTable auf; fuer die drei eToro-Tabellen ist die Bauform (Liste mit Sheet vs. Zeile mit zwei Zeilen Text) noch nicht festgelegt — sie liegen im Detailschritt und koennen in einem zweiten Zug folgen, ohne den ersten zu blockieren.

---

## Fragen /fragen · Tutorials /tutorials · Datenschutz /privacy (src/pages/MoneyQuestionsPage.tsx, TutorialsPage.tsx, PrivacyPage.tsx, src/features/money-questions/**, src/features/tutorials/**)
**Routen:** `/fragen`, `/tutorials`, `/privacy`
**Ist-Zustand:** Slice ja · 4 Kartenrahmen · 5 Abfragen in der Darstellung

### Befunde
- hatSlice ist gemischt: money-questions und tutorials haben je application/ + presentation/, /privacy hat GAR KEINE Slice — PrivacyPage.tsx ist Routeneinstieg, Datenschicht und Darstellung in einer 188-Zeilen-Datei.
- KEINE der drei Routen hat presentation/mobile/. Es gibt keine Dichte-Verzweigung, kein lazy je Dichte (ADR Regel 6), keinen useDisplayDensity-Aufruf. Alle drei liefern dieselbe kompakte Fassung an das Telefon.
- zeilenSeite 1176 = 23 (MoneyQuestionsPage) + 18 (TutorialsPage) + 188 (PrivacyPage) + 784 (MoneyQuestionsPane) + 163 (TutorialsOverview). Die eigentliche Darstellung liegt zu 80 % in der Slice, nicht auf der Seite.
- Kartenrahmen 4: alle vier in PrivacyPage.tsx (<Card> um Verschluesselung, Server-Kontakt, Datenmodell, Analytics). Alle vier sind TOTE Karten nach Prinzip 8 — nur die erste enthaelt ueberhaupt einen Knopf, und der ist ein verschachtelter Button in einer sonst toten Karte, genau die verbotene Form. check:card-rule schweigt, weil <Link> in der Datei vorkommt.
- Zwei weitere Boxen zaehlt der Waechter NICHT, die ADR verbietet sie trotzdem: MoneyQuestionsPane.tsx:151 'rounded-md border border-border/60' um das Semantik-Opt-in (nur rounded-lg|xl|2xl zaehlen) und TutorialsOverview.tsx:60 'rounded-xl bg-gradient-to-br ... p-5' um den Fortschritt (Farbverlauf statt bg-card).
- 26 Kapitel der Tutorial-Uebersicht liegen als je EINE InteractiveCard untereinander. Das ist ADR Regel 10 Satz 2 ('ein wiederholter Eintrag bekommt keine Karte je Stueck') — die Ratsche bewegt sich nicht, weil InteractiveCard ausdruecklich nicht mitzaehlt.
- abfragenInDerDarstellung 5, gemessen mit scripts/view-data-core.mjs: PrivacyPage.tsx 3 (1 useQuery analyticsConsent + 2 Service-Importe getAnalyticsConsent, isCloudMcpSyncActive), AnalyticsTransparencyPreview.tsx 2. MoneyQuestionsPage und TutorialsPage stehen auf 0 — dort ist die Trennung schon gemacht.
- /fragen, Tastatur (der Kernbefund): Das Eingabefeld steht OBEN, die Antwort waechst DARUNTER. Mit offener Tastatur ist genau die Antwort verdeckt. index.html:6 setzt 'width=device-width, initial-scale=1.0, viewport-fit=cover' OHNE interactive-widget — es gilt der Standard resizes-visual, der Layout-Viewport schrumpft also nicht: 100dvh, sticky bottom-0 und die fixe BottomNav folgen der Tastatur nicht.
- /fragen, Tastatur (Folge davon): main traegt pb-[calc(5rem+env(safe-area-inset-bottom))] fuer die BottomNav. Bei offener Tastatur bleibt dieser Streifen als toter Rand reserviert, obwohl vom sichtbaren Bereich auf einem 411-px-Telefon nur noch rund 300 px uebrig sind.
- Im ganzen Baum gibt es keinen einzigen Treffer auf Keyboard, visualViewport oder interactive-widget (grep ueber src, index.html, capacitor.config.ts). AndroidManifest.xml setzt an MainActivity kein android:windowSoftInputMode.
- Das Eingabefeld ist zu klein: ui/input.tsx ist fest 'h-10' = 40 px. Das Hauptbedienelement von /fragen liegt damit unter den 44 px aus AGENTS.md Paragraf 4 — check:touch-targets sieht es nicht, weil er nur Buttons und Klassen kennt.
- Am Eingabefeld fehlen enterKeyHint, inputMode, autoCapitalize und autoCorrect. Die Bildschirmtastatur zeigt eine generische Eingabetaste statt 'Senden'.
- Aussagen auf /fragen VOR der ersten Frage: Titel, Intro-Satz, Eingabefeld, dazu der Opt-in-Kasten mit Schaltertitel, MB-Beschreibung, Installationsstand (Bytes und Dateizahl), Speicherort-Pfad, Loeschen-Knopf und ggf. rohem Fehlertext. Das sind acht gleichrangige Dinge auf einer Flaeche, die eine Frage stellen soll — und der Opt-in ist KONFIGURATION, die nach ADR Regel 3 nie neben der Aussage stehen darf.
- Aussagen auf /fragen NACH einer Antwort: Zahl, Antwortsatz, Herkunfts-Punkt mit Text, Buchungszahl, beliebig viele Begruendungszeilen, Deep-Link, dazu bei Kategoriefragen 'Verstanden als' mit je einem Chip pro Kategorie plus Alternativ-Chips — und darunter immer noch der Opt-in-Kasten.
- Aussagen auf /privacy: vier Kartenblöcke mit Titel, Beschreibung und je einer bis zwei Aufzaehlungen — sharedWithServer und neverShared sind zwei vollstaendige Listen, das Datenmodell vier Absaetze, Analytics vier Punkte plus eingebettete Vorschau. Ohne Scrollen ist davon nichts zu sehen.
- /privacy ist in src/App.tsx ZWEIMAL geroutet: Zeile 156 (ausserhalb der AppShell, fuer den anonymen Modus, ohne BottomNav) und Zeile 237 (innerhalb). Eine fokussierte Fassung muss in beiden Einhaengungen tragen.
- Beide Ratschen stehen exakt auf Anschlag: card-rule max 149/149, maxFokussiert 2/2, view-data 204, slice-presentation max 11, touch-targets 0/0. Jede Migration muss die Zahlen SENKEN, und ein neuer Import aus src/components/ macht sie sofort rot.

### Entwurf — die Aussagen

**1. Die Antwort als Zahl — oder, vor der ersten Frage, die Einladung**

Groesste Zahl der Flaeche, text-5xl tabular-nums, oben: '248,10 EUR'. Solange keine Frage gestellt ist, steht an derselben Stelle EIN Satz — 'Was willst du ueber dein Geld wissen?' — und darunter hoechstens drei antippbare Beispielfragen als Textzeilen mit Haarlinie dazwischen, keine Chips, keine Kacheln. Bei 'unverstanden' bzw. 'kandidaten' steht hier statt der Zahl die Rueckfrage in derselben Groesse; die anzubietenden Kandidaten sind dieselben Textzeilen wie die Beispiele. Betraege laufen immer durch useMoneyFormat().format (Sanfter Modus), Anzahlen durch Intl.NumberFormat der Locale.

*Datenquelle:* useMoneyQuestions() aus src/features/money-questions/application/use-money-questions.ts — model.ergebnis (MoneyQuestionOutcome): ergebnis.antwort.wert und .art, Typ QuestionAnswer aus src/features/shared/domain/question-registry.ts; model.beispiele fuer die Beispielfragen; model.frage/setFrage/absenden/rechnet fuer das Feld. Formatierung: useMoneyFormat() aus src/hooks/useMoneyFormat.ts. KEINE neue Abfrage — dasselbe ViewModel, das MoneyQuestionsPane heute schon bekommt.

*Aktion:* Das Eingabefeld sitzt UNTEN, nicht oben: die Flaeche ist flex flex-col mit min-h-[100dvh] minus Kopf, der Antwortblock steht oben, das Formular traegt mt-auto und sticky bottom-0. Damit waechst die Antwort ueber dem Daumen und ueber der Tastatur statt unter ihr. Feld bekommt min-h-11 (44 px), enterKeyHint='send', autoCapitalize='sentences', autoCorrect='on'; der Senden-Knopf behaelt seine Papierflieger/Kreis-Quittung.

**2. Der Antwortsatz mit Zeitraum und Buchungszahl**

Ein Satz in text-base direkt unter der Zahl: 'Fuer Lebensmittel im Juli 2026.' Darunter EINE kleine, untergeordnete Zeile — nicht als vierte Aussage, sondern als Fussnote zur selben Zahl: 'Aus 57 Buchungen'. Die Zeile erscheint nur bei deepLinkArt === 'quelle' und anzahl > 0; die bestehende Singular/Plural-Trennung (countOne/countMany) bleibt. Bei anzahl === 0 und deepLinkArt === 'quelle' steht statt Zahl und Satz der noMatch-Satz — 'Dazu gibt es keine Buchung' — und die Zahl entfaellt ganz.

*Datenquelle:* Dieselbe QuestionAnswer aus model.ergebnis: antwort.aussage (durch die bestehende Funktion einsetzen() aus MoneyQuestionsPane.tsx, die dabei ins Sprachliche uebersetzt: Monat, Datum, Prozent, 'all'), antwort.anzahl, antwort.deepLinkArt, antwort.deepLink, antwort.deepLinkLabelKey. Die Funktion einsetzen() und ihre Platzhalter-Mengen wandern unveraendert in eine gemeinsame Datei der Slice, damit beide Dichten EINE Fassung benutzen.

*Aktion:* Deep-Link 'Buchungen ansehen' zu antwort.deepLink, Beschriftung weiterhin nach deepLinkArt (quelle vs. kontext). Zaehlt als Detail-Verweis und damit als Rahmen, nicht als Aussage.

**3. Wie ich die Frage verstanden habe**

Eine Zeile ueber einer Haarlinie: 'Verstanden als: Lebensmittel, Restaurant — ohne Modell gedeutet.' Der Herkunfts-Punkt (leuchtend bei quelle === 'modell', matt sonst) bleibt als 8-px-Punkt vor der Zeile stehen; er ist heute schon aria-hidden, die Beschriftung sagt dasselbe. KEINE Chips auf diesem Bildschirm — Korrigieren ist eine Handlung, keine Aussage, und liegt einen Schritt tiefer. Ohne erkannte Kategorie steht hier nur die Herkunftszeile.

*Datenquelle:* model.ergebnis.erschlosseneKategorie (label und teile[]) und model.ergebnis.quelle ('modell' oder nicht) — beide aus demselben useMoneyQuestions(). Texte: financeQuestions.understoodAs, financeQuestions.semantik.gedeutetKurz / .ohneModellKurz, alle bereits im Sprachbaum.

*Aktion:* Die ganze Zeile ist ein <button> mit min-h-11 und oeffnet den Detailschritt ?frage=detail unter derselben Route.

### Detailschritt
- /fragen — ?frage=detail (Bottom-Sheet, gleiche Route, mit Zurueck-Taste schliessbar, Vorbild CoachFokussiert 'lage=offen'): antwort.begruendung (alle Zeilen), antwort.posten als Liste, antwort.vergleich als Paar mit Differenz, die Korrektur-Chips aus erschlosseneKategorie.teile (entferneKategorie) und .alternativen (ergaenzeKategorie), sowie die Rueckfrage-Vorschlaege (waehleVorschlag) und die Kandidatenliste (waehleKandidat), soweit sie nicht schon in Aussage 1 stehen. Hier DARF gescrollt werden — Regel 9 richtet sich an den Bildschirm beim Oeffnen, nicht an einen bewusst geoeffneten Detail.
- /fragen — ?frage=einstellungen (zweiter Schritt, gleiche Route): das komplette Semantik-Opt-in. Schalter, Downloadgroesse in MB, gelesener Installationsstand (bytes, dateien, unvollstaendig), Speicherort (SEMANTIK_CACHE_KEY), Loeschen-Knopf und der ECHTE Fehlertext aus s.lage.text. Alles unveraendert aus model.semantik. Begruendung fuer den eigenen Schritt: Das ist Konfiguration, und ADR Regel 3 verbietet Konfiguration auf derselben Ebene wie die Aussage. Der Ladefortschritt der Stufe 3 (lage.phase download/bereitet) bleibt dagegen auf dem Hauptbildschirm als einzeilige role='status'-Meldung unter Aussage 1 — ein Zustand, der still nachlaedt, sieht sonst aus wie ein endgueltiges Nein.
- /tutorials — KEIN Detailschritt, und das ist die Aussage. Die Kapitelliste ist die benannte Listen-Ausnahme zu 'ein Bildschirm' (ADR Regel 9): 26 Kapitel ohne Scrollen gibt es nicht, und sie zu kappen hiesse Daten zu verstecken. Es wird nichts weggenommen, also gibt es nichts zu verbergen. Drei Aussagen darueber: (1) Fortschritt als EINE Zeile '7 von 26 Kapiteln' mit einer duennen Fuellung darunter statt Zahl, Bruch, Prozentzahl und Balken in einem Farbverlaufs-Kasten — Quelle catalog.doneCount / catalog.total aus use-tutorial-catalog.ts. (2) Der naechste Schritt: 'Weiter mit <Kapiteltitel>' plus der Knopf 'Alles der Reihe nach' (startSeries), Quelle ist das erste Kapitel mit state !== 'waiting' aus catalog.sections[].chapters[] — dieselbe Menge, die TutorialsOverview heute schon als 'runnable' bildet. (3) Die Liste selbst: Abschnittsueberschrift mit t(section.titleKey) und dem Bruch section.doneCount/section.total rechts, darunter Zeilen mit divide-y statt 26 InteractiveCard. Jede Zeile ist ein <button> mit min-h-11: Icon nach state (done/waiting/ready), Titel, darunter 'x Schritte · fertig'. Wartende Kapitel bleiben sichtbar und grau (disabled), wie heute.
- /privacy — ?datenschutz=offen (Bottom-Sheet, gleiche Route, funktioniert auch in der AppShell-losen Einhaengung aus App.tsx:156): die vollstaendige Liste status.sharedWithServer, die vollstaendige Liste status.neverShared, die vier Modell-Absaetze (privacy.modelLocalFirst / modelEncryption / modelLogin / modelBackup mit ihren Labels) und der Analytics-Abschnitt mit privacy.analyticsIntro, den vier Punkten und AnalyticsTransparencyPreview. Nichts davon wird geloescht, alles bleibt unter /privacy adressierbar. Die drei Aussagen darueber: (1) 'Deine Finanzdaten liegen auf diesem Geraet.' als groesster Satz, darunter der Verschluesselungsstand als untergeordnete Zeile ('Verschluesselt und entsperrt' / 'Verschluesselt, gesperrt' / 'Nicht verschluesselt') aus useLocalEncryption() (enabled, unlocked); bei !enabled ein Textlink 'Verschluesselung einschalten' nach /settings. (2) status.serverContactLabel als EINE Zeile ('Server-Kontakt: Konto, Bank-Anbindung') statt Karte mit zwei Aufzaehlungen — Quelle derivePrivacyStatus aus src/lib/privacy-status.ts, gespeist aus getAnalyticsConsent (Query analyticsConsent), isCloudMcpSyncActive() und isBillingConfigured(). (3) status.neverShared als EINE Zeile ('Buchungen, Schulden, Briefe & Dokumente bleiben hier'), dieselbe Quelle. Der bestehende Fehlerfall bleibt woertlich erhalten: Bei consentError treten Aussage 2 und 3 ZURUECK und der FinanceErrorState nimmt ihren Platz ein, Aussage 1 bleibt stehen — ein Datenschutz-Bildschirm darf einen ungelesenen Zustand nicht raten (dafuer gibt es PrivacyPage.error-state.test.tsx).

### Begründung

Drei Routen, drei verschiedene Befunde, aber eine gemeinsame Ursache: Alle drei liefern dem Telefon die kompakte Fassung. Keine hat presentation/mobile/, keine ruft useDisplayDensity, keine laedt je Dichte. Der Umbau folgt deshalb dreimal derselben Bauform wie CoachFokussiert — dieselbe Datenschicht, eine zweite Praesentation, lazy je Dichte im duennen Routeneinstieg.

/fragen ist der Fall, an dem es sich entscheidet, und der Tastaturbefund ist kein Detail, sondern der Grund fuer den Entwurf. Heute steht das Feld oben und die Antwort darunter: Wer tippt, sieht mit offener Tastatur genau das nicht, wonach er gefragt hat. Gemessen: index.html setzt kein interactive-widget, es gilt also resizes-visual — der Layout-Viewport schrumpft nicht, 100dvh und sticky bottom-0 folgen der Tastatur nicht, die fixe BottomNav bleibt am unteren Rand des Layout-Viewports hinter der Tastatur stehen, und main haelt darunter weiterhin 5rem Platz fuer sie frei. Von einem 411-px-Telefon bleiben mit Kopfleiste und Tastatur rund 300 px sichtbar. Die Umkehrung — Feld unten, Antwort darueber — ist deshalb keine Geschmacksfrage: Sie ist die einzige Anordnung, bei der die Antwort im sichtbaren Streifen liegt, und sie kostet nichts, weil das Feld schon vorher der Fixpunkt war. Der eine Zeilenzusatz in index.html (interactive-widget=resizes-content) macht daraus zusaetzlich die richtige Reflow-Geometrie fuer BottomNav und Sheet; ohne ihn traegt der Entwurf trotzdem, nur ohne mitwandernde Bodennavigation.

Drei Aussagen, weil die Flaeche drei Fragen beantwortet und nicht mehr: wie viel (Zahl), wovon und wann (Satz mit Zeitraum und Buchungszahl), und wie ich das verstanden habe (Deutung). Der dritte Punkt ist kein Beiwerk, sondern Prinzip 4 — sichtbare Erklaerung ist der erklaerte Differenzierer dieser App, und die Herkunfts-Marke muss ausdruecklich auch dann dastehen, wenn das Modell NICHT beteiligt war (Abwesenheit ist keine Aussage). Alles Uebrige — Begruendungszeilen, Posten, Vergleichspaar, Korrektur-Chips, Rueckfrage- und Kandidatenlisten — ist Aufschluesselung und gehoert nach Regel 3 in den Detailschritt. Der Semantik-Opt-in-Kasten kommt vom Hauptbildschirm herunter, weil er Konfiguration ist und weil er heute ausserdem eine verbotene Box ist (rounded-md border). Die Ladefortschritts-Zeile bleibt oben, weil ein still nachladender Zustand sonst wie ein endgueltiges Nein aussieht.

/tutorials ist die benannte Listen-Ausnahme und braucht deshalb gar keinen Detailschritt — das ist die sauberste Antwort und wird ausdruecklich so vorgeschlagen. Zu aendern sind zwei andere Dinge: Der Fortschritt steht heute viermal auf demselben Bildschirm (Bruch, Prozentzahl, Balken, Abschnittsbrueche) in einem Farbverlaufs-Kasten; daraus wird eine Zeile plus eine duenne Fuellung. Und 26 InteractiveCard untereinander sind keine 26 Aktionen, sondern eine Liste mit 25-fachem Rand — genau das, was ADR Regel 10 Satz 2 verbietet. Die Ratsche merkt es nicht, weil InteractiveCard ausdruecklich nicht mitzaehlt; deshalb steht es hier.

/privacy ist der teuerste Fall, weil dort gar keine Slice existiert: Die Seite ist zugleich Route, Datenschicht und Darstellung, mit vier toten Karten, zwei vollstaendigen Aufzaehlungen, vier Modellabsaetzen und einer eingebetteten Analytics-Vorschau. Sie ist eine Auswertungsflaeche, keine Liste — ein Bildschirm gilt also. Der Entwurf komprimiert die vier Karten auf drei Zeilen, die alle aus derselben derivePrivacyStatus-Rechnung stammen wie heute; zwei Wege zu derselben Aussage entstehen nicht, weil der Kopfzeilen-Indikator dieselbe Funktion liest. Der einzige inhaltliche Punkt, an dem nicht gespart werden darf, ist der Fehlerfall: Bei ungelesener Einwilligung treten die beiden abhaengigen Zeilen zurueck statt zu raten — das ist eine bestehende Regression, und der Entwurf uebernimmt sie woertlich.

Jede Zahl in diesem Entwurf stammt aus einer heute existierenden Abfrage: /fragen aus useMoneyQuestions(), /tutorials aus useTutorialCatalog() (Query-Schluessel userSettings und dataReadiness, geteilt mit useTutorialRun), /privacy aus derivePrivacyStatus plus dem bestehenden analyticsConsent-Query und useLocalEncryption(). Es wird keine neue Abfrage vorgeschlagen. Der einzige Zugewinn ist ein Ortswechsel: Die drei view-data-Einheiten aus PrivacyPage und die zwei aus AnalyticsTransparencyPreview gehoeren in ein neues features/privacy/application/use-privacy-overview.ts, was die Ratsche von 204 auf 199 senkt — und das ist Bedingung, nicht Kuer, denn die ADR verlangt, dass jede migrierte Flaeche die Zahlen senkt.

### Benötigte Texte (für S2)

| Schlüssel | de | en |
|---|---|---|
| `financeQuestions.fokussiert.prompt` | Was willst du über dein Geld wissen? | What do you want to know about your money? |
| `financeQuestions.fokussiert.examplesLabel` | Zum Beispiel | For example |
| `financeQuestions.fokussiert.understoodLine` | Verstanden als: {label} | Understood as: {label} |
| `financeQuestions.fokussiert.detailTitle` | Wie ich das gerechnet habe | How I worked this out |
| `financeQuestions.fokussiert.detailAction` | Rechenweg und Korrektur | Calculation and corrections |
| `financeQuestions.fokussiert.settingsTitle` | Fragen verstehen | Understanding questions |
| `financeQuestions.fokussiert.settingsAction` | Einstellungen zum Verstehen | Question understanding settings |
| `tutorials.fokussiert.progressLine` | {done} von {total} Kapiteln | {done} of {total} chapters |
| `tutorials.fokussiert.nextChapter` | Weiter mit {titel} | Continue with {titel} |
| `privacy.fokussiert.headline` | Deine Finanzdaten liegen auf diesem Gerät. | Your financial data stays on this device. |
| `privacy.fokussiert.encryptionLocked` | Verschlüsselt, gesperrt | Encrypted, locked |
| `privacy.fokussiert.neverLeavesLine` | {items} bleiben hier. | {items} stay here. |
| `privacy.fokussiert.detailTitle` | Was genau wohin geht | Exactly what goes where |
| `privacy.fokussiert.detailAction` | Alle Einzelheiten | All the details |

### Gemeinsame Dateien (entscheiden über Parallelisierbarkeit)
- `index.html — Zeile 6, viewport-Meta um interactive-widget=resizes-content ergaenzen, damit der Layout-Viewport bei offener Tastatur schrumpft und 100dvh / sticky bottom-0 / die fixe BottomNav mitwandern. HOECHSTES Konfliktrisiko der ganzen Liste: die Zeile wirkt auf JEDE Flaeche der App und gehoert zentral entschieden, nicht von dieser Flaeche aus.`
- `android/app/src/main/AndroidManifest.xml — MainActivity traegt heute KEIN android:windowSoftInputMode. Fuer den Capacitor-Fall (App ist per ADR Regel 4 immer fokussiert) ist adjustResize zu setzen bzw. am Geraet nachzumessen. Wird zusammen mit index.html entschieden.`
- `src/components/ui/input.tsx — h-10 (40 px) ist unter den 44 px aus AGENTS.md Paragraf 4, und das Feld ist das Hauptbedienelement von /fragen. Fix ist dieselbe EINE Entscheidung wie in ui/button.tsx: fokussiert:min-h-11 neben die optische Hoehe. check:touch-targets sieht Inputs nicht, die Ratsche wird also nicht rot — deshalb muss es hier stehen.`
- `src/i18n/translations/de.ts — neue Keys unter financeQuestions.fokussiert.*, tutorials.* und privacy.fokussiert.*. Sehr hohes Konfliktrisiko: jeder parallele Agent editiert diese Datei. Nach jeder Aenderung sofort pnpm exec tsc --noEmit (doppelter Namespace ist sonst unsichtbar).`
- `src/i18n/translations/en.ts — dieselben Keys, Paritaetspflicht ueber locale-parity.test.ts.`
- `src/i18n/translations/ru.ts — dieselben Keys, Paritaetspflicht.`
- `src/i18n/translations/tlh.ts — INACTIVE_LOCALES, nicht paritaetspflichtig; nur der Vollstaendigkeit halber genannt.`
- `src/i18n/overlays/everyday/de.ts — Alltagssprache fuer die neuen Saetze, insbesondere privacy.fokussiert.headline und financeQuestions.fokussiert.prompt. Erzwungen durch overlay-coverage.test.ts (Existenz UND Mindestumfang).`
- `src/i18n/overlays/everyday/en.ts — dito.`
- `src/i18n/overlays/everyday/ru.ts — dito.`
- `card-rule-budget.json — max MUSS von 149 auf 145 sinken (die vier <Card> in PrivacyPage.tsx entfallen). maxFokussiert bleibt 2: die neuen presentation/mobile/-Dateien duerfen NULL Boxen beitragen, also keine rounded-* mit border/shadow/bg-card um Inhalt, nur border-t als Haarlinie. Hohes Konfliktrisiko — jeder Agent, der Karten entfernt, aendert dieselbe Zahl.`
- `view-data-budget.json — max MUSS von 204 auf 199 sinken, wenn /privacy eine Slice bekommt (PrivacyPage 3 Einheiten + AnalyticsTransparencyPreview 2, gemessen mit scripts/view-data-core.mjs). Hohes Konfliktrisiko, dieselbe Zahl fuer alle Migrationen.`
- `slice-presentation-budget.json — max steht auf 11 und darf NICHT steigen. Konkrete Gefahr: eine neue features/privacy/presentation/ die AnalyticsTransparencyPreview aus src/components/privacy/ importiert, treibt sie auf 12. Der Import muss durch den Mitumzug der Komponente aufgeloest werden, nicht durch eine Ausnahme. maxBausteine steht auf 0 und ist ein Rueckfall-Waechter — kein neuer Baustein unter src/components/common/.`
- `src/components/privacy/AnalyticsTransparencyPreview.tsx — muss nach features/privacy/presentation/ mitziehen (siehe slice-presentation-budget.json). Traegt selbst 1 useQuery + 1 Service-Import und gehoert damit in dieselbe application/-Schicht.`
- `bundle-size-budget.json — ADR Regel 6 verlangt lazy je Dichte. Drei Flaechen ergeben neue Chunks in dist/assets; check:bundle-size prueft Einzelbudgets ab 20 kB UND eine Gesamtgrenze ueber alle Buendel. Setzt pnpm build voraus.`
- `touch-target-budget.json — beide Spalten stehen auf 0 und sind reine Rueckfall-Waechter. Kein neues Bedienelement unter 44 px; Aenderung nur noetig, falls doch eines noetig waere (dann ist der Entwurf falsch).`
- `e2e-tests/fixtures/routes.ts — enthaelt /fragen (18), /tutorials (37), /privacy (39). Die ADR verlangt, dass die Routenliste in BEIDEN Dichten laeuft; dazu der Nachweis 'ein Bildschirm ohne Scrollen' fuer /fragen und /privacy (nicht fuer die Kapitelliste auf /tutorials, das ist die Listen-Ausnahme).`
- `playwright.config.ts — Projekte je Dichte, wenn die Routenliste in beiden Dichten laufen soll. Gemeinsam mit der Fixture zu entscheiden.`
- `state-coverage-allowlist.json — /privacy und /tutorials stehen dort mit entfaellt.leer und einer Begruendung, die auf die HEUTIGE Struktur zeigt ('eine Erklaerseite mit Schaltern', 'der Katalog steht fest im Code'). Beide Begruendungen tragen auch nach dem Umbau, ein Edit sollte nicht noetig sein — vor dem Commit trotzdem gegenlesen. /fragen steht NICHT in der Liste und braucht damit weiterhin Tests mit [ZUSTAND /fragen:leer] und [ZUSTAND /fragen:fehler], jetzt in beiden Dichten.`
- `src/pages/... duenne Einstiege: MoneyQuestionsPage.tsx, TutorialsPage.tsx und PrivacyPage.tsx liegen in MEINER Flaeche und werden dort umgebaut (useDisplayDensity + lazy je Dichte, PageHeader nur noch in der kompakten Fassung). Hier nur zur Abgrenzung genannt, damit klar ist, dass src/App.tsx NICHT angefasst werden muss.`
- `src/App.tsx — nur zu PRUEFEN, nicht zwingend zu aendern: /privacy ist zweimal geroutet (Zeile 156 ohne AppShell fuer den anonymen Modus, Zeile 237 innerhalb). Die fokussierte Fassung und ihr Sheet muessen in beiden Einhaengungen tragen; wenn ja, bleibt die Datei unberuehrt.`
- `src/lib/tutorial-catalog.ts — nur falls das 'naechste startbare Kapitel ueber alle Abschnitte' als reine Funktion neben nextChapterOfSection gehoert. Bevorzugte Loesung ist die Berechnung im ViewModel use-tutorial-catalog.ts (meine Flaeche), dann bleibt die Datei unberuehrt.`
- `src/components/layout/BottomNav.tsx und AppShell.tsx — nur LESEN, kein Edit geplant. Der reservierte Streifen pb-[calc(5rem+env(safe-area-inset-bottom))] in AppShell.tsx:185 und die feste Bodenleiste (BottomNav.tsx:26) sind der Grund, warum die Tastaturfrage ueberhaupt entsteht; geloest wird sie in index.html, nicht hier.`

### Offene Fragen
- index.html interactive-widget=resizes-content ist eine EINZEILIGE Aenderung mit app-weiter Wirkung: Sie aendert das Verhalten jeder Flaeche mit Eingabefeld, jedes Sheets und der Bodennavigation bei offener Tastatur. Sie gehoert zentral entschieden, nicht von dieser Flaeche aus. Ohne sie traegt der Entwurf trotzdem (Feld unten, Antwort darueber), nur ohne mitwandernde Bodennavigation.
- AndroidManifest.xml setzt kein windowSoftInputMode. Ob Capacitor 8 mit viewport-fit=cover auf Android 15 (erzwungenes Edge-to-Edge) den Webview bei Tastatur resized oder ueberdeckt, ist NICHT nachgemessen — dieselbe Sorte offener Punkt wie der Ersatz-Viewport von ~980 px in der ADR. Vor dem Umbau an einem echten Geraet pruefen: window.innerHeight und visualViewport.height mit offener Tastatur.
- ui/input.tsx ist h-10 (40 px). Der Fix (fokussiert:min-h-11) ist EINE Entscheidung fuer die ganze App und liegt ausserhalb dieser Flaeche. Alternative waere eine Klasse an der einen Aufrufstelle — dann bleibt jedes andere Eingabefeld der App unter 44 px, und die Frage kommt beim naechsten Formular zurueck.
- Bekommt /privacy eine eigene Slice (features/privacy mit application/use-privacy-overview.ts)? Dafuer: view-data sinkt um 5 und die ADR verlangt, dass jede migrierte Flaeche die Zahlen senkt. Dagegen: der Umzug zieht AnalyticsTransparencyPreview mit und ist damit teurer als die zwei anderen Routen zusammen. Ohne Slice waere die fokussierte Fassung eine zweite Praesentation ohne gemeinsames ViewModel — genau das, was ADR Regel 1 verbietet. Empfehlung: Slice bauen; Bestaetigung erbeten, weil es den Aufwand von M auf L hebt.
- /privacy ist in App.tsx zweimal geroutet (156 ohne AppShell, 237 innerhalb). Welche der beiden Einhaengungen ein Telefonnutzer im anonymen Modus tatsaechlich trifft, ist nicht gemessen; das Bottom-Sheet des Detailschritts muss in beiden funktionieren.
- Vorschlag: /tutorials bekommt KEINEN Detailschritt, weil die Kapitelliste die benannte Listen-Ausnahme ist. Bestaetigung erbeten — es ist die einzige der drei Routen, bei der 'nichts amputieren' ohne zweiten Schritt erfuellt ist.
- Der Nachweis 'ein Bildschirm ohne Scrollen' gehoert laut ADR in die Playwright-Suite (jsdom hat keine Hoehe). Das beruehrt playwright.config.ts und e2e-tests/fixtures/routes.ts — beide ausserhalb dieser Flaeche. Wer legt die Dichte-Projekte an: diese Flaeche oder ein eigener Schritt fuer alle Migrationen?
- check:card-rule hat bei /privacy nachweislich geschwiegen, obwohl vier tote Karten dastehen (ein <Link> in der Datei genuegt ihm). Und die 26 InteractiveCard auf /tutorials sind per Definition ausgenommen, obwohl Regel 10 Satz 2 sie verbietet. Beide Luecken sind in der ADR benannt, aber unbehoben — soll diese Flaeche den Waechter nachschaerfen oder nur ihre eigenen Faelle beheben? Empfehlung: nur beheben, den Waechter getrennt, sonst wird jede Migration von einer Waechteraenderung blockiert.

---

## Finanzstadt /city (src/pages/CityPage.tsx + src/features/finance-city/**) — WebGL-Vollbild mit eigener Navigation, eigener Zurueck-Behandlung und eigener Hoehenrechnung
**Routen:** `/city`, `/city?lage=offen (Detailschritt: Legende, voller Pfad, Monatswahl, Teilzahlen)`, `/city?ansicht=liste (die nicht-visuelle Alternative, heute nur lokaler useState ohne Adresse)`
**Ist-Zustand:** Slice ja · 6 Kartenrahmen · 0 Abfragen in der Darstellung

### Befunde
- REGEL 9 GREIFT — aber nur zwei ihrer drei Masse. 'Ein Bildschirm ohne Scrollen' ist hier bereits der strengste Fall der App, nicht der Verstoss: CityPage.tsx:57 spannt h-[calc(100dvh-3.5rem-3rem-5rem-env(safe-area-inset-bottom))] mit overflow-hidden auf, der Canvas traegt touch-action:none. Die Flaeche ist die Referenz fuer das Mass, keine Ausnahme davon. Wer der Stadt eine Pauschal-Ausnahme von Regel 9 gibt, nimmt sie ausgerechnet dem Mass weg, das sie als einzige Flaeche vollstaendig erfuellt.
- HOECHSTENS DREI AUSSAGEN — hier liegt der eigentliche Befund. Gleichzeitig auf dem Telefon: (1) die Stadt selbst, (2) bis zu 6 HTML-Label mit Name + Betrag (CityStage.tsx:44 MAX_VISIBLE_LABELS_MOBILE), (3) der Kontext-Chip, der in der Uebersicht-Welt DREI Zahlen auf einmal traegt (CityContextChip.tsx: Einnahmen X + Ausgaben Y + Sparrate Z), (4) die Monatsleiste mit Label und Prognose-Abzeichen, (5) der Tipp-Hinweis, (6) der Signature-Moment-Text. Dazu als Rahmen: Breadcrumb, 2 Icon-Knoepfe, h1, 4er-Registerleiste, 3er-Steuerleiste, Bodennavigation. Gezaehlt nach Regel 9 sind das 5-8 Aussagen, nicht 3.
- ZWEI WEGE ZU DERSELBEN NAVIGATION, gleichzeitig auf dem Bildschirm: CityBreadcrumb (goTo, oben links, CityChrome.tsx:63) und CityControlsBar (zoomOutStep/reset, unten rechts, CityStage.tsx:141). Bei maximal drei Ebenen deckt Chevron-zurueck + Zuruecksetzen jedes Breadcrumb-Ziel ab — der Breadcrumb ist auf dem Telefon Doppelbestand, kein zweites Feature.
- ZWEI WEGE ZUR AKTUELLEN EBENE ALS TEXT: Der letzte Breadcrumb-Eintrag (nav.breadcrumb) und context.label im Chip (domain/city-context.ts) benennen dieselbe Ebene, oben links und unten links, aus demselben Modell. Das ist keine Zahl im Sinne von ADR Regel 1, aber dieselbe Bauform.
- ECHTE BOX NACH REGEL 9: CityPage.tsx:70 rahmt die Buehne mit 'rounded-lg border border-border bg-muted/30'. Das ist ein Rahmen um Inhalt IM Textfluss der Seite — genau der Fall, den Regel 9 meint. Auf dem Telefon liegt daneben nichts, was er trennen koennte.
- ZWEITE ECHTE BOX: CityContractSheet.tsx:57 'rounded-lg bg-muted/50 p-3' als Readout im Detail-Sheet. Ein Sheet ist Teil der fokussierten Praesentation; Regel 9 endet nicht am Sheet-Rand.
- VIER PLAETTCHEN AUF DEM CANVAS, die KEINE Boxen im Sinne von Regel 9 sind (Begruendung unten): CityLabels.tsx:477 (rounded bg-background/80 shadow-sm), CityContextChip (rounded bg-background/80), CityControlsBar CONTROL_CLASS (rounded-md bg-background/80 shadow-sm — Bedienelemente, ohnehin ausgenommen), CityMoments.tsx:41/75 (rounded-full shadow-sm / rounded-2xl shadow-lg).
- check:card-rule ist von dieser Flaeche heute NICHT betroffen: 0 Treffer auf <Card oder bg-card im ganzen Slice plus Seite. Die Ratsche 'max' (149) bleibt unberuehrt, 'maxFokussiert' (2) zaehlt nur unter features/*/presentation/mobile/ — das Verzeichnis existiert hier nicht.
- check:view-data ist ebenfalls unberuehrt: 0 useQuery/useMutation und 0 Service-Importe unter src/pages/CityPage.tsx und features/finance-city/presentation/. Alle vier Abfragen liegen korrekt in application/use-city-model.ts. Die Datenschicht ist bereits EINE (ADR Regel 1 erfuellt) — hier ist nichts zu migrieren, nur zu verzweigen.
- FALSCHE SCHWELLE ENTSCHEIDET UEBER INHALTSMENGE: CityStage.tsx:71/167 waehlt ueber useIsWideDesktop (1024 px) zwischen 6 und 10 sichtbaren Labeln und schaltet 'declutter'. Das ist eine Layout-Schwelle, die ueber die ZAHL DER AUSSAGEN entscheidet — ADR Regel 4 verbietet genau das ('duerfen nie ueber die Dichte entscheiden'). Gehoert an useDisplayDensity (768).
- ZWEITES KRITERIUM AN DEN TIPPZIELEN: CityControlsBar CONTROL_CLASS benutzt 'h-11 w-11 ... md:h-9 md:w-9', also einen Breakpoint, wo touch-target-budget.json seit der Mobil-Ueberarbeitung 'fokussiert:min-h-11' als die eine Bauform festhaelt. Kein Verstoss (44 px sind erreicht), aber ein zweites Kriterium fuer dieselbe Frage.
- DREI ZUSTAENDE OHNE ADRESSE: showList und legendOpen sind lokales useState in CityPage.tsx:47/51, tab und nav-Ebene lokal in use-city-page-model.ts. /city kann heute weder auf die Listenansicht noch auf eine Welt oder einen Distrikt tief verlinkt werden. Fuer die Listenansicht ist das mehr als eine Unbequemlichkeit: Sie ist laut README das Akzeptanzkriterium 'eine vollstaendig nicht-visuelle Alternative' — und genau die hat keine Adresse (ADR Regel 5).
- SHARED-ELEMENT-KOPPLUNG NACH AUSSEN: CityChrome.tsx:58 traegt layoutId='dashboard-city-link', Gegenstueck ist src/components/dashboard/Dashboard.tsx:159. Wer den Breadcrumb-Block in der fokussierten Fassung entfernt, bricht den Uebergang von der Uebersicht — Regel 5 in der Framer-Motion-Variante.
- TUTORIAL-ANKER: src/lib/tutorial-steps.ts:185-187 zeigen dreimal auf 'city-canvas' (CityStage.tsx:93), CityLegend.tsx:53 haelt 'city-legend' fuer eine spaetere Fuehrung bereit. Beide Anker muessen in BEIDEN Dichten existieren (ADR Regel 5).

### Entwurf — die Aussagen

**1. Die Stadt selbst — randlos, ohne Rahmen**

Der Canvas fuellt die Flaeche unter der Kopfzeile vollstaendig. Der Rahmen faellt weg (heute 'rounded-lg border border-border bg-muted/30', CityPage.tsx:70): Die Szene malt ihren eigenen Boden, ein Rahmen darum trennt auf dem Telefon nichts, weil daneben nichts liegt. Die Stadt IST die eine Aussage — dieselbe Rolle, die Regel 9 einer Liste zubilligt; ihre eigenen Label gehoeren zu ihr und zaehlen nicht einzeln. Label-Kappung wandert von useIsWideDesktop (1024) auf useDisplayDensity (768) und bleibt bei 6.

*Datenquelle:* src/features/finance-city/application/use-city-page-model.ts -> geometry (use-city-geometry.ts: layout, labels, flowLines), gespeist aus use-city-model.ts mit den Query-Keys financeKeys.transactionsAll, financeKeys.categories, useAllocationMap, ['milestones', locale], ['forecast-input'] — durchweg DIESELBEN Keys wie Dashboard, Coach und Simulation, geteilter Cache, kein zweiter Weg.

*Aktion:* Tippen auf ein Viertel/Gebaeude taucht eine Ebene tiefer (world.handleTapBox); ein Vertrags-Tap oeffnet CityContractSheet.

**2. Wie gross das ist, was ich gerade sehe — eine Zeile, eine Zahl**

Ueber der Stadt, gross und tabular: der Betrag der aktuellen Ebene mit seiner Beschriftung. Ausgaben-Welt Stadtebene: 'Gesamtausgaben' + Betrag. Distrikt/Etage: Label + Betrag. Uebersicht-Welt: NUR die Schlussfolgerung ('Sparrate 420 EUR' bzw. 'Defizit'), nicht die drei Zahlen, die der Chip heute nebeneinander legt. Ziele-Welt: '3 von 7 Zielen erreicht'. Ersetzt Kontext-Chip UND letzten Breadcrumb-Eintrag — heute zwei Stellen fuer dieselbe Feststellung. Gebaeude-/Vertragszaehler und Anteils-Prozent gehen in den Detailschritt.

*Datenquelle:* geometry.context aus src/features/finance-city/domain/city-context.ts (CityContextSummary.label/.amount/.share/.buildingCount/.contractCount) · overview.balance aus domain/city-overview-adapter.ts#buildCityOverviewModel · goalsSummary aus application/use-city-page-model.ts (zaehlt model.districts.filter(d => d.achieved)) · Formatierung ueber city.formatCityAmount / valueFormat, unveraendert. Alles bereits vorhanden, heute gerendert in CityContextChip.tsx.

*Aktion:* Kein Klickziel — reines Readout, kein Karten-Chrome (Prinzip 8 verspricht dann nichts).

**3. Welcher Zeitausschnitt (nur in der Ausgaben-Welt)**

Eine Zeile unter der Zahl: 'September 2026' bzw. 'Oktober 2026 · Prognose'. Statt der Chevron-Stepper-Leiste ein Textknopf, der im Detailschritt die Monatsliste oeffnet — ein Stepper, der 14 Monate weit tippen laesst, ist auf dem Daumen die falsche Interaktion. In Einnahmen-/Ziele-/Uebersicht-Welt entfaellt diese Zeile ganz (timeline ist dort leer), die Flaeche hat dann nur zwei Aussagen.

*Datenquelle:* application/use-city-timeline-cursor.ts -> cursor.label, cursor.isForecast, cursor.step/select; timeline (CityMonth[]) aus application/use-city-model.ts (buildCityTimeline). Heute gerendert in CityTimelineBar.tsx.

*Aktion:* Oeffnet ?lage=offen mit der Monatsliste.

### Detailschritt
- Adresse: /city?lage=offen — Sheet von unten, Scrollen dort ausdruecklich erlaubt (Regel 9 richtet sich an den Bildschirm beim Oeffnen). Zweite Adresse: /city?ansicht=liste fuer die nicht-visuelle Alternative, die heute nur lokaler useState ist. Beide unter DERSELBEN Route (ADR Regel 5).
- Listenansicht (CityAccessibleList, model + nav) — als ERSTER fokussierbarer Eintrag des Sheets, damit die a11y-Alternative nicht tiefer liegt als heute; zusaetzlich per ?ansicht=liste direkt anspringbar. Die Komponente ist bereits rahmenfrei und Regel-9-konform.
- Legende 'Was bedeutet was?' (CityLegend, model + nav.level + hasFlowLines) — heute ein eigener Icon-Knopf im Chrome. Der Anker data-tour-id='city-legend' bleibt auf dem SheetContent, damit tutorial-steps.ts unveraendert traegt.
- Voller Pfad Stadt > Distrikt > Etage mit Direktsprung (CityBreadcrumb, nav.breadcrumb, nav.actions.goTo). Auf dem Hauptbildschirm bleibt davon nur der Chevron-zurueck der Steuerleiste (nav.actions.zoomOutStep) plus Zuruecksetzen (nav.actions.reset) — die decken bei drei Ebenen jedes Breadcrumb-Ziel ab. Nichts amputiert, nur eine Ebene tiefer.
- Monatswahl als Liste statt Stepper (timeline: CityMonth[], cursor.select) inkl. Prognose-Kennzeichnung.
- Die Teilzahlen der Uebersicht-Welt, die heute den Chip dreifach belegen: Einnahmen gesamt und Ausgaben gesamt (overview.incomeTotal / overview.expensesTotal aus domain/city-overview-adapter.ts).
- Die Zaehler der Fokus-Ebene: '{count} Gebaeude' / '{count} Vertraege' / '{count} Monate' und '{percent} der Gesamtausgaben' (context.buildingCount, context.contractCount, context.share) — heute in derselben Chip-Zeile wie der Betrag.
- NICHT im Detailschritt: die Welt-Wahl (Uebersicht/Einnahmen/Ausgaben/Ziele) bleibt als Registerleiste auf dem Hauptbildschirm — Regel 9 zaehlt eine Registerleiste ausdruecklich zum Rahmen, und ein Welt-Wechsel hinter zwei Tipps waere die haeufigste Interaktion der Flaeche. Ebenso bleiben Steuerleiste (zurueck/zuruecksetzen/Vollbild) und Bodennavigation Rahmen.

### Begründung

REGEL 9 GREIFT — eine Pauschal-Ausnahme fuer die Stadt waere falsch, aber die ADR braucht drei praezisierende Saetze, ohne die die Regel hier nicht anwendbar ist.

(1) 'Ein Bildschirm' braucht KEINE Ausnahme. Die Stadt ist der strengste erfuellte Fall der App: dvh-Rechnung mit overflow-hidden, touch-action:none, kein Seiten-Scroll moeglich. Wer ihr hier eine Ausnahme schreibt, nimmt sie ausgerechnet dem Mass weg, das sie als einzige Flaeche vollstaendig einloest.

(2) 'Hoechstens drei Aussagen' greift voll und ist der eigentliche Befund (heute 5-8). Die ADR braucht dafuer aber den Satz, den sie fuer Listen schon hat, in der Visualisierungs-Fassung — sonst waeren die 6 Stadt-Label sechs Aussagen und die Regel fuer jedes Diagramm der App unbrauchbar:

  >> ERGAENZUNG ZU REGEL 9, neben 'Listen sind die benannte Ausnahme':
  >> **Eine Visualisierung ist selbst die eine Aussage.** Wie bei der Liste zaehlt nicht, was IN ihr steht, sondern was UEBER und NEBEN ihr steht. Achsen, Legenden und die Beschriftungen an den dargestellten Objekten gehoeren zur Visualisierung; sie einzeln zu zaehlen hiesse, jedes Diagramm zum Verstoss zu erklaeren. Eine zweite Zahl neben der Visualisierung zaehlt dagegen voll — und drei davon (wie heute der Uebersichts-Chip der Stadt: Einnahmen, Ausgaben, Sparrate) sind bereits das ganze Budget.

(3) 'Keine Boxen' braucht die einzige echte, eng gefasste Ausnahme — und ihre Begruendung steht schon in der ADR selbst, nur mit umgekehrtem Vorzeichen. Die ADR sagt: 'Auf einem Telefon liegt nichts nebeneinander — dort trennt bereits die Reihenfolge.' Auf einer gerenderten Flaeche gilt exakt das Gegenteil: Dort liegt ALLES uebereinander, und die Reihenfolge trennt gar nichts.

  >> ERGAENZUNG ZU REGEL 9:
  >> **Ein Plaettchen AUF einer gerenderten Flaeche ist keine Box.** Text ueber einem WebGL-Canvas, einer Karte oder einem Diagramm liegt auf Farben, die das Design-System nicht kontrolliert; sein Hintergrund ist ein LESBARKEITS-Mittel, kein Ordnungsmittel, und faellt nicht unter Regel 9. Drei Bedingungen, alle noetig: (a) er liegt UEBER der gerenderten Flaeche, nicht im Textfluss der Seite; (b) er traegt Hintergrund und Rundung, aber keinen Rahmen und keinen Schlagschatten ueber das hinaus, was ihn von der Szene abloest; (c) Prinzip 8 gilt weiter — ein Plaettchen ohne Aktion darf nicht wie ein Knopf aussehen.
  >> **Was ausdruecklich NICHT darunter faellt: der Rahmen UM die gerenderte Flaeche.** Der liegt im Textfluss der Seite und ist genau die Box, die Regel 9 meint. Genau dieser Rahmen steht heute in CityPage.tsx:70.

Damit ist der Befund an dieser Flaeche entschieden statt ausgenommen: zwei echte Boxen fallen (Buehnen-Rahmen, Readout im Vertrags-Sheet), vier Canvas-Plaettchen bleiben mit benannter Begruendung, und die Aussagenzahl faellt von 5-8 auf 3.

GEGENPROBE ZU ADR REGEL 1 (zwei Wege zu einer Zahl): Die Flaeche fuehrt keine eigene Abfrage ein. Jede Zahl des Entwurfs kommt aus geometry.context, overview oder goalsSummary — alle drei entstehen im bestehenden ViewModel aus denselben Query-Keys wie Dashboard und Coach. Der Entwurf LOEST sogar zwei Doppelungen auf, die heute gleichzeitig auf dem Bildschirm stehen (Breadcrumb vs. Chip-Label; Breadcrumb-Sprung vs. Steuerleisten-zurueck).

BAUFORM: features/finance-city/presentation/{mobile/CityFokussiert.tsx, desktop/CityKompakt.tsx}, beide lazy aus CityPage.tsx nach useDisplayDensity (ADR Regel 6, exakt wie CoachPage.tsx). Der gesamte three.js-Stapel (CityStage, CityCanvas, CityLabels, city-scene*) bleibt UNGETEILT in presentation/ und wird von beiden benutzt — verzweigt wird nur das Chrome. Nebeneffekt: die Plaettchen liegen damit in shared-Dateien und beruehren card-rule 'maxFokussiert' nicht; die neue mobile/-Datei selbst muss box-frei bleiben (kein rounded-lg/xl/2xl/full zusammen mit border/shadow/bg-card), sonst steigt eine Ratsche, die nur sinken darf.

### Benötigte Texte (für S2)

| Schlüssel | de | en |
|---|---|---|
| `city.focusedDetailTitle` | Alles zur Stadt | Everything about the city |
| `city.focusedMore` | Mehr | More |
| `city.focusedPathHeading` | Wo du gerade bist | Where you are |
| `city.focusedMonthHeading` | Monat waehlen | Choose month |
| `city.focusedOverviewHeading` | Einnahmen und Ausgaben | Income and expenses |
| `city.focusedDetailsHeading` | Was in dieser Ebene steckt | What is in this level |

### Gemeinsame Dateien (entscheiden über Parallelisierbarkeit)
- `docs/architecture/darstellungsdichte.md — MUSS geaendert werden: die drei Ergaenzungen zu Regel 9 (Visualisierung ist eine Aussage · Plaettchen auf gerenderter Flaeche ist keine Box · Stadt braucht KEINE Ausnahme von 'ein Bildschirm'). Diese Datei ist die Regelquelle ALLER parallel laufenden Flaechen — sie serialisiert alles. Zuerst und allein aendern, dann die Flaechen parallel starten.`
- `src/i18n/translations/de.ts — Block city.* (heute Zeile ~743-826) um die Schluessel des Detailschritts erweitern.`
- `src/i18n/translations/en.ts — dieselben Schluessel (locale-parity.test.ts vergleicht alle SUPPORTED_LOCALES blattweise gegen de).`
- `src/i18n/translations/ru.ts — dieselben Schluessel, sonst faellt src/i18n/__tests__/locale-parity.test.ts.`
- `src/i18n/translations/tlh.ts — dieselben Schluessel, sonst faellt locale-parity.test.ts.`
- `bundle-size-budget.json — der Chunk-Eintrag 'CityPage' (178176) aendert sich, und die Dichte-Aufteilung erzeugt mindestens einen weiteren Chunk. Zusaetzlich 'totalGzipBytes' (2695168) — DAS ist die eine Zeile, die JEDE parallel laufende Flaeche anfasst; sie braucht einen einzelnen Besitzer oder eine Nachlaufrunde.`
- `src/lib/__tests__/bundle-size.test.ts — Zeile 34 erwartet den Chunknamen 'CityPage-sUZgBeGW.js' -> 'CityPage', Zeile 104 erwartet den Budget-Schluessel 'CityPage'. Beides bricht, wenn der Chunk umbenannt oder aufgeteilt wird.`
- `src/pages/CityPage.tsx — bleibt duenner Routen-Einstieg (§3), bekommt die Dichte-Verzweigung mit lazy je Fassung. Liegt formal ausserhalb von features/finance-city, gehoert aber zu meiner Flaeche und wird von niemand anderem angefasst.`
- `src/components/dashboard/Dashboard.tsx — NUR LESEND zu pruefen, moeglicherweise anzufassen: Zeile 159 haelt layoutId='dashboard-city-link', Gegenstueck CityChrome.tsx:58. Wenn die fokussierte Fassung den Breadcrumb-Block nicht mehr rendert, braucht der Shared-Element-Uebergang ein neues Gegenstueck (z. B. die Kontext-Zeile) oder er faellt still aus.`
- `src/lib/tutorial-steps.ts — NUR ZU PRUEFEN, im Regelfall keine Aenderung: Zeilen 184-191 verankern drei city-Schritte auf 'city-canvas' (CityStage.tsx:93) und halten 'city-legend' (CityLegend.tsx:53) bereit. Beide Anker muessen in BEIDEN Dichten existieren (ADR Regel 5); der Entwurf laesst sie bewusst an ihren heutigen Traegern.`
- `src/lib/__tests__/tutorial-steps.test.ts — prueft die Anker-Liste; faellt, sobald ein city-Anker verschwindet.`
- `e2e-tests/fixtures/routes.ts — '/city' (Zeile 29). Muss laut ADR 'Folgen fuer die Waechter' kuenftig in BEIDEN Dichten laufen; die neuen Adressen ?lage=offen und ?ansicht=liste gehoeren aufgenommen. Diese Datei fassen alle Flaechen an.`
- `e2e-tests/vertical-slice-a11y.spec.ts · vertical-slice-visual.spec.ts · vertical-slice-performance.spec.ts · vertical-slice.spec.ts · all-screens-performance.spec.ts · motion-review.spec.ts — enthalten city-Selektoren; die Chrome-Umstellung (Breadcrumb, Listen-Toggle, Legenden-Knopf, Monatsleiste) verschiebt sie.`
- `src/pages/__tests__/CityPage.test.tsx und CityPage.error-state.test.tsx — muessen nach ADR 'Was das fuer den Bestand heisst' im selben Commit fuer BEIDE Dichten laufen (useDisplayDensity mocken, wie in features/coach/presentation/mobile/__tests__/).`
- `src/hooks/useDisplayDensity.ts — NUR LESEND (bestehende Infrastruktur, keine Aenderung noetig). Aufgefuehrt, weil jede parallele Flaeche daran haengt.`
- `card-rule-budget.json — VORAUSSICHTLICH KEINE AENDERUNG, aber zu pruefen: 'max' (149) zaehlt <Card/bg-card, davon hat die Flaeche heute 0. 'maxFokussiert' (2) zaehlt nur unter features/*/presentation/mobile/ — die neue Datei darf dort nichts hinzufuegen, sonst steigt eine Ratsche, die nur sinken darf.`
- `view-data-budget.json — KEINE AENDERUNG: Die Flaeche traegt heute 0 zu den 204 bei (alle Abfragen liegen bereits in application/). Aufgefuehrt, damit niemand die Zahl versehentlich fuer diese Migration nachzieht.`
- `slice-presentation-budget.json — VORAUSSICHTLICH KEINE AENDERUNG: Der Entwurf importiert nach features/finance-city/presentation nur aus components/ui/ (ausgenommen) und features/shared/presentation/ (nicht gezaehlt). Zu pruefen, sobald die neue Datei steht.`
- `platform-parity-allowlist.json — heute kein city-Eintrag, und der Entwurf fuehrt kein 'hidden <bp>:*' ein (verzweigt wird per Dichte-Zustand, nicht per CSS). Aufgefuehrt zur Kontrolle.`
- `state-coverage-allowlist.json — heute kein city-Eintrag; Leer- und Fehlerzustand sind in CityPage.error-state.test.tsx abgedeckt. Bei zwei Dichten wird das ein Zustand mehr je Fassung.`

### Offene Fragen
- ADR-AENDERUNG NOETIG, BEVOR IRGENDJEMAND BAUT. Die drei Ergaenzungen zu Regel 9 (Visualisierung = eine Aussage · Plaettchen auf gerenderter Flaeche ist keine Box · Stadt bekommt KEINE Ausnahme von 'ein Bildschirm') betreffen jede Flaeche mit einem Diagramm, nicht nur /city. Ohne sie ist Regel 9 auf keiner Auswertungsflaeche mit Recharts anwendbar. Das ist die einzige Reihenfolge-Abhaengigkeit dieses Auftrags.
- DARF DIE LISTENANSICHT EINEN TIPP TIEFER? Das README fuehrt sie als Akzeptanzkriterium 'ueber einen Toggle erreichbar' — sie ist der einzige nicht-visuelle Zugang zu den Daten. Der Entwurf legt sie in den Detailschritt, macht sie dafuer erstmals adressierbar (?ansicht=liste) und setzt sie als ersten fokussierbaren Eintrag. Meine Empfehlung ist, das so zu machen; die Alternative (eigener Icon-Knopf bleibt im Rahmen) kostet ein Bedienelement mehr auf dem Bildschirm und keine Aussage. Entscheidung gehoert an jemanden, der die a11y-Abnahme verantwortet.
- TIEF-VERLINKBARKEIT DER WELT UND DER EBENE. tab und nav-Ebene sind lokaler Zustand; /city kann heute nicht auf 'Einnahmen' oder auf einen Distrikt zeigen. Das ist ein bestehender Regel-5-Befund unabhaengig vom Umbau (das Abfrage-Register verspricht mit deepLinkArt:'quelle' 'genau diese Menge'). Ich habe ihn NICHT in den Entwurf genommen, um die Flaeche nicht zu ueberladen — er sollte aber als eigener Auftrag erfasst werden, und wenn er ohnehin kommt, ist er zusammen mit ?lage/?ansicht billiger als danach.
- SIGNATURE-MOMENT UND TIPP-HINWEIS: 'Das ist Ihre finanzielle Welt.' (CityMoments.tsx:75) traegt keine Daten und steht unter Regel 9 als Aussage im Weg. Er ist einmalig beim Erstbesuch und verschwindet von selbst — ich habe ihn stehen gelassen und nur 'shadow-lg' als ueber die Lesbarkeit hinausgehend markiert. Wenn 'Ruhe vor Fuelle' hier haerter gelten soll, faellt er ganz; das ist eine Produktentscheidung, keine Regelfrage.
- VOLL-RANDLOSER CANVAS VS. AppShell. Wirklich randlos waere die Buehne erst ohne das AppShell-Innenpadding (px-4 py-6 sm:px-6, AppShell.tsx:186). Das README der Slice verwirft negative Margins ausdruecklich als fragil, und AGENTS.md/README verbieten, AppShell dafuer zu aendern. Der Entwurf nimmt deshalb nur den Rahmen weg, nicht das Padding — die Buehne bleibt 16 px eingerueckt. Ob das reicht, ist am Geraet zu entscheiden; der Beleg fuer Regel 9 ist laut ADR ohnehin ein Bildschirmfoto, kein gruener Haken.
- MAX_VISIBLE_LABELS an useDisplayDensity statt useIsWideDesktop: Der Umbau ist trivial, aber er aendert das Verhalten im Fenster zwischen 768 und 1024 px (dort gaebe es kuenftig 10 statt 6 Label). Das ist nach ADR Regel 4 richtig — die 1024er-Schwelle darf nicht ueber Inhaltsmenge entscheiden — aber es ist eine sichtbare Aenderung auch in der kompakten Dichte und gehoert benannt, nicht nebenbei gemacht.
- BUNDLE: Ob die Dichte-Aufteilung den CityPage-Chunk (178 kB gzip, der zweitgroesste Einzelchunk der App) wirklich senkt, ist NICHT gemessen. Der three.js-Stapel liegt in beiden Fassungen und wandert vermutlich in einen gemeinsamen Chunk; gespart wird nur Chrome. Vor dem Nachziehen von bundle-size-budget.json einmal 'pnpm build' und die tatsaechlichen Zahlen eintragen, statt sie zu schaetzen.
