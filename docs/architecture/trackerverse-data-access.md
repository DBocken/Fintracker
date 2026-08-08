# Trackerverse — Datenzugriff zwischen Trackern

**Geltend (normativ).** Vorentschieden im Sinne von `AGENTS.md` §3: vor Arbeit an
einem zweiten Tracker (Meal, Fit, Car, Sleep, Mood, Wealth) zu lesen.

Beantwortet die Frage: Wie sieht ein zweiter Tracker mit **eigener lokaler
Datenbasis** Daten des Fintrackers — etwa „wie viel wurde diesen Monat bei Aldi
bezahlt" — und umgekehrt?

## 1. Was hier nicht verhandelbar ist

Vier Tatsachen der Plattform, keine Entwurfsmeinungen. Jeder Entwurf, der eine
davon ignoriert, funktioniert nicht:

1. **IndexedDB ist origin-gebunden.** Zwei Apps auf *verschiedenen* Origins haben
   null Zugriff aufeinander — dauerhaft, ohne Ausnahme. Ein Origin kann dagegen
   beliebig viele *benannte* Datenbanken halten.
2. **Zwei Android-Pakete sind zwei Sandboxes.** Zugriff nur über ausdrückliche
   OS-IPC mit Nutzeraktion, nie beiläufig.
3. **Der Vault-Schlüssel existiert nur in der entsperrten Sitzung**
   (`LocalEncryptionLockedError`, `src/services/local-crypto.ts`). Ein fremder
   Tracker kann den Store ohne Schlüssel nicht lesen — und darf ihn nie bekommen.
4. **Trackerverse-Inhalte gelten als nicht vertrauenswürdig** — bereits
   festgeschrieben in `docs/security-boundaries.md` und
   `docs/security/threat-model.md` (Ziel 4).

## 2. Die Entscheidung: ein Vertrag, kein gemeinsamer Speicher

Ein Tracker greift **nie** auf den Speicher eines anderen zu. Er stellt eine
**Frage aus einem festen Katalog** und erhält eine **Aggregat-Antwort**. Das ist
dasselbe Prinzip, das `docs/architecture/entity-references.md` für Verweise
festgelegt hat, angewandt auf App-Grenzen.

| # | Regel | Warum |
|---|---|---|
| **F1** | **Kein Fremdzugriff auf Speicher.** `idbGet`/`local-finance-store` bleiben modulintern; kein Tracker öffnet die DB oder das Schlüsselmaterial eines anderen | Sonst ist die Trennung der Datenbasen nur Kosmetik |
| **F2** | **Keine Kopien.** Jede Antwort wird zum Zeitpunkt der Frage aus den lebenden Daten des Eigentümers berechnet | Eine Kopie überlebt Löschung, Widerruf und Restore der Gegenseite — cross-App gibt es keine ehrliche Invalidierung |
| **F3** | **Nur Aggregate und stabile Handles, nie Datensätze.** `{ amountMinor, count }` — kein `payee`, `original_text`, `description`, keine IBAN, kein Konto | Gleiche Grenze, die `local-data-boundary.security.test.ts` für den MCP-Pfad schon erzwingt |
| **F4** | **Der Scope ist die Einheit der Zustimmung.** Freigabe je (fragender Tracker × Scope), standardmäßig **aus**, widerrufbar, im Audit-Log | „App darf auf Finanzdaten zugreifen" ist keine Entscheidung, die jemand treffen kann |
| **F5** | **Jede Antwort trägt einen Zustand** (§4), niemals eine Ausnahme und **niemals eine stille `0`** | Eine `0` aus einem gesperrten Vault liest sich als „du hast bei Aldi nichts bezahlt" |
| **F6** | **Handles schmuggeln keine Nutzdaten.** Der `merchantFingerprint` ist **nicht** opak: `iban:DE…\|out` enthält eine IBAN, `merchant:aldi\|out` einen Zahlungsempfänger. Über die Grenze geht nur der **normalisierte Händlername** (`normalizeMerchantName`) | Der Fragende nennt den Händler ohnehin selbst; Bankverbindungen darf er nicht als Nebenwirkung erfahren |
| **F7** | **Eingang wird validiert.** zod am Rand, Versionsprüfung, unbekannter Scope ⇒ Ablehnung statt Absturz; fremde Zeitstempel und IDs gelten nie als wahr | §1.4 |
| **F8** | **Der Transport ist ein Adapter, der Vertrag ist die Invariante.** Heute in-process; später ggf. IPC. Scope-Katalog, Zustände und Aufrufstellen ändern sich dabei **nicht** | Sonst hängt jede Konsumentenzeile an der Auslieferungsform |

