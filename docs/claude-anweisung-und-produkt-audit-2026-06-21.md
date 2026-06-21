# Vollständige Umsetzungsanweisung und Produkt-Audit

Datum: 21.06.2026  
Geprüfte Basis: `origin/main`, Commit `087067c`; anschließend mit Red-Team-Guardrails integriert
Produkt: Fintracker / Modul Ausgabentracker 2

## 1. Auftrag

Verbessere die aktuelle App produktorientiert und mobile-first. Verstehe dabei zuerst die Intention der vorhandenen Features und konsolidiere bestehende Implementierungen, bevor neue parallele Varianten entstehen.

Arbeite wie UX-Designer, Product Manager, Mobile Designer und Frontend-Architekt. Die App soll komplexe Finanzdaten verständlich, motivierend und ohne unnötiges Scrollen darstellen.

Wichtig:

- Keine vorhandene Variante vorschnell löschen.
- Versteckten oder nicht gerouteten Code zuerst auf frühere, geplante oder Premium-Funktionen prüfen.
- Keine neuen redundanten Dashboards, Filter oder Transaktionslisten erstellen.
- Erklärungen bevorzugt über Info-Dialoge und Bottom Sheets anbieten.
- Horizontales Scrollen nicht als dauerhafte Navigation verwenden.
- Finanzdaten und Belege bleiben entsprechend dem bestehenden Datenschutzkonzept lokal.
- Änderungen in kleinen, testbaren Schritten umsetzen.

## 2. Kontext gezielt laden

Nicht das gesamte Repository in den Kontext laden. Für eine Aufgabe zunächst nur die genannten Einstiegsdateien öffnen und weitere Imports ausschließlich bei konkretem Bedarf verfolgen.

| Thema | Zuerst laden | Nur bei Bedarf zusätzlich laden |
|---|---|---|
| Nettovermögen mobil | `src/pages/NetWorthPage.tsx`, `src/components/common/InfoSheet.tsx` | `src/services/net-worth-service.ts`, Portfolio-, Forderungs- und Schulden-Services |
| Mobile Dashboard-Story | `src/components/dashboard/DashboardMobileStory.tsx`, `src/components/dashboard/Dashboard.tsx` | direkt importierte Chart-Komponenten, `src/lib/analysis-data.ts` |
| Sunburst | `src/components/dashboard/DashboardMobileStory.tsx`, `src/components/dashboard/SpendingBreakdownCard.tsx` | Kategorie-Service, `src/lib/analysis-data.ts` |
| Finanzlandschaft / Heute für dich | `src/components/health-score/FinancialLandscape.tsx`, `src/pages/CoachPage.tsx` | `src/components/health-score/HealthScoreCard.tsx`, Score-Services |
| Zeitraum und Durchschnitt | `src/components/premium-dashboard/ResponsivePremiumDashboard.tsx`, `src/components/dashboard/filter-constants.ts`, `src/components/dashboard/filter-utils.ts` | `src/components/dashboard/TransactionFilters.tsx`, Timeline- und KPI-Komponenten |
| Dashboard-Buchungsvorschau | `src/components/dashboard/Dashboard.tsx`, `src/pages/TransactionsPage.tsx` | mobile Buchungszeilen und Filterkomponenten |
| Transaktionsdetails und Split | `src/components/transactions/TransactionDetailsModal.tsx`, `src/hooks/useTransactionDetailEditing.ts`, `src/types.ts` | `src/services/transaction-service.ts`, `src/services/local-finance-store.ts` |
| Belegscan / Trackerverse | `src/components/transactions/ReceiptScanDialog.tsx`, `src/services/receipt-parser-service.ts` | Import-, Backup-, Crypto- und lokale Store-Services |
| Verträge | `src/pages/ContractsPage.tsx`, `src/services/contract-decision-service.ts`, `src/components/dashboard/filter-utils.ts` | Transaktions-Service und Vertragserkennung |
| Premium und Alphacode | `src/lib/tier.ts`, `src/hooks/useTier.ts`, `src/components/auth/FeatureGate.tsx` | `src/components/UserQuickProfile.tsx`, `src/components/settings/UserProfile.tsx`, Auth-Kontext |
| Kategorienverwaltung | über die Kategorienroute importierte Verwaltungsseite und deren direkte Listenkomponenten | Kategorie-Service und Drag-and-drop-Komponenten |

