# Changelog

Alle nennenswerten Änderungen an Fintracker, neueste zuerst.

**Versionsschema: CalVer `JJJJ.M.n`** — Jahr, Monat, laufende Nummer innerhalb
des Monats. Das passt zur Datumskultur des Projekts (Dokumente, Audits und ADRs
tragen hier Datum, keine Release-Nummer) und beantwortet die Frage, die bei
einer local-first App wirklich gestellt wird: *von wann ist mein Stand?*

> **Warum `2026.8.0` und nicht `2026.08.0`?** Die führende Null ist nach
> SemVer §9 unzulässig (`semver.valid('2026.08.0')` → `null`), und npm parst sie
> nur nachsichtig: `npm publish` normalisiert `2026.08.0` still zu `2026.8.0`.
> Zwei Schreibweisen für einen Stand sind genau die Mehrdeutigkeit, die eine
> Versionsnummer beseitigen soll — deshalb gilt **eine** Form überall:
> `package.json`, `versionName`, Git-Tag (`v2026.8.0`) und dieser Datei.
> `docs/qualitaet-2026-08/plan.md` (WP 7.4) nennt noch die Form `v2026.08.0`;
> der Plan ist Protokoll, diese Abweichung ist bewusst.

Gliederung je Block: **Neu** (was Nutzer sehen und tun können) · **Behoben**
(was falsch war) · **Intern** (Architektur, Tests, Wächter, Abhängigkeiten).
Der Ablauf für einen neuen Stand steht in `AGENTS.md` §11.

## [Unreleased]

### Neu

- **Budgets per Chat anlegen und ändern — mit Bestätigung und Rückgängig.**
  „Lege ein Budget von 200 € für Lebensmittel an", „erhöhe mein
  Freizeitbudget um 50", „lösch das Budget für Kino" versteht die Seite
  „Nachfragen" jetzt als Befehl. Bevor irgendetwas passiert, steht da, was
  passieren würde — beim Ändern mit Vorher und Nachher; erst der Klick auf
  „Bestätigen" schreibt, und danach steht „Rückgängig" bereit. Fragen bleiben
  Fragen: „Wie viel Budget habe ich noch?" wird weiterhin beantwortet und nie
  als Anweisung missverstanden.

- **Was-wäre-wenn-Fragen mit mehreren Veränderungen — direkt im Chat.**
  „Ich verkaufe mein Auto, bekomme in 2 Monaten eine Gehaltserhöhung — kann
  ich im Dezember für 5k in den Urlaub, ohne den Notgroschen anzugreifen?"
  wird jetzt als Kombination verstanden: Die erkannten Veränderungen stehen
  als einzeln entfernbare Chips da (eine unbezifferte Gehaltserhöhung fragt
  nach dem Betrag, statt einen zu erfinden; wegfallende Verträge werden beim
  Namen genannt), die Monte-Carlo-Simulation rechnet die veränderte Welt
  durch und antwortet mit Puffer-Wahrscheinlichkeit, Kontostand-Delta und
  engstem Tag. Der Link „volle Analyse" öffnet die Liquiditäts-Ansicht mit
  genau diesem Szenario.

- **Oberbegriffe fassen mehrere Kategorien zusammen.** „Wieviel gebe ich für
  Essen aus?" rechnet jetzt über alle Kategorien, die dazugehören — bei der
  Standard-Aufteilung sind das Lebensmittel, Supermarkt, Wochenmarkt, Bäckerei
  UND Restaurant, also zwei getrennte Hauptkategorien. „Auto" fasst
  entsprechend Tanken, Werkstatt, Kfz-Versicherung und Finanzierung zusammen.
  Erkannt wird über kuratierte Oberbegriffe je Sprache, abgeglichen mit deinen
  Kategorienamen und den Stichwörtern, die die App ohnehin pflegt — auch deine
  selbst angelegten Kategorien werden mitgenommen. Die erkannte Gruppe steht
  als einzeln abwählbare Chips über der Antwort und lässt sich ergänzen; die
  Zahl rechnet sofort neu. Der geteilte Link trägt genau dieselbe Auswahl
  (`?cat=a,b,c`) — bereits verschickte Links behalten ihre Bedeutung.
