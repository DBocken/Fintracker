# Transaktionsablage: Quartals-Chunks statt einem Blob

Status: verbindliche Konvention (ADR). Entschieden 2026-08-09 im Rahmen des
Qualitätsprogramms 10/10, Arbeitspaket 4.1 (Befund PERF-1 in
`docs/qualitaet-2026-08/audit.md`).

## Kontext

Der gesamte Transaktionsbestand lag bis WP 4.1 als **ein** Wert unter dem Schlüssel
`ausgabentracker_transactions_v3` — bei aktivierter Verschlüsselung als ein
einziger AES-GCM-Envelope (`transaction-storage-service.ts`,
`local-crypto.ts`). Jede Einzeländerung — eine Kategorie zuweisen, einen Betrag
korrigieren, eine Buchung löschen — löst deshalb die volle Kette über den
**Gesamtbestand** aus: entschlüsseln, parsen, ein Element ändern,
serialisieren, verschlüsseln, schreiben. Produktseitig sind 5 000 Buchungen
vorgesehen (`FINANCE_TRANSACTION_LIMIT`), und die Kette läuft synchron im Pfad
einer Nutzeraktion.

Das ist der Befund. Was bei der Vorbereitung dazukam und den Entwurf
tatsächlich bestimmt hat, steht nicht im Audit:

**Der Bestand wird überwiegend vollständig gelesen, nicht ausschnittsweise.**
`getTransactions()` hat 53 Aufrufstellen; Backup, Analytics, Coach, Budget und
der MCP-Sync rufen es mit Limit 10 000, also „alles". Selbst
`getTransactionsPaginated()` — dem Namen nach der ausschnittsweise Leser — holt
intern den kompletten Bestand und filtert im Speicher
(`transaction-service.ts:104`). Der Eigenkommentar „KEIN Storage-Level-Paging"
war also nie eine Lücke, sondern eine zutreffende Beschreibung.

Daraus folgt eine Konsequenz, die der Auftrag nicht nennt und die den Umbau
sonst zum Eigentor macht: **Chunking verbilligt das Schreiben und verteuert das
kalte Vollesen.** Statt eines Entschlüsselungsvorgangs über viele Bytes stehen
dann viele Vorgänge über je wenige Bytes. Die AES-Arbeit bleibt in Summe
ähnlich, der Aufruf-Overhead vervielfacht sich. Ein Umbau, der nur die
Schreibseite betrachtet, verlagert die Kosten, statt sie zu senken.

## Entscheidung

**Quartals-Chunks, plus ein Index, plus ein Chunk-Cache im Service.** Die drei
gehören zusammen; einzeln löst keines das Problem.

