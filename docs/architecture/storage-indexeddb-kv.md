# Lokale Ablage: IndexedDB als Key-Value-Speicher, keine relationale Datenbank

Status: verbindliche Konvention (ADR). **Entscheidung getroffen ca. Juni 2026**
(Issue #29, im Code als solches vermerkt: `src/services/idb-kv.ts` Kopf,
`src/services/local-crypto.ts:5-9`); die Git-Historie dieses Repos beginnt am
2026-07-05 und enthält den Umstellungs-Commit nicht mehr, ein genaues Datum ist
daraus nicht rekonstruierbar. **Dokumentiert als ADR am 2026-08-09** im Rahmen
des Qualitätsprogramms 10/10, Arbeitspaket 7.5 (Befund GOV-4 in
`docs/qualitaet-2026-08/audit.md`).

Verwandt: `docs/architecture/transaction-storage-chunks.md` (wie der größte
Wert in dieser Ablage aufgeteilt wird), `docs/security-boundaries.md`
(Datenhaltung), `AGENTS.md` §1 und §7 (I/O-Regel).

## Kontext

Fintracker ist local-first: der Finanzbestand liegt auf dem Gerät, optional
AES-GCM-verschlüsselt, und Supabase ist nur für Auth und ausdrückliche
Opt-in-Features zuständig (`AGENTS.md` §1). Die App braucht dafür einen lokalen
Speicher, der (a) mehr als ein paar Megabyte trägt, (b) einen verschlüsselten
Wert unverändert wieder herausgibt und (c) im Browser **und** in der
Capacitor-WebView auf Android derselbe ist.