- **Nachfragen versteht jetzt breite Alltagssprache.** Der Frage-Router wurde
  gegen einen Korpus von 225 realen Fragen (einfach, komplex, mit Tippfehlern)
  gemessen und ausgebaut: 17 neue Antwortfamilien (Gesamtausgaben, größte
  Händler und Bereiche, ungewöhnliche Monate, letztes/durchschnittliches/
  schwankendes Einkommen, Abos samt Preiserhöhungen, Fixkosten samt
  Einkommens-Anteil, Budget-Rest und Tagesrate, Kontostand-Vorschau, frei bis
  zum Gehalt), dazu ein kleiner lokaler Klassifikator, der Umschreibungen und
  Tippfehler erkennt — ohne Sprachmodell, ohne Cloud, aus wenigen hundert
  kuratierten Beispielsätzen in Millisekunden abgeleitet. Gemessen beantwortet
  der Router jetzt 99,6 % des Korpus richtig oder mit einer präzisen
  Rückfrage; zuversichtlich falsche Antworten: null. Hypothetische Fragen
  („wenn ich …", „mit welcher Wahrscheinlichkeit …") erreichen nur noch die
  Simulation — eine Ist-Auswertung antwortet nie auf eine veränderte Welt.
- **Nachfragen lernt aus deinen Klicks.** Wählst du bei einer Rückfrage eine
  Deutung, merkt sich die Seite das Paar aus Frage und Bedeutung —
  verschlüsselt, nur auf dem Gerät, in den Einstellungen einsehbar und
  löschbar. Dieselbe Formulierung wird beim nächsten Mal direkt verstanden.
- **Nachfragen: Frag in eigenen Worten nach deinen Zahlen.** Die neue Seite
  „Nachfragen" beantwortet Fragen wie „Wieviel habe ich letzten Monat bei
  Lidl ausgegeben?" — gerechnet wird lokal aus deinen Buchungen, ohne
  Sprachmodell und ohne Cloud. Jede Antwort trägt einen Link auf genau die
  Buchungen, aus denen die Zahl entstand. Was nicht verstanden wurde, führt
  zu einer Rückfrage und nie zu einer geratenen Zahl.
- **Abstrakte Begriffe werden zugeordnet.** „für essen" findet die Kategorie
  „Essen & Trinken", auch wenn kein Wort davon vorkommt — über dieselbe
  Erkennung, die auch Buchungen kategorisiert. Die verstandene Kategorie wird
  benannt und bleibt mit einem Klick korrigierbar.
- **Fintracker lernt aus deinen eigenen Korrekturen.** Aus den Buchungen, die
  du selbst bestätigt hast, entsteht eine zusätzliche Stufe der
  Kategorie-Erkennung. Sie schreibt nur still, wenn sie genug eigene Beispiele
  gesehen hat, und begründet jeden Vorschlag mit den Wörtern, auf die sie sich
  stützt. In den Einstellungen steht, wie gut sie gerade trifft — und ein
  Schalter, sie abzuschalten.
- **Händlerfilter in Buchungen und in der URL.** Buchungen lassen sich nach
  Händler filtern statt nur zu durchsuchen; Notiz- und Beschreibungstreffer
  zählen dabei nicht mehr mit. Der Filter steht in der Adresse (`?merchant=`)
  und ist damit teilbar.
- **Verträge über die Adresse öffnen.** `?merchant=` öffnet auf der
  Vertragsseite direkt den passenden Vertrag.
- **Ratenkäufe werden gelesen.** Steht „Rate 3/12" im Buchungstext, kennt
  Fintracker die Restlaufzeit — und rechnet sie aus, statt sie zu schätzen.
  Erfragbar über „Nachfragen".
- **Händler werden zuverlässiger zusammengefasst.** Ortszusatz bei
  Kartenzahlung, Webadresse und Rechtsform trennen eine Händlerfamilie nicht
  mehr in zwei oder drei.

