# Trackerverse — Datenzugriff zwischen Trackern

**Geltend (normativ).** Vorentschieden im Sinne von `AGENTS.md` §3: vor Arbeit an
einem zweiten Tracker (Meal, Fit, Car, Sleep, Mood, Wealth) zu lesen.

Beantwortet die Frage: Wie sieht ein zweiter Tracker mit **eigener lokaler
Datenbasis** Daten des Fintrackers — etwa „wie viel wurde diesen Monat bei Aldi
bezahlt" — und umgekehrt?

## 1. Was hier nicht verhandelbar ist

Fünf Tatsachen der Plattform, keine Entwurfsmeinungen. Jeder Entwurf, der eine
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
5. **Speicher in eingebetteten Fremdkontexten ist partitioniert.** Ein iframe
   sieht in aktuellen Browsern je einbettender Seite einen *eigenen* Speicher
   (Storage Partitioning). Ein „Hub-iframe als gemeinsame Datenhaltung" sieht
   unter `mealtracker.…` also nicht denselben Store wie unter `fintracker.…` —
   dieser Weg ist keine Grundlage, egal wie plausibel er klingt.

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
| **F5** | **Jede Antwort trägt einen Zustand** (§5), niemals eine Ausnahme und **niemals eine stille `0`** | Eine `0` aus einem gesperrten Vault liest sich als „du hast bei Aldi nichts bezahlt" |
| **F6** | **Handles schmuggeln keine Nutzdaten.** Der `merchantFingerprint` ist **nicht** opak: `iban:DE…\|out` enthält eine IBAN, `merchant:aldi\|out` einen Zahlungsempfänger. Über die Grenze geht nur der **normalisierte Händlername** (`normalizeMerchantName`) | Der Fragende nennt den Händler ohnehin selbst; Bankverbindungen darf er nicht als Nebenwirkung erfahren |
| **F7** | **Eingang wird validiert.** zod am Rand, Versionsprüfung, unbekannter Scope ⇒ Ablehnung statt Absturz; fremde Zeitstempel und IDs gelten nie als wahr | §1.4 |
| **F8** | **Der Transport ist ein Adapter, der Vertrag ist die Invariante.** Heute in-process; später ggf. IPC. Scope-Katalog, Zustände und Aufrufstellen ändern sich dabei **nicht** | Sonst hängt jede Konsumentenzeile an der Auslieferungsform |
| **F9** | **Der Hub vermittelt Fragen und hält keine Daten.** Er kennt die eingerichteten Tracker, den Scope-Katalog und die Freigaben — **keine** Datenbank, **kein** Schlüsselmaterial, **keinen** Zwischenspeicher von Antworten | Ein Hub, der Daten hält, ist die eine Stelle, deren Kompromittierung alles öffnet — und der einzige Ort, an dem „Daten löschen" plötzlich nicht mehr reicht |

Der Auflöser ist eine **pure Funktion mit übergebener Registry** — wie
`resolveEntityRef(ref, registry)`, kein globaler Singleton (`coding-guide.md`
§13).

## 3. Der Hub: Vermittlungsstelle, nicht Datenhaltung

Ein eigener Trackerverse-Hub ist die **richtige Form** für die Registry aus §2 —
aber nur, solange er *Fragen* vermittelt. Zwei Lesarten, die sich hart
unterscheiden:

| Lesart | Was der Hub tut | Urteil |
|---|---|---|
| **Hub bindet die Datenbanken aller Tracker ein** | öffnet fremde Stores, braucht deren Schlüssel, liefert selbst Daten aus | **verworfen** |
| **Hub kennt die Tracker und vermittelt Fragen** | führt das Verzeichnis eingerichteter Tracker + Freigaben, leitet die Frage an den Eigentümer, der aus seinem eigenen Store antwortet | **so wird es gebaut** |

Gegen die erste Lesart sprechen drei Dinge, die alle erst nach dem Bauen
schmerzen:

- Sie braucht das **Schlüsselmaterial jedes Trackers** an einem Ort. Genau das
  ist im Bedrohungsmodell als „kritisch" eingestuft, und §1.3 sagt, dass der
  Schlüssel die entsperrte Sitzung seines Eigentümers nicht verlässt.
- Sie macht **Löschen unvollständig.** Heute genügt „Daten löschen" in
  Fintracker. Mit einer zweiten Stelle, die die Daten ebenfalls hält, genügt es
  nicht mehr — und niemand sieht das der Oberfläche an.
- Auf getrennten Origins ist sie **technisch tot** (§1.5), auf einem gemeinsamen
  Origin ist sie **überflüssig**: dort ist jede Datenbank für jeden Code des
  Origins ohnehin erreichbar. Der Hub würde ein Problem lösen, das es entweder
  nicht gibt oder das er nicht lösen kann.

Was der Hub in der zweiten Lesart *wirklich* beiträgt — und was eine Bibliothek
in jeder App nicht kann:

1. **Ein Ort für die Freigaben.** „Wer darf was fragen" ist an einer Stelle
   sichtbar und widerrufbar, nicht in jeder App neu.
2. **Ein Ort für die Entdeckung.** Der Meal-Tracker fragt „gibt es eine Quelle
   für `spend.byMerchant`?" statt Fintracker namentlich zu kennen. Aus N×N
   Kopplungen werden N.