Arbeitsregel:

1. Passenden Tabellenblock laden.
2. Mit `rg` nach Symbol, Route oder Query-Key suchen.
3. Nur unmittelbar relevante Imports nachladen.
4. Für reine UI-Arbeiten keine Crypto-, Bank-, PDF-, Export- oder Backup-Implementierungen laden, solange deren Datenvertrag unverändert bleibt.

## 3. Zusammenfassung des aktuellen Audits

Der neue Stand ist technisch stabil:

- Production-Build erfolgreich.
- 512 von 512 Tests erfolgreich.
- ESLint ohne Fehler, aber mit 115 Warnungen, überwiegend `any` und Hook-Abhängigkeiten.

Die Hauptprobleme liegen nicht mehr in grundlegend defektem Code, sondern in Mobile-UX, Informationsarchitektur und nicht zusammengeführten Produktvarianten.

Größte Risiken:

1. Mobile Seiten sind weiterhin zu lang und zu erklärtextlastig.
2. Sunburst und Finanzlandschaft sind mobil versteckt oder nur indirekt erreichbar.
3. Horizontal scrollende Navigation wird zu häufig eingesetzt.
4. Dashboard und Buchungsseite duplizieren Buchungsfunktionen.
5. Vorhandene Zeitraum- und Durchschnittsmodi sind nicht ins aktive Dashboard integriert.
6. Premium-Gating ist vorbereitet, kann Premiumnutzer aktuell aber praktisch nicht freischalten.
7. Transaktionssplits benötigen vor der UI-Implementierung ein belastbares Datenmodell.

## 4. Nettovermögen mobile-first überarbeiten

### Aktuelles Problem

`NetWorthPage.tsx` zeigt mobil:

- eine große Nettovermögenskarte,
- vier hohe Kennzahlenkarten untereinander,
- danach eine zweite ausführliche Sektion mit denselben Kennzahlen,
- lange Erklärungen, Bankhinweise und Detailkarten im normalen Seitenfluss.

Der Screen wirkt wie ein Dokument, nicht wie eine mobile Finanzübersicht.

### Zielbild

Der erste Viewport enthält:

1. Nettovermögen als Hauptzahl.
2. Eine kompakte visuelle Zusammensetzung.
3. Vier antippbare Zeilen:
   - Liquidität
   - Investitionen
   - Forderungen
   - Schulden
4. Eine kontextuelle Hauptaktion, etwa „Depot hinzufügen“.

Jede Zeile öffnet ein `InfoSheet` mit:

- Erklärung,
- enthaltenen Konten oder Positionen,
- Berechnungsgrundlage,
- Aktualisierungsstatus,
- Bearbeitungsaktion.

Die permanente Sektion „Was zählt dazu?“ entfällt mobil. Direkt sichtbar bleiben nur konkrete Warnungen oder Aktionen.

### Akzeptanzkriterien

- Die primäre Zusammenfassung passt ungefähr in einen mobilen Viewport.
- Keine vier übergroßen Einzelkarten untereinander.
- Allgemeine Definitionen befinden sich in Sheets.
- Alle Zeilen sind vollständig antippbar, mindestens 44 px hoch und per Tastatur erreichbar.
- Desktop darf weiterhin mehr Details zeigen, verwendet aber dieselbe Informationshierarchie.

## 5. Mobile Dashboard- und Grafiknavigation

### Befund

Das Sunburst-Diagramm ist technisch über die Ansicht „Kategorien“ vorhanden, liegt aber hinter einer horizontal scrollenden Chip-Navigation. Die eigentliche Finanzlandschaft wird in `CoachPage.tsx` mobil ausgeblendet und durch einen horizontal scrollenden Streifen ersetzt.

### Zielbild

Eine Grafik pro Ansicht, wechselbar durch:

- Swipe-Geste,
- vollständig sichtbare Icon-Navigation,
- direkten Tap auf ein Icon,
- Titel und Positionspunkte.

Empfohlene Reihenfolge:

1. Überblick
2. Geldfluss
3. Kategorien / Sunburst
4. Finanzlandschaft
5. Entwicklung
6. Buchungen

Die Icons dürfen selbst nicht horizontal scrollen. Bei sechs Zielen ist ein kompaktes Raster oder eine Navigation mit vier Primärzielen und „Mehr“ zulässig.

### Anforderungen

- Swipe-Inhalte können CSS Scroll Snap verwenden.
- Die aktive Grafik wird erst beim Anzeigen gerendert, damit responsive Charts eine gültige Breite erhalten.
- Für jede Grafik existieren Loading-, Empty- und Fehlerzustand.
- Ein Deep Link wie `?view=kategorien` öffnet direkt die gewünschte Ansicht.
- `prefers-reduced-motion` wird berücksichtigt.
- Kein Feature darf ausschließlich durch eine Wischgeste erreichbar sein.

## 6. Finanzlandschaft und „Heute für dich“

### Finanzlandschaft

Die Landschaft muss mobil sichtbar bleiben. Statt der hohen Desktop-/Portraitkomposition wird eine kompakte 4:3- oder 16:10-Variante verwendet.

Die fünf Zustände werden als antippbare Hotspots integriert. Ein Tap öffnet Fortschritt, Erklärung und nächste Aktion in einem Sheet.

### Heute für dich

Der horizontal scrollende Streifen für Notgroschen, Schulden und weitere Werte wird ersetzt durch:

- eine priorisierte Fokuskarte über volle Breite,
- darunter vier kompakte Statusfelder im 2×2-Raster,
- Details per Tap.

Die App soll nicht alle Probleme gleich laut darstellen. Pro Besuch wird ein wichtigster nächster Schritt hervorgehoben.

## 7. Dashboard und Buchungsseite entflechten

### Befund

Das Dashboard enthält erneut Suche, Filter, mobile Buchungsliste und Desktop-Tabelle, obwohl `TransactionsPage.tsx` dafür die bessere spezialisierte Seite ist.

### Zielbild

Das Dashboard zeigt nur eine gefilterte Vorschau:

- aktive Filterchips,
- Anzahl passender Buchungen,
- Gesamtsumme,
- maximal fünf relevante Buchungen oder Auffälligkeiten,
- CTA „Alle … Buchungen anzeigen“.

Der CTA öffnet die Buchungsseite und übergibt die Filter per URL. Dort liegen Suche, Sortierung, vollständige Liste, Bulk-Funktionen und Bearbeitung.

Mobile Filtersteuerung:

- kompakte Zeitraum-Schaltfläche,
- Filterbutton mit Anzahl aktiver Filter,
- Bottom Sheet mit Zeitraum, Konten, Kategorien, Buchungstyp und Vertragsstatus.

### Akzeptanzkriterien

- Keine vollständige zweite Transaktionsverwaltung im Dashboard.
- Dashboardfilter beeinflussen alle dortigen Kennzahlen und Grafiken konsistent.
- Übergebene Filter werden auf der Buchungsseite korrekt wiederhergestellt.
- Der Zurück-Button bewahrt den vorherigen Dashboardzustand.

## 8. Zeitraum-, Durchschnitts- und Vergleichsmodi

### Vorhandenes Potenzial

`ResponsivePremiumDashboard.tsx` enthält bereits:

- Alle Daten
- Monat
- Durchschnitt

Diese alte Variante darf nicht gelöscht werden. Die Businessintention und verwendbare Berechnungslogik sind in das aktive Dashboard zu überführen; es soll aber kein zweites Dashboard bestehen bleiben.

### Neues Analysemodell