### Behoben

- **Der Leistbarkeits-Verweis hält jetzt sein Versprechen.** Die Chat-Antwort
  „kann ich mir X leisten" behauptete seit jeher, die Simulation sei „dort
  mit deinem Betrag vorbelegt" — tatsächlich las die Zielseite die Parameter
  nie. Jetzt kommt der Betrag an, „Frag dein Geld" rechnet automatisch.
- **Eine Ausgabenfrage wurde mit Einnahmen beantwortet.** Eine Frage konnte
  ohne einen einzigen Treffer auf ihre Auslösewörter gewinnen, und die
  Sortierung stellte Vollständigkeit über Relevanz.
- **Beim Beleg-Scan wird ein widersprüchlicher Betrag nicht mehr vorbelegt.**
  Ergeben die einzelnen Posten mehr als der ausgewiesene Gesamtbetrag, wurde
  einer der beiden falsch gelesen — das Feld bleibt jetzt leer, mit einem
  Hinweis warum. Lässt sich der Widerspruch eindeutig auf eine überzählige
  Zeile zurückführen (Pfand, Rabatt, Zwischensumme), wird sie entfernt und der
  Betrag stimmt wieder.
- **Eine vertippte IBAN wird beim Anlegen eines Kontos benannt.** Sie brach
  bisher nichts sichtbar — sie sorgte nur wortlos dafür, dass interne
  Überträge nie erkannt wurden. Gespeichert wird sie trotzdem.
- Kleinere Textfehler: „1 Buchungen", ein roher Zeitraum-Kürzel in der
  Antwort, „0,00 €" wo „keine Buchung" gemeint war.

### Intern

- Zweite, unbenutzte Vertragsableitung entfernt; ihre Abdeckung auf die
  tatsächlich benutzte Seite verlagert.
- Der EU-Wächter sieht jetzt auch CDN-Vorgaben aus Abhängigkeiten — bis dahin
  las er nur den git-Index, in dem `node_modules` nicht steht. Ohne
  `node_modules` bricht er ab, statt still leer grün zu melden.
- `AGENTS.md` §3 hält die Regel „Rechnen, schließen, prüfen" fest: wo Inferenz
  sitzen darf und warum kein Modellgewicht ausgeliefert wird.

## 2026.8.3 — 2026-08-26

### Behoben

- **Der Kontostand stimmt nach einem Import, ohne manuelle Korrektur.** Ein
  Saldo ist ab jetzt ein *Anker*: ein Betrag **mit Stichtag**, auf den nur die
  Buchungen **nach** diesem Tag addiert werden. Vorher rechnete Fintracker
  `Startsaldo + Summe ALLER Buchungen` — das Feld `opening_balance_date` wurde
  zwar gespeichert und im Formular angezeigt, aber von keiner Rechnung gelesen.
  Wer Historie nachimportierte, die älter war als sein Startsaldo, bekam sie
  doppelt gezählt.
- **Ein Bank-Saldo friert nicht mehr ein.** `live_balance_amount` schlug bisher
  jede spätere Buchung — eine einmal eingetragene manuelle Korrektur war damit
  ab dem nächsten Einkauf wieder falsch. Jetzt ist auch sie ein Anker und wächst
  mit.
- **Der Bank-Sync übernimmt den echten Kontostand der Bank** (`closingBooked`,
  der Wert aus der Bank-App) samt deren Stichtag. Bisher wurde der Saldo aus der
  ersten Buchung des Sync-Fensters *zurückgerechnet*, und weil der Sync
  inkrementell läuft, war dieses Fenster bei jedem Lauf ein anderes. Der Abruf
  existierte bereits (`live-balance-service`), war aber an kein Konto
  angeschlossen.
- **„Kein Startsaldo" ist nicht mehr dasselbe wie „Startsaldo 0 €".** Neue
  Konten bekamen bisher zwangsweise die 0; das hat zwei Prüfungen still
  ausgehebelt — den Erststart-Vorbehalt im Sync und den Hinweis „Startsaldo
  ergänzen" in der Datenqualität, der deshalb nie erschien.