Der Auftrag gab **Monats**-Chunks vor. Die Messung unten hat das widerlegt —
nicht die Chunk-Idee, sondern ihre Körnung. Das ist der einzige Grund, aus dem
eine Vorentscheidung hier revidiert wird: neue Fakten, nicht neuer Geschmack.
Die Begründung der Vorentscheidung („nicht je Eintrag, sonst 5 000
Krypto-Vorgänge") bleibt vollständig gültig; das Quartal liegt in derselben
Familie und erfüllt sie besser als der Monat.

### Schlüsselschema

| Zweck | Schlüssel |
|---|---|
| Ein Quartal | `ausgabentracker_transactions_v4_YYYY-Qn` |
| Index | `ausgabentracker_transactions_v4_index` |
| Altbestand (bleibt bis zur Migration) | `ausgabentracker_transactions_v3` |

Die Zuordnung ergibt sich aus `Transaction.date` (ISO-Datum, `YYYY-MM-DD`):
Jahr aus den ersten vier Zeichen, Quartal aus dem Monat. Buchungen ohne
verwertbares Datum kommen in einen festen Chunk `unknown`; sie verschwinden
damit nicht, und die Zuordnung ist nicht von einer Zeitzonenrechnung abhängig.

Der Index trägt die vorhandenen Quartalsschlüssel und je Quartal die Anzahl. Er ist
**Wegweiser, nicht Wahrheit**: Findet ein Leser einen im Index genannten Chunk
nicht, ist das ein Fehler und keine Leerliste (dieselbe Regel wie RES-1 in
WP 1.1). Umgekehrt darf der Index nie ein Datum enthalten, das nicht auch im
Chunk steht — er wird deshalb nie aus dem Index heraus fortgeschrieben, sondern
immer aus den geschriebenen Chunks abgeleitet.

### Chunk-Cache

Der Service hält die entschlüsselten Chunks in einer `Map<Quartal,
Transaction[]>`. Ein Schreibvorgang verwirft **genau das betroffene Quartal**,
nicht die ganze Karte. Damit gilt:

| Vorgang | heute | nach dem Umbau |
|---|---|---|
| Einzeländerung | Krypto über den Gesamtbestand | Krypto über ein Quartal |
| Vollesen, kalt | 1 Vorgang über alles | N Vorgänge über je ein Quartal |
| Vollesen, warm (Folgeaufruf) | 1 Vorgang über alles | **0 Vorgänge** |
| Vollesen nach einer Einzeländerung | 1 Vorgang über alles | **1 Vorgang** (nur das geänderte Quartal) |

Die letzte Zeile ist der eigentliche Gewinn und der Grund, warum der Cache
nicht optional ist: Der reale Ablauf ist nicht „einmal alles lesen", sondern
„alles lesen, etwas ändern, alles neu lesen" — und genau dort fällt die Arbeit
von *gesamter Bestand* auf *ein Quartal*.

Der Cache lebt im Service-Modul und ist an den Entsperrzustand gebunden: Beim
`lock()` (auch dem automatischen aus WP 3.2) wird er verworfen. Ein
entschlüsselter Bestand darf einen Lock nicht überleben — sonst wäre der
Auto-Lock aus WP 3.2 eine Anzeige ohne Wirkung, also genau die Fehlerklasse,
die `nachpruefung.md` 3.b beschreibt.

### Der Index bestimmt die Zählung, nicht die Menge

Nachgetragen am 2026-08-09 aus WP 4.1b, weil die dortige Reihenfolge-Entscheidung
sonst zwischen zwei Paketen verloren geht.

Beim einzelnen Schreibvorgang gilt dieselbe Disziplin wie bei der Migration:
**Chunk zuerst, Index zuletzt.** Die umgekehrte Reihenfolge erzeugt genau den
RES-1-Fall (ein im Index genannter Chunk, den es nicht gibt). Der Preis dieser
Reihenfolge ist der spiegelbildliche Zustand: Bricht der Vorgang dazwischen ab,
existiert ein Chunk, den der Index **nicht** nennt.

Für das Lesen eines einzelnen Quartals ist das harmlos — es wird direkt
adressiert und gefunden. **Für das Vollesen ist es das nicht:** Wer die Menge
der vorhandenen Chunks aus dem Index ableitet, überspringt diesen Chunk, und
seine Buchungen verschwinden lautlos aus `getTransactions()`. Das wäre
derselbe stille Verlust, gegen den WP 1.1 angetreten ist — nur eine Ebene
höher.

Deshalb verbindlich: **Die Menge der vorhandenen Chunks wird durch Aufzählung
der Ablage-Schlüssel bestimmt (`idbKeys()`, Präfix
`ausgabentracker_transactions_v4_`), nicht aus dem Index.** Der Index liefert
Zählungen und dient der RES-1-Prüfung beim gezielten Einzellesen; er ist keine
Bestandsliste. Ein Chunk ohne Index-Eintrag wird beim Vollesen mitgelesen und
der Index dabei berichtigt.

### Fassade bleibt

Der Umbau findet vollständig hinter `transactionStorage` statt. Die 53
Aufrufstellen von `getTransactions()` ändern sich nicht — weder Signatur noch
Verhalten. Wer heute alles liest, liest weiterhin alles; er bezahlt es nur
anders.

### Migration

Als **nummerierter Schritt im Läufer aus WP 1.3**
(`local-store-migrations.ts` — der Schritt
`transactions-blob-to-quarter-chunks` ist dort inzwischen der erste Eintrag
der Schrittliste), nicht als Lazy-Migration beim ersten Lesen. Ablauf:

1. v3-Blob lesen und validieren (Schemata aus WP 1.2).
2. Nach Quartal gruppieren, Chunks **einzeln** schreiben.
3. **Zuletzt** den Index schreiben, danach den v3-Schlüssel entfernen.

Die Reihenfolge ist dieselbe Disziplin wie beim Rewrap in WP 3.1: Der Zeiger,
der bestimmt, welche Ablage gilt, wird als Letztes umgelegt. Bricht der Lauf
vorher ab, ist der v3-Blob unverändert die Wahrheit und der nächste Start
beginnt von vorn; halb geschriebene Chunks werden dabei überschrieben, nicht
gelesen. Ein Crash-Test nach dem Vorbild von
`local-crypto.migration-crash.test.ts` belegt das.

### Backup, Sync, Export

Unverändert im Format. Alle drei arbeiten über `getTransactions()` und sehen
weiterhin eine flache Liste; das Backup-Format bleibt eine
`transactions`-Liste. Es gibt ausdrücklich **kein** Chunk-Format im Backup — ein
Backup soll auch dann lesbar sein, wenn die interne Ablage sich wieder ändert.

## Verworfene Alternativen

**Ein Eintrag je Buchung.** Bei 5 000 Buchungen bedeutet das 5 000
Krypto-Vorgänge je Vollexport und je Import. Der Schreibvorteil wäre maximal,
der Lesenachteil aber ebenso — und Vollesen ist, wie oben gemessen, der
Normalfall. Verworfen aus demselben Grund, aus dem der Cache Pflicht ist.

**Alles lassen wie es ist.** Vertretbar wäre das nur, wenn Einzeländerungen
selten wären. Sie sind der häufigste Schreibvorgang der App (Kategorisieren
ist die Kernarbeit nach jedem Import).

**Chunk-Größe „Monat" (die ursprüngliche Vorgabe).** Gemessen und verworfen,
siehe unten: der Monat kauft einen kleinen zusätzlichen Schreibvorteil mit
einem dreifachen kalten Lesenachteil.

**Chunk-Größe „Jahr".** Kaltes Vollesen praktisch gratis, aber bei einem
Bestand über drei Jahre ist eine Einzeländerung nur noch **2×** schneller
statt 12× — und die Einzeländerung ist der Grund, aus dem dieser Umbau
überhaupt stattfindet.

## Die Messung, die die Körnung entschieden hat

Gemessen am 2026-08-09 mit WebCrypto (AES-GCM-256, dieselbe Primitive wie
`local-crypto.ts`), 5 000 Buchungen realistischer Form, je 20 Durchläufe.
Zwei Bestände: einer über drei Jahre, einer über neun.

**5 000 Buchungen über 3 Jahre** (heute: Einzeländerung 14,2 ms, kaltes
Vollesen 6,8 ms):

| Körnung | Chunks | Einzeländerung | kaltes Vollesen |
|---|---|---|---|
| Monat | 36 | 0,6 ms (22× schneller) | 12,0 ms (**1,76×**) |
| **Quartal** | 12 | 1,2 ms (12× schneller) | 8,8 ms (**1,29×**) |
| Jahr | 3 | 7,5 ms (2× schneller) | 7,5 ms (1,11×) |

**5 000 Buchungen über 9 Jahre** (heute: 13,6 ms / 7,8 ms):

| Körnung | Chunks | Einzeländerung | kaltes Vollesen |
|---|---|---|---|
| Monat | 108 | 0,4 ms (37× schneller) | 22,1 ms (**2,84×**) |
| **Quartal** | 36 | 0,5 ms (27× schneller) | 11,7 ms (**1,50×**) |
| Jahr | 9 | 1,4 ms (10× schneller) | 7,7 ms (0,98×) |

Der Monat reißt die Grenze in **beiden** Beständen — bei neun Jahren fast
dreifach. Das Quartal bleibt in beiden innerhalb und behält 12–27× auf der
Einzeländerung; gegenüber dem Monat kostet es beim Schreiben 0,1 bis 0,6 ms
und spart beim kalten Lesen 3 bis 10 ms.

Dass der Unterschied zwischen Monat und Quartal beim Schreiben so klein ist,
hat einen Grund: Bei diesen Größen dominiert nicht die AES-Arbeit, sondern der
Aufruf-Overhead je Vorgang. Genau deshalb ist „mehr Chunks" beim Lesen teuer
und beim Schreiben kaum billiger — die Kurve ist nicht symmetrisch.

## Wonach der Umbau zu beurteilen ist

WP 4.1c **hat dieselben drei Zahlen belegt**, gemessen am echten Service statt
an dieser Simulation, bei 5 000 Buchungen und aktivierter Verschlüsselung —
dauerhaft festgenagelt in
`src/services/__tests__/transaction-storage-service.perf.test.ts`, das die
1,5×-Grenze für das kalte Vollesen als Assertion führt:

1. Dauer **einer Einzeländerung**. Ziel: unabhängig von der Gesamtzahl, nur
   von der Größe des betroffenen Quartals abhängig.
2. Dauer eines **kalten Vollesens**. Sie darf steigen, aber **nicht um mehr
   als die Hälfte**. Reißt sie die Grenze auch beim Quartal, ist die Körnung
   erneut zu prüfen und diese ADR zu korrigieren — nicht der Messwert
   wegzuerklären.
3. Dauer eines **Vollesens direkt nach einer Einzeländerung**. Das ist der
   reale Ablauf, und hier muss der Gewinn sichtbar werden.

Eine Messung, die nur (1) zeigt, ist unvollständig: Sie belegt die
Verbesserung und verschweigt ihren Preis. Die Simulation oben sagt für (3)
etwa 0,2 ms voraus — wenn der echte Service davon weit abweicht, ist der
Cache nicht wirksam.