| Modus | Inhalt | Zugang |
|---|---|---|
| Zeitraum | konkreter Monat, Quartal oder eigener Zeitraum | Basis |
| Gesamthistorie | alle vorhandenen Daten | Basis |
| Typischer Monat | gemittelte Einnahmen, Ausgaben und Tageswerte | Basis |
| Tendenz | aktueller gegen vorherigen vergleichbaren Zeitraum | Basis |
| Monate vergleichen | frei gewählter Monat A gegen Monat B | Premium |

Der Analysemodus ist von normalen Filtern wie Konto oder Kategorie zu trennen.

### Berechnungsregeln

- Monatswerte werden nach echten Kalendermonaten gruppiert.
- Ein unvollständiger aktueller Monat wird standardmäßig vom typischen Monat ausgeschlossen oder deutlich als unvollständig markiert.
- Ein laufender Monatsvergleich vergleicht wahlweise gleiche verstrichene Tage.
- Vergleichsansichten zeigen absoluten Unterschied, Prozentwert und wichtigste Kategorien als Ursachen.
- Es gibt Tests für Jahreswechsel, Schaltjahre, leere Monate und teilweise importierte Zeiträume.

### Premiumdarstellung

„Monate vergleichen“ bleibt sichtbar und mit Schloss markiert. Ein Tap zeigt eine verständliche Vorschau. Alpha-Tester erhalten die vollständige Funktion.

## 9. Transaktion auf Kategorien aufteilen

### Nutzerführung

Im Transaktionsdetail wird die sekundäre Aktion **„Betrag auf Kategorien aufteilen“** ergänzt.

Der Dialog enthält dynamische Zeilen mit:

- Beschreibung,
- Betrag,
- Kategorie,
- optionaler Unterkategorie,
- Entfernen-Aktion,
- „Teilbetrag hinzufügen“.

Ein dauerhaft sichtbarer Footer zeigt Gesamtbetrag, zugeordneten Betrag und offenen Rest. Speichern ist nur möglich, wenn die Summe exakt stimmt.

Nach dem Speichern bleibt die Bankbuchung in der Liste eine Buchung und erhält beispielsweise das Badge „3 Kategorien“. Im Detail werden die Aufteilungen angezeigt.

### Fachlich zwingendes Datenmodell

Die Teilbeträge dürfen keine zusätzlichen kontowirksamen Transaktionen sein. Andernfalls würden Kontostand und Ausgaben doppelt gezählt.

Ergänze ein Modell wie `TransactionAllocation`:

- `id`
- `transaction_id`
- `amount_minor` in Cent
- `category_id`
- `subcategory_id`
- `label`
- `source`: `manual`, `receipt` oder `trackerverse`
- optionale externe Herkunfts-ID

Regeln:

- Summe der Aufteilungen entspricht exakt dem Betrag der Originalbuchung.
- Der Kontostand berücksichtigt nur die Originalbuchung.
- Kategorienanalysen verwenden Aufteilungen, sofern vorhanden.
- Manuelle Aufteilungen werden nicht ungefragt durch Familien-/Ähnlichkeitsänderungen überschrieben.
- Löschen und Ändern erfolgt konsistent mit Undo-Möglichkeit.
- Geldbeträge werden intern in Cent verarbeitet.

## 10. Vorbereitung auf Trackerverse und Kassenbonpositionen

Die bestehende Belegerkennung erfasst Händler, Datum und Gesamtsumme, aber noch keine einzelnen Produkte.

Die Architektur soll später ergänzen können:

- `Receipt`
- `ReceiptItem`
- Rohbezeichnung des Produkts
- normalisierte Produkt-ID oder Alias
- Menge
- Einzel- und Gesamtpreis
- Kategorie
- Erkennungswahrscheinlichkeit
- Importquelle und Schema-Version

Manuelle Transaktionsaufteilungen sind Kategoriezuordnungen. Kassenbonpositionen sind detailliertere Produktdaten und dürfen fachlich nicht gleichgesetzt werden. Belegpositionen können jedoch Aufteilungen erzeugen.

Für den Austausch mit Trackerverse ist ein versioniertes und verschlüsseltes Offlineformat vorzubereiten. Es benötigt stabile externe IDs, Schema-Version, Export-ID und Integritätsprüfung. Rohdaten dürfen bei einer späteren Produktnormalisierung nicht verloren gehen.