### Behoben (Import-Felder)

- **Bei einer Kartenzahlung steht wieder der Händler als Empfänger da**, nicht
  die abwickelnde Bank. Die Auswertung lautete `debtorName || creditorName`
  und `debtorAccount || creditorAccount` — dieselbe Reihenfolge für beide
  Richtungen. Bei einer Ausgabe ist das Gegenüber aber der Creditor. Betroffen
  war auch die Gegenkonto-IBAN, und die speist die Erkennung interner
  Überträge.
- **Kein Bankfeld geht beim Import mehr verloren.** Branchenschlüssel des
  Händlers (MCC), Buchungsschlüssel (ISO 20022), Wertstellungsdatum, Mandats-
  und End-to-End-Referenz, beide Namen und beide IBANs waren im Typ
  deklariert und wurden verworfen. Sie stehen jetzt in `bank_fields` an der
  Buchung.
- **Die Art der Buchung in Klartext.** MCC 7523 heißt „Parken", `PMNT-CCRD-POSD`
  heißt „Kartenzahlung" — unabhängig davon, ob der Verwendungszweck nur aus
  Terminal-Kennungen besteht. Wird als Beschreibung genommen, wenn die Bank
  keinen Verwendungszweck liefert.

### Intern

- `computeEffectiveBalances` nimmt die Buchungen **roh** entgegen statt
  vorsummiert. Die alte Signatur (`Record<accountId, number>`) hatte die
  Datumsangaben bereits weggeworfen, bevor die Funktion sie sehen konnte — sie
  machte die richtige Rechnung unmöglich und keinen Test rot.
- `net-worth-service` rechnet nicht mehr selbst: Die zweite Kopie derselben
  Saldo-Formel (mit demselben Fehler) ist durch einen Aufruf der kanonischen
  Fassung ersetzt.
- 14 neue Tests zur Anker-Logik, 4 zum Sync — darunter der gemeldete Fall
  (Startsaldo zum Stichtag, Historie danach nachimportiert) als `[REGRESSION]`.
- **Eigenschaftsbasierte Tests (`fast-check`) für die Rechenkerne.** Der
  Saldo-Fehler hatte 15 gründliche Beispieltests neben sich, alle grün — sie
  prüften die Fälle, die sich jemand vorgestellt hat. Zwölf Eigenschaften
  prüfen jetzt Aussagen statt Beispiele („eine Buchung vor dem Stichtag ändert
  den Saldo nicht", „ein Transferpaar verändert Einnahmen und Ausgaben nicht",
  „`sumMinor` ist reihenfolgeunabhängig"). Gegenprobe: Gegen die alte Rechnung
  fallen genau die zwei Eigenschaften, die den Fehler beschreiben — mit einem
  auf eine Buchung und einen Cent geschrumpften Gegenbeispiel.

## 2026.8.2 — 2026-08-12

### Neu

- **Alle Führungen an einem Ort: die neue Seite „Tutorials".** Sie listet
  jedes Tutorial nach Bereich — „Buchungen" etwa trägt fünf davon (Liste
  lesen, Kategorien, Suchen & Filtern, Detailansicht, Aufteilen), „Steuer" ein
  eigenes. Angesehene Kapitel bekommen einen grünen Haken, ein Klick startet
  die Führung und bringt dich auf die zugehörige Seite. Erledigtes bleibt
  startbar: Nachschlagen ist der häufigste zweite Durchgang.
- **Das ganze Tutorial am Stück.** „Alles der Reihe nach zeigen" läuft Kapitel
  für Kapitel durch die App, statt nach jedem anzuhalten. Kapitel, für die noch
  Daten fehlen, bleiben dabei außen vor — eine Führung durch einen leeren
  Bildschirm lehrt nichts.
- **Auf jeder Seite erklärbar.** Ein Knopf in der Kopfzeile startet die Führung
  zur gerade geöffneten Seite und führt zur Gesamtübersicht. Bisher gab es dafür
  nur den Einladungsstreifen — und der war nach einem „Nicht jetzt" weg.