Der Auflöser ist eine **pure Funktion mit übergebener Registry** — wie
`resolveEntityRef(ref, registry)`, kein globaler Singleton (`coding-guide.md`
§13).

## 3. Auslieferungsform: ein Origin, zwei Datenbanken

„Zwei Apps, zwei lokale Datenbasen" ist umsetzbar — aber nicht als zwei Origins.

**Empfehlung:** ein Origin, zwei benannte IndexedDB-Datenbanken, zwei
Modul-Shells unter einem Router-Basename (`/` und `/meal`, §13).

- `ausgabentracker` — bestehende DB, **unverändert**. Ein Umbenennen wäre eine
  Migration ohne Gegenwert.
- `mealtracker` — eigene DB, eigenes Backup, eigene Löschung, eigener Reset.

Damit sind die Datenbasen getrennt (Löschen, Sichern, Wiederherstellen je Tracker),
und der einzige Mechanismus, der im Browser überhaupt funktionieren kann, bleibt
verfügbar.

| Verworfen | Grund |
|---|---|
| Eine DB, Keys pro Modul genamespaced | Koppelt Löschung, Backup und Verschlüsselung fachlich unverwandter Domänen; widerspricht der Vorgabe getrennter Datenbasen |
| Zwei Origins | Tötet die Fähigkeit an der Wurzel — es bliebe nur Datei-Export, also keine lebenden Abfragen (F2) |
| Gemeinsamer Vault-Schlüssel *plus* gemeinsame DB | Ein kompromittiertes Modul exponiert alles, ohne dass die Trennung etwas zurückgibt |

**Android:** eine Capacitor-Shell mit beiden Modulen erhält dieses Modell. Zwei
getrennte APKs degradieren den Mechanismus auf den IPC-Adapter aus F8 — das ist
eine Produktentscheidung und muss **vor** dem ersten Meal-Slice fallen, weil sie
bestimmt, ob es lebende Abfragen überhaupt gibt.

## 4. Zustände einer Antwort (verbindlich)

Fünf Zustände, in der Oberfläche unterscheidbar — genau die Verwechslung, an der
`/debts` nach einem Lesefehler „Noch keine Schulden" behauptet hat
(`pnpm check:state-coverage`):

| Zustand | Bedeutung | Was die Fläche sagt |
|---|---|---|
| `verfuegbar` | Antwort liegt vor | die Zahl |
| `nicht_freigegeben` | kein Consent für (Tracker × Scope) | „nicht freigegeben" + Weg zur Freigabe |
| `gesperrt` | Quelle vorhanden, Vault zu | „gesperrt" + Weg zum Entsperren |
| `nicht_vorhanden` | Quell-Tracker nicht eingerichtet | „nicht eingerichtet" |
| `unlesbar` | Lese-/Validierungsfehler | Fehler benennen — **nie** als „keine Daten" |

Pflicht je konsumierender Fläche: `[ZUSTAND /route:leer]` **und**
`[ZUSTAND /route:fehler]` (`AGENTS.md` §5).

## 5. Beide Richtungen — und warum die Rückrichtung die wertvollere ist

Die Frage „wie viel bei Aldi" ist für einen Meal-Tracker die **schwächere**
Hälfte: Aldi verkauft auch Waschmittel. Ein Händlerbetrag ist kein
Lebensmittelbetrag.

Fintracker modelliert das Richtige bereits: `TransactionAllocation`
(`src/types.ts`) teilt eine Buchung cent-genau auf Kategorien auf — und
`AllocationSource` enthält **heute schon** `'trackerverse'` mit
`external_origin_id`, ohne Konsument. Das ist der reservierte Platz für genau
diesen Fall.

| Richtung | Inhalt | Charakter |
|---|---|---|
| Fintracker → Meal | Aggregate je Händler/Kategorie/Monat | **Lesen** — live, ohne Kopie (F2) |
| Meal → Fintracker | der Warenkorb als Aufteilungsvorschlag (`source: 'trackerverse'`) | **Schreiben** — Fintracker übernimmt und besitzt danach |