Produktempfehlung:

- manuelle Aufteilung als Basisfunktion,
- automatische Positionserkennung, Produktstatistik und Sparhinweise als Premiumfunktion.

## 11. Verträge und ähnliche Buchungen

### Erwartetes Verhalten

- Wird eine Buchung als Vertrag markiert, werden gleichwertige Buchungen derselben Familie erkannt.
- Die Vertragsübersicht zeigt den Vertrag nur einmal mit seiner Historie.
- Wird ein historischer Vertrag ausdrücklich als beendet oder nicht mehr vorhanden markiert, darf er durch alte Daten nicht erneut als aktueller potenzieller Vertrag erscheinen.
- Die Entscheidung muss dauerhaft gespeichert und bei späteren Imports berücksichtigt werden.
- Im Bearbeitungsdialog ist „Auf ähnliche Buchungen anwenden“ standardmäßig aktiv, kann aber vor dem Speichern deaktiviert werden.
- Die vollständige Buchungszeile öffnet das Detail-/Bearbeitungsfenster; kleine Links sind nicht das einzige Touch-Ziel.

### Audit-Finding

`filter-utils.ts` prüft beim Vertragsfilter teilweise noch Kategorieattribute statt des aktuellen Transaktions- und Entscheidungsmodells. Filter, Dashboard und Vertragsübersicht müssen dieselbe zentrale Vertragsauflösung verwenden.

### Notwendige Tests

- alter Vertrag aus 2023/2024, heute ausdrücklich beendet,
- erneuter Import derselben historischen Buchungen,
- neuer Vertrag mit ähnlichem Händler, aber anderem Betrag,
- manuell abgewählte Familienbearbeitung,
- Undo nach Familienänderung.

## 12. Premiumfreischaltung mit Alphacode

### Befund

`FeatureGate` und Tier-Struktur sind vorbereitet. Die aktuelle Ableitung stuft authentifizierte Nutzer jedoch nur als `free` ein; eine reale Premiumberechtigung entsteht nicht.

### Profilfunktion

Im Profil wird eine Sektion „Beta- & Premiumzugang“ ergänzt:

- maskiertes Codefeld,
- Aktion „Code einlösen“,
- Erfolgsmeldung,
- Alpha-Tester-Badge,
- Anzeige freigeschalteter Funktionen,
- generische Fehlermeldung bei ungültigem Code.

Der derzeitige Testcode lautet `alphatester`.

### Sicherheitsanforderung

Ein Klartextcode im Frontend ist nur als temporäre Alpha-Lösung zulässig, da er aus dem Bundle gelesen werden kann. Für benutzergebundene Freischaltung soll der Code serverseitig als Hash geprüft und danach eine Berechtigung für die Benutzer-ID gespeichert werden. Finanzdaten bleiben lokal; übertragen wird nur die minimale Berechtigungsinformation.

Falls die Freischaltung vollständig offline funktionieren muss, ist später ein signiertes Lizenz-Token zu verwenden. Kein geheimer Signierschlüssel darf in der App liegen.

## 13. Kategorienverwaltung

Listen-in-Listen-in-Listen vermeiden. Die Hauptansicht zeigt eine flache, scanbare Kategorienliste mit:

- Name,
- optionalem Elternhinweis,
- Anzahl zugeordneter Buchungen,
- kurzer Statusinformation,
- vollständiger antippbarer Zeile.

Anlegen, Umbenennen, Verschieben, Zusammenführen und erweiterte Regeln öffnen ein Dialog- oder Bottom-Sheet-Verfahren. Seltene Eigenschaften gehören nicht dauerhaft in jede Listenzeile.

Auf Mobile keine Drag-and-drop-Bedienung als einzige Möglichkeit anbieten. Zusätzlich müssen klare Aktionen wie „Verschieben nach …“ vorhanden sein.

## 14. Übergreifende UX-Regeln