### Behoben

- **Die Führung springt nicht mehr wahllos auf eine andere Seite.** Die
  Einladung („Soll ich es dir zeigen?") schwebt über jeder Seite, bot aber
  immer den Anfang des Lehrplans an und nannte ihn „eine kurze Führung durch
  **diesen** Bereich" — auf `/city` startete sie damit die Buchungen, riss die
  Seite weg und erklärte etwas anderes als das, worauf man gerade sah. Spielt
  jetzt ein Kapitel auf der geöffneten Seite, wird genau dieses angeboten;
  sonst benennt die Einladung den Bereich, in den sie führt, statt den Wechsel
  zu verschweigen.
- **Eine laufende Führung zerrt nicht mehr zurück.** Wer während der Führung
  selbst in die Navigation klickte, landete sofort wieder auf der Route des
  Schritts. Jetzt wird einmal je Schritt hingeführt; verlässt der Nutzer den
  Bereich, endet die Führung, statt ihn festzuhalten.
- **Der Rahmen zeigt beim Schrittwechsel nie mehr auf die alte Stelle.** Der
  neue Anker wurde bis zu einer Sekunde lang gesucht, und so lange blieb der
  Rahmen auf dem Element des vorigen Schritts stehen — nach einem
  Seitenwechsel also auf einer Stelle der alten Seite.

## 2026.8.1 — 2026-08-11

### Behoben

- **Der Sanfte Modus verdeckt jetzt wirklich jeden Betrag.** Auf der
  Vermögensseite standen zwölf Beträge ungeschützt — ausgerechnet die Fläche,
  vor der jemand mit Vermeidungsverhalten am ehesten zurückschreckt. Ebenso in
  den Smart Insights und in der Analytik-Vorschau. Zwei Flächen (Coach-Raster,
  Tagesliste) hatten eine eigene Maske gebaut, die die Stufen nicht kannte: Die
  Tagesliste verschwieg die Tagesveränderung schon auf Stufe 1, wo Fortschritt
  sichtbar bleiben soll.
- **Ein Kurs von 0 wird nicht mehr wie „kein Kurs" behandelt.** Eine wertlos
  gewordene Position fiel auf den Einstiegskurs zurück und zeigte ±0 statt des
  Totalverlusts — in Depotwert, Gewinn/Verlust, Sortierung und eToro-Abgleich.
- **Gleichzeitige Schreibvorgänge verlieren keine Daten mehr.** Zwei kurz
  aufeinanderfolgende Aktionen konnten einander überschreiben: eine Einstellung,
  eine Kategorie, eine Buchung, eine Schuld-Zuordnung, ein Protokolleintrag. Ohne
  Fehlermeldung. Betroffen war jede lokale Collection.
- Dublettenprüfungen greifen jetzt auch bei gleichzeitigen Aktionen — zuvor
  konnten zwei parallele Aufrufe beide an ihnen vorbeikommen.

### Intern

- **Zwei neue Wächter, beide ohne Ausnahmeliste.**
  `pnpm check:store-serialization` meldet Lesen-Ändern-Schreiben ohne Lock —
  der Fehler oben stand an 27 Stellen in 12 Dateien und war bis dahin
  unsichtbar (kein Test wurde rot, der Compiler schwieg).
  `pnpm check:money-format` meldet einen gerenderten Betrag, der nicht durch
  die Maske des Sanften Modus läuft. Beide melden den **Aufruf**, nicht die
  Deklaration: Ein Wächter gegen jeden rohen `Intl`-Formatierer hätte bei
  korrekt maskierenden Flächen Fehlalarm — und Fehlalarme schalten Wächter ab,
  statt sie durchzusetzen.
- **Serialisierung als Primitiv statt als Absicherung je Aufrufstelle**
  (`src/lib/key-mutex.ts`, `mutateLocalFinanceList`): ein Weg für alle lokalen
  Collections statt zwölf einzelner Vorsichtsmaßnahmen.
- **Toter Code entschieden** (Issue #297): `BulkActions`,
  `matchContractsToTransactions`, `applyContractToSimilar`, `useErrorHandler`
  und `useSkin` samt seinem Context entfernt. Die Liste wurde vorher neu
  erhoben — `withErrorBoundary` lebt seit der AppShell-Absicherung wieder,
  dafür fehlte `applyContractToSimilar` in der alten Erhebung.
- **Issue-Sichtung** (`docs/issue-triage-2026-08.md`): 44 offene Issues gegen
  den Baum nachgemessen; acht geschlossen.
- **Doku-Aktualitätslauf über alle 84 Markdown-Dateien**: ~60 veraltete
  Aussagen in geltenden Dokumenten korrigiert — u. a. zeigten sämtliche
  i18n-Anleitungen (AGENTS.md §6, README, `.claude/`-Werkzeuge) noch auf die
  alte Zentraldatei statt auf die Sprachbäume `src/i18n/translations/<locale>.ts`
  (WP 4.5); `performance.md` führte die längst gebauten Quartals-Chunks als
  „geplant"; `security-boundaries.md` kannte die zwei realen Opt-in-Abflusswege
  nicht; die Produkt-Roadmap 2026-07 listete Gebautes als „fehlt";
  Slice-READMEs verwiesen auf gelöschte Dateien. Protokolle und Archive blieben
  unangetastet (sie altern absichtlich); die drei von PR #299 korrigierten
  Dateien ebenso. Nebenbefund behoben: `test:integrity` zeigte auf die seit
  #288 gelöschte `filter-utils.test.ts`.
- **Programm „Produktionsreife & EU-Souveränität" aufgesetzt**
  (`docs/betrieb-2026-08/`): Prüfung der zehn externen Betriebsvorschläge
  gegen den Repo-Stand (Audit mit Befund-IDs BTR-*), Arbeitsplan mit Phasen
  0–7 und 40 Paketen samt Livegang-Gate. Dazu die dauerhaften Regeln: ADR
  „EU-only bei Anbietern und Subdienstleistern", ADR „Supabase-Ablösung mit
  Neubau-Stopp" und das lebende Anbieter-Register
  (`docs/security/anbieter-register.md`).

## 2026.8.0 — 2026-08-10

> Der erste benannte Stand des Projekts überhaupt. Inhalt ist das
> Qualitätsprogramm 10/10 (`docs/qualitaet-2026-08/`): 53 Arbeitspakete aus
> einem Vollaudit vom 2026-08-08, dazu vier Fixes unmittelbar vor dem Merge.
> Der Abschlussbericht mit dem belegten Erfolgskriterium steht in
> `docs/qualitaet-2026-08/nachpruefung.md`.

### Neu

- **Auto-Lock der lokalen Verschlüsselung**: Der Schlüssel fällt nach Inaktivität
  aus dem Speicher, statt bis zum Schließen des Tabs zu leben.
- **Passwort-Mindeststärke** beim Einrichten der lokalen Verschlüsselung — als
  Gate, nicht als Hinweis.
- **Sync-Import fragt nach**, wenn der eingespielte Stand älter ist als der auf
  dem Gerät, statt still zu überschreiben.
- **Backup mit Prüfsumme**: Ein beschädigtes oder unvollständiges Backup wird
  beim Einspielen erkannt und je Datensatz geprüft.
- **Unlesbare Datensätze werden benannt** („n Einträge unlesbar, Backup
  prüfen") statt still verworfen.
- **Fremdwährung wird sichtbar als *nicht verrechnet* ausgewiesen** — eine
  USD-Position fließt nicht mehr 1:1 in Portfolio-Summe und Nettovermögen.
- **MCP-Zugriff kennzeichnet Klartext-Daten** in der Oberfläche.

### Behoben

- **Ein beschädigter verschlüsselter Datenblock wurde als „keine Daten" gelesen
  und beim nächsten Schreiben überschrieben.** Er wirft jetzt einen Fehler; die
  Fläche zeigt ihn als Fehlerzustand. Derselbe Fehlerpfad war auch bei den
  Prognose-Übersteuerungen offen.
- **Flächen behaupteten nach einem Lesefehler „du hast noch nichts erfasst"** —
  Schulden, Vermögen, Stadt und weitere. Fehlerzustand schlägt jetzt überall den
  Leerzustand, und die Tests prüfen die Abwesenheit dieser Lüge.
- **Getippte Geldbeträge im deutschen Format wurden verstümmelt**: „1.200"
  wurde zu 1,2 (roher `parseFloat` mit Komma-Ersetzung).
- **Der erste Start war kaputt** (zwei Regressionen: Laufzeit-Lückenprüfung und
  ein Rennen zwischen Migration und Landing-Screen).
- **Wochentage und Datumsangaben folgten der Systemsprache statt der
  App-Sprache**; an weiteren 46 Stellen stand Text hardcodiert im Quelltext,
  darunter halb übersetzte Zeilen.
- **Der gespeicherte Anbieter-Favorit wurde nicht gelesen.**
- **Dialoge behaupteten „account management"**, wo etwas anderes gemeint war.

### Intern

- **Datenintegrität:** zod-Validierung an der Kern-Lesegrenze (IndexedDB,
  Backup, Import); echter Migrationsläufer statt Best-Effort;
  Speicher-Laufzeitfehler (Quota, blockierte Transaktion) werden behandelt.
- **Sicherheit:** PBKDF2 auf ≥ 600 000 Iterationen mit versioniertem KDF-Feld;
  Wächter prüft RLS-Policies auf Restriktivität.
- **Performance:** Buchungen liegen in Quartals-Chunks mit Index statt in einem
  Block; Query-Invalidierungen zielgenau statt pauschal; Chart-Daten memoisiert;
  i18n lädt eine Sprache statt vier.
- **Typen:** Cent und Euro sind für den Compiler nicht mehr dasselbe; IDs sind
  gebrandet; `types.ts` ist entlang der Domänen aufgeteilt.
- **Architektur:** Feature-Slices für Trading, Einstellungen, Konten,
  Dashboard und Finanzstadt; `src/components/common/` ist nach
  `src/features/shared/presentation/` umgezogen; die beiden Gott-Module sind
  geteilt.
- **Wächter:** neu `check:money-parsing`, geschärft `check:i18n` (vier zuvor
  unsichtbare Formen), Ratschen für Ansicht/Daten und Slice-Presentation;
  `api/` und `mcp-poc/` laufen jetzt im Typecheck.
- **Dokumentation:** fünf datierte ADRs für die Grundentscheidungen (EUR-only,
  IndexedDB-KV, Doppel-Schichtung, Wächter-System, Euro-Float-Persistenz);
  Versionierung und dieser Changelog (WP 7.4).

## Vorgeschichte — vor der Versionierung

Bis einschließlich 2026-08-08 gab es **keine Tags und keine Versionsnummern**
(Befund GOV-3: `package.json` stand auf `0.0.0`, `versionCode` auf `1`, bei
279 Commits). Diese Stände lassen sich deshalb nur über PR-Nummer und Datum
benennen — rückwirkend vergebene Nummern wären erfunden. Grob ab PR #287:

### 2026-08-08 — PR #290

- **Intern:** Vollaudit des Repos und der daraus abgeleitete Arbeitsplan
  (`docs/qualitaet-2026-08/`). Nur Dokumentation, kein Code.

### 2026-08-08 — PR #288

- **Intern:** Drei Wächter mit Bestandsaufnahme — Dezimaleingaben
  (`check:decimal-inputs`), i18n über den ganzen Baum (`check:i18n --all`) und
  die Trennung von Ansicht und Daten (`check:view-data`, Ratsche bei 282).

### 2026-08-08 — PR #287

- **Intern:** Konsolidierung der Schichtrichtung (`check:layers`),
  Aufräumen der Dokumentation und Aufteilung der vier größten Dateien.