Die Rückrichtung liefert, was aus einem Bankumsatz nicht ableitbar ist:
Lebensmittel-Genauigkeit in der Kategorie-Analyse.

**Der scharfe Unterschied, jetzt zu entscheiden:** *Lesen* ist live und endet mit
dem Widerruf. Ein *übernommener* Aufteilungsvorschlag ist danach Fintrackers
eigene, finanzwirksame Daten — mit festgehaltener Herkunft, aber ohne
Kaskade. Das Löschen des Meal-Trackers verändert die Ausgabenanalyse **nicht**
rückwirkend (Dangling-Toleranz statt Kaskadenzwang,
`docs/architecture/entity-references.md`).

Ein Vorschlag, dessen Teilbeträge nicht exakt dem Buchungsbetrag entsprechen,
wird **abgelehnt** — nicht still korrigiert (Invariante in `src/types.ts`,
Geldregeln `AGENTS.md` §8).

## 6. Scope-Katalog (erster Zuschnitt)

| Scope | Parameter | Ergebnis | Richtung |
|---|---|---|---|
| `spend.byMerchant.monthly` | `merchantHandle`, `from`, `to` | `amountMinor`, `count` | Fintracker → * |
| `spend.byCategory.monthly` | `categoryId`, `from`, `to` | `amountMinor`, `count` | Fintracker → * |
| `allocation.propose` | `transactionId`, `lines[]` | angenommen / abgelehnt + Grund | * → Fintracker |

Bewusst **nicht** enthalten: Rohbuchungen, Kontostände, Forecast, Schulden,
Vermögen. Jeder weitere Scope ist eine eigene Zustimmungsentscheidung und wächst
einzeln mit Begründung — nicht als „Vollzugriff", der sich nie wieder einfangen
lässt.

## 7. Slice-Folge

| Slice | Inhalt | Hängt ab von |
|---|---|---|
| **T0** | Vertrag: Scope-Typen, zod-Schemata, Zustände, `resolveScope(request, registry)` in `src/lib/trackerverse/` | — |
| **T1** | Anbieterseite `spend.byMerchant` aus dem bestehenden Store, Consent-Gate, Audit-Eintrag | T0 |
| **T2** | Freigabe-Oberfläche (Tracker × Scope, widerrufbar) + die fünf Zustände je Fläche mit `[ZUSTAND]`-Tests | T1 |
| **T3** | Meal-Modul-Shell: eigene DB, eigene Routen, eigenes Backup/Löschen | T0 |
| **T4** | Rückrichtung `allocation.propose` mit Cent-Invariante und `source: 'trackerverse'` | T1, T3 |
| **T5** | Transport-Adapter für getrennte Installationen (entscheidungsgebunden, D1) | T2, D1 |

**T0 wird zusammen mit T1 geliefert, nicht vorab.** Eine Registry ohne
Konsumenten ist exakt das, was dieses Repo beim generischen Link-Table verworfen
hat (`entity-references.md`, „Verworfen"). Dieses Dokument plant Arbeit, es
implementiert nichts.

## 8. Offene Entscheidungen

| # | Frage | Empfehlung |
|---|---|---|
| **D1** | Eine Installation mit zwei Modulen oder zwei getrennte Installationen? | **Eine** — nur so gibt es lebende Abfragen (§3). Zwei Installationen sind möglich, kosten aber F8-Adapter und Nutzeraktion je Abfrage |
| **D2** | Ein Entsperren für beide Datenbanken oder je Tracker eine Passphrase? | **Ein Schlüssel, zwei Stores.** Bei zwei Passphrasen dominiert der Zustand `gesperrt` den Alltag. Ehrlich dazu: auf einem gemeinsamen Origin erreicht ein XSS beide Datenbanken ohnehin — getrennte Schlüssel wären dort kein echter Schutz |
| **D3** | Fließen Meal-Daten (Mahlzeiten, Gewicht) je nach Fintracker? | Nur über den Katalog aus §6, unter denselben Regeln. Gesundheitsdaten brauchen einen eigenen Scope, keine Erweiterung eines Ausgaben-Scopes |
| **D4** | Zwei Backups, zwei Wiederherstellungspunkte — was gilt nach asynchronem Restore? | Lesen ist durch F2 automatisch konsistent. Übernommene Aufteilungen (§5) bleiben und sind an ihrer Herkunft erkennbar |