- Eine Hauptaussage pro mobilem Screen.
- Keine horizontal scrollenden Karten- oder Chipreihen als Standardlösung.
- Erklärtexte über Info-Icon, Sheet oder Detailseite.
- Ganze Zeilen antippbar, nicht nur Textlinks.
- Touch-Ziele mindestens 44 × 44 px.
- Primäraktion pro Ansicht eindeutig.
- Progressive Disclosure statt dauerhafter Vollständigkeit.
- Kein Entwicklertext im Nutzerinterface.
- Charts müssen auch bei leeren Daten einen sinnvollen Zustand zeigen.
- Dialoge mobil als Bottom Sheets, auf Desktop als Dialoge.
- Fokusführung, Screenreader-Beschriftung und `prefers-reduced-motion` berücksichtigen.
- Keine wichtige Funktion ausschließlich über Farbe oder Gesten vermitteln.

## 15. Priorisierte Umsetzung

### P0 – kritisch

1. Nettovermögen mobil verdichten und Erklärungen in `InfoSheet` verschieben.
2. Finanzlandschaft mobil sichtbar machen.
3. Sunburst ohne horizontale Chipnavigation zugänglich machen.
4. Zeitraum- und Durchschnittsmodi in das aktive Dashboard konsolidieren.
5. `TransactionAllocation` einschließlich Invarianten und Tests definieren.
6. Vertragsfilter auf die zentrale Vertragsentscheidung umstellen.

### P1 – wichtig

1. Dashboard-Transaktionsliste durch eine gefilterte Vorschau ersetzen.
2. Filter per URL an die Buchungsseite übertragen.
3. „Heute für dich“ als Fokuskarte und 2×2-Statusraster umsetzen.
4. Alpha-Berechtigung und Codeeingabe im Profil implementieren.
5. Monatsvergleich sichtbar sperren und für Alpha-Tester freischalten.
6. Swipe-Navigation mit direkter Icon-Auswahl und Deep Links umsetzen.
7. Ganze Buchungszeilen als Touch-Ziel für Transaktionsdetails verwenden.

### P2 – Ausbau

1. Receipt- und ReceiptItem-Domänenmodell vorbereiten.
2. Verschlüsseltes, versioniertes Trackerverse-Austauschformat definieren.
3. Produktnormalisierung und Aliasmodell entwerfen.
4. Kritische Hook- und Typisierungswarnungen reduzieren.
5. Große PDF-, Chart- und Exportpakete weiter lazy-loaden.

### P3 – später

1. Automatische Produkt- und Preisanalysen.
2. Lokale Spartipps anhand wiederkehrender Produkte.
3. Erweiterte Animationen und Lottie-Statusübergänge.
4. Weitere Personalisierung der mobilen Finanzstory.

## 16. Vorgehen je Umsetzungspaket

Vor jeder Änderung:

1. Nur relevante Dateien gemäß Kontext-Landkarte laden.
2. Vorhandene Varianten, Tests, Feature Gates und gespeicherte Nutzerentscheidungen prüfen.
3. Kurz dokumentieren, welche bestehende Logik wiederverwendet wird.

Nach jeder Änderung:

1. Betroffene Unit- und Integrationstests ergänzen.
2. Mobile Ansichten mindestens bei 320, 375, 390 und 430 px prüfen.
3. Desktopansicht auf Regressionen prüfen.
4. Tastaturbedienung, Fokus und reduzierte Bewegung testen.
5. `pnpm build`, `pnpm lint` und `pnpm test -- --run` ausführen.
6. Keine bestehenden Nutzerentscheidungen oder lokalen Daten still migrieren oder löschen.

## 17. Abschlussbericht pro Paket

Berichte jeweils:

- umgesetztes Nutzerproblem,
- betroffene Dateien,
- wiederverwendete alte oder versteckte Logik,
- Datenmigrationen,
- Tests und Ergebnisse,
- offene Risiken,
- Screenshots der relevanten Mobile- und Desktopzustände,
- Rollback-Möglichkeit.

Keine große Sammeländerung ohne Zwischenprüfung erstellen. Zuerst P0 in fachlich getrennten Paketen bearbeiten.