Der Ausgangspunkt war `localStorage`: synchron, ~5 MB hart begrenzt, anfällig
für Browser-Eviction und bei tausenden Buchungen spürbar langsam. Der Umbau
(Issue #29) hat die Bulk-Daten nach IndexedDB verlegt und die kleinen
Konfigurationsschlüssel (Verschlüsselungs-Config, Anonym-Flag, `device_id`,
UI-Caches) bewusst in `localStorage` gelassen.

Zwei Eigenschaften des Bestands haben die Form der neuen Ablage bestimmt:

- **Der Wert ist ein verschlüsselter Blob.** Bei aktiver lokaler Verschlüsselung
  liegt in der Ablage ausschließlich ein AES-GCM-Envelope
  (`docs/security-boundaries.md`, „Datenhaltung"). Ein Speicher, der über den
  Inhalt indizieren möchte, sieht dort Rauschen.
- **Gelesen wird überwiegend alles.** `getTransactions()` hat 53 Aufrufstellen,
  und selbst `getTransactionsPaginated()` holt intern den kompletten Bestand und
  filtert im Speicher (gemessen und belegt in
  `docs/architecture/transaction-storage-chunks.md`).

## Entscheidung

**Ein einziger IndexedDB-Objektspeicher als Key-Value-Ablage, roh, ohne
Bibliothek.**

| Eigenschaft | Wert |
|---|---|
| Datenbank | `ausgabentracker`, Version 1 (`src/services/idb-kv.ts:16-18`) |
| Objektspeicher | genau einer: `kv`, ohne Indizes |
| Schlüssel | die Kollektionsschlüssel aus `LOCAL_FINANCE_KEYS` (heute **30**, `src/services/local-storage-keys.ts:10-41`) plus die Transaktions-Chunks |
| Wert | ein fertiger JSON-String — Klartext **oder** AES-GCM-Envelope |
| API | `idbGet`/`idbSet`/`idbRemove`/`idbKeys`/`clearLocalKvStore` |
| Abhängigkeiten | keine (`idb`, `idb-keyval`, `Dexie` sind nicht im Baum) |

Die Verschlüsselungsschicht (`local-crypto.ts`) liegt unverändert **davor**: sie
bekommt einen String und gibt einen String zurück. Der KV-Speicher weiß nicht,
ob er Klartext oder Chiffrat hält — und muss es nicht wissen.

## Verworfene Alternativen

**`localStorage` als Primärspeicher (der Vorzustand).** Verworfen wegen der
~5-MB-Grenze, der Browser-Eviction und der Performance bei tausenden
Transaktionen — so im Code dokumentiert (`idb-kv.ts:5-13`). Die Migration ist
verifizierend gebaut: jeder Wert wird nach dem Schreiben zurückgelesen und die
`localStorage`-Kopie erst danach gelöscht (`migrateLocalStorageToIdb`).

**SQLite (WASM im Browser bzw. `@capacitor-community/sqlite` auf Android).**
*Diese Alternative ist im Repo nirgends schriftlich abgewogen* — die
Gegenüberstellung „IndexedDB-KV statt SQLite" stammt aus dem Auftrag zu WP 7.5
(`docs/qualitaet-2026-08/plan.md`). Die Gründe unten sind daher **rekonstruiert**
aus dem, was der Code tut, nicht aus einer damaligen Notiz:

1. *Der Hauptvorteil entfällt genau im Normalbetrieb.* Der Gewinn einer
   relationalen Ablage ist die Abfrage über Indizes. Über einem AES-GCM-Envelope
   gibt es nichts zu indizieren; man müsste entweder unverschlüsselt speichern
   (widerspricht `docs/security-boundaries.md`) oder feldweise verschlüsseln
   (und damit jede Abfrage wieder verlieren).
2. *Das Zugriffsmuster verlangt keine Abfragen.* Vollesen ist der Normalfall
   (53 Aufrufstellen, siehe oben) — die App braucht einen schnellen
   Blob-Transport, keine Abfragesprache.
3. *Bundle-Kosten.* SQLite im Browser heißt ein WASM-Artefakt in der
   Größenordnung mehrerer hundert Kilobyte, gegen ein Bündelbudget, das schon
   auf 9 kB zusätzliches zod reagiert (`docs/qualitaet-2026-08/nachpruefung.md`
   2.a). Der KV-Speicher kostet null Bytes Abhängigkeit — „bewusst ohne externe
   Abhängigkeit (rohes IndexedDB)" ist die einzige Begründung, die im Code
   selbst steht.
4. *Zwei Laufzeiten, eine Ablage.* IndexedDB ist im Browser und in der
   Capacitor-WebView dieselbe API; eine native SQLite-Anbindung wäre auf Android
   ein zweiter Speicherpfad neben dem Web-Pfad.

**IndexedDB mit echten Objektspeichern und Indizes je Entität.** Verworfen aus
Grund 1 und 2 derselben Liste: die Indizes wären im verschlüsselten Betrieb
wertlos, und der Preis wäre ein Schema pro Entität statt eines Schlüssels pro
Kollektion. *Rekonstruiert.*

## Preis

1. **Es gibt keine Abfragen.** Jede Filterung, Sortierung und Aggregation läuft
   im Speicher über den geladenen Gesamtbestand. Genau daraus ist PERF-1
   entstanden: eine Einzeländerung kostete die volle Krypto-Kette über den
   *Gesamtbestand*, und die Antwort darauf konnte kein Index sein, sondern
   Quartals-Chunks plus Cache (`transaction-storage-chunks.md`).
2. **Es gibt keine Transaktionsklammer über Kollektionen.** Ein Schreibvorgang
   deckt genau einen Schlüssel ab. Alles, was zwei Schlüssel betrifft, braucht
   eine Reihenfolge-Disziplin statt eines Commits — nachlesbar an der Regel
   „Chunk zuerst, Index zuletzt" und ihrem ausdrücklich benannten
   Halbzustand (`transaction-storage-chunks.md`).
3. **Referenzintegrität ist Handarbeit.** Es gibt keine Fremdschlüssel und kein
   `ON DELETE`. Deshalb ist die Verweiskonvention dangling-tolerant gebaut: ein
   gelöschtes Ziel liefert `{ status: 'missing' }` statt einer Ausnahme
   (`docs/architecture/entity-references.md`, Regel 2).
4. **Schemawanderung ist Handarbeit.** Statt SQL-Migrationen gibt es eine
   Versionsnummer plus einen nummerierten Läufer
   (`LOCAL_STORE_SCHEMA_VERSION`, `local-store-migrations.ts`) und eine
   Kompatibilitätsprüfung vor **jedem** Zugriff, weil ein Rollback zwischen zwei
   Besuchen passiert und nicht beim Start (`local-finance-store.ts:28-40`).
5. **Die Validierung muss die Datenbank ersetzen.** Ein KV-Speicher gibt zurück,
   was man hineingelegt hat — auch Müll. Deshalb liegt an jeder Lesegrenze ein
   zod-Schema (`COLLECTION_SCHEMAS`, `src/lib/schemas/collection-schemas.ts`),
   und dieser Schutz kostet messbar Startbündel: die erste eingelöste
   Datengrenze hat `check:bundle-size` rot gemacht
   (`docs/qualitaet-2026-08/nachpruefung.md` 2.a).
6. **Die Größe ist gedeckelt.** `FINANCE_TRANSACTION_LIMIT = 5000`
   (`src/features/shared/data/finance-query-keys.ts:22`) ist die Zahl, gegen die
   der Speicherpfad ausgelegt und gemessen wurde. Ein Bestand deutlich darüber
   ist mit dieser Ablage nicht vorgesehen.