3. **Ein Ort für die Zustände.** Die fünf Antwortzustände aus §5 entstehen im
   Hub, nicht in jedem Konsumenten neu.

Deine Prüfung „ist die Fintracker-DB angebunden?" wird dabei zur Frage **„ist
für diesen Scope eine Quelle da, freigegeben und entsperrt?"** — das ist nicht
dieselbe Frage. Eine angebundene, aber gesperrte Quelle muss `gesperrt`
antworten, nicht `0`.

## 4. Auslieferungsform: ein Origin, getrennte Datenbanken

„Zwei Apps, zwei lokale Datenbasen" ist umsetzbar — aber nicht als zwei Origins.

**Empfehlung:** ein Origin, drei benannte IndexedDB-Datenbanken (zwei Tracker +
Hub-Verzeichnis), drei Modul-Shells unter einem Router-Basename (`/`, `/meal`,
`/hub`, §13). Der Hub ist damit eine eigene Fläche mit eigener Datenbasis — sie
enthält nur Freigaben und das Trackerverzeichnis, nie Finanz- oder Ernährungsdaten.

- `ausgabentracker` — bestehende DB, **unverändert**. Ein Umbenennen wäre eine
  Migration ohne Gegenwert.
- `mealtracker` — eigene DB, eigenes Backup, eigene Löschung, eigener Reset.
- `trackerverse-hub` — nur Trackerverzeichnis und Freigaben (F9). Ein Reset des
  Hubs entzieht alle Freigaben und verliert keine Nutzdaten, weil dort keine
  liegen.

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

## 5. Zustände einer Antwort (verbindlich)

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

## 6. Beide Richtungen — und warum die Rückrichtung die wertvollere ist

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

## 7. Scope-Katalog (erster Zuschnitt)

| Scope | Parameter | Ergebnis | Richtung |
|---|---|---|---|
| `spend.byMerchant.monthly` | `merchantHandle`, `from`, `to` | `amountMinor`, `count` | Fintracker → * |
| `spend.byCategory.monthly` | `categoryId`, `from`, `to` | `amountMinor`, `count` | Fintracker → * |
| `allocation.propose` | `transactionId`, `lines[]` | angenommen / abgelehnt + Grund | * → Fintracker |

Bewusst **nicht** enthalten: Rohbuchungen, Kontostände, Forecast, Schulden,
Vermögen. Jeder weitere Scope ist eine eigene Zustimmungsentscheidung und wächst
einzeln mit Begründung — nicht als „Vollzugriff", der sich nie wieder einfangen
lässt.

## 8. Slice-Folge

| Slice | Inhalt | Hängt ab von |
|---|---|---|
| **T0** | Vertrag: Scope-Typen, zod-Schemata, Zustände, `resolveScope(request, registry)` in `src/lib/trackerverse/` | — |
| **T1** | Anbieterseite `spend.byMerchant` aus dem bestehenden Store, Consent-Gate, Audit-Eintrag | T0 |
| **T2** | Hub-Fläche: Trackerverzeichnis, Freigaben je (Tracker × Scope, widerrufbar), Anbieter-Suche je Scope + die fünf Zustände je Fläche mit `[ZUSTAND]`-Tests | T1 |
| **T3** | Meal-Modul-Shell: eigene DB, eigene Routen, eigenes Backup/Löschen | T0 |
| **T4** | Rückrichtung `allocation.propose` mit Cent-Invariante und `source: 'trackerverse'` | T1, T3 |
| **T5** | Transport-Adapter für getrennte Installationen (entscheidungsgebunden, D1) | T2, D1 |

**T0 wird zusammen mit T1 geliefert, nicht vorab.** Eine Registry ohne
Konsumenten ist exakt das, was dieses Repo beim generischen Link-Table verworfen
hat (`entity-references.md`, „Verworfen"). Dieses Dokument plant Arbeit, es
implementiert nichts.

## 9. Offene Entscheidungen

| # | Frage | Empfehlung |
|---|---|---|
| **D1** | Eine Installation mit zwei Modulen oder zwei getrennte Installationen? | **Eine** — nur so gibt es lebende Abfragen (§4). Zwei Installationen sind möglich, kosten aber F8-Adapter und Nutzeraktion je Abfrage |
| **D2** | Ein Entsperren für alle Datenbanken oder je Tracker eine Passphrase? | **Ein Schlüssel, getrennte Stores.** Bei zwei Passphrasen dominiert der Zustand `gesperrt` den Alltag. Ehrlich dazu: auf einem gemeinsamen Origin erreicht ein XSS beide Datenbanken ohnehin — getrennte Schlüssel wären dort kein echter Schutz. Der Hub bekommt **keinen** von beiden (F9) |
| **D3** | Fließen Meal-Daten (Mahlzeiten, Gewicht) je nach Fintracker? | Nur über den Katalog aus §7, unter denselben Regeln. Gesundheitsdaten brauchen einen eigenen Scope, keine Erweiterung eines Ausgaben-Scopes |
| **D4** | Zwei Backups, zwei Wiederherstellungspunkte — was gilt nach asynchronem Restore? | Lesen ist durch F2 automatisch konsistent. Übernommene Aufteilungen (§6) bleiben und sind an ihrer Herkunft erkennbar |
