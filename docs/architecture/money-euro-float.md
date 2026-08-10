# Geldbeträge: Euro-Float in der Persistenz, Cent in der Rechnung

Status: verbindliche Konvention (ADR). **Entschieden am 2026-08-08** als
Vorentscheidung des Qualitätsprogramms 10/10 („Persistenzformat von
`Transaction.amount` bleibt Euro-Float", `docs/qualitaet-2026-08/plan.md`,
Abschnitt „Vorentschiedenes"); eingelöst in **WP 2.5** (`9bf65fd`,
cent-genaue Validierung an der Schreibgrenze) und **WP 5.1** (`cc9783e`,
Branded Types). Das Format selbst ist älter als die Historie dieses Repos —
entschieden wurde 2026-08-08 nicht das Format, sondern es **beizubehalten**.
**Nachgetragen als ADR am 2026-08-09**, Arbeitspaket 7.5 (Befund GOV-4 in
`docs/qualitaet-2026-08/audit.md`).

Diese Datei ist die ADR, auf die sich der Kommentarkopf von `src/lib/money.ts`
beruft. Geltende Kurzform: `AGENTS.md` §8, `docs/coding-guide.md` §4,
`docs/domain-invariants.md` Invariante 5.

## Kontext

`Transaction.amount` ist ein `number` in **Euro** — `12.50`, nicht `1250`
(`src/lib/transaction-types.ts:16`). Dasselbe gilt für Schulden, Forderungen,
Budgets, Positionen und alles, was aus CSV, GoCardless, Backup oder Sync
hereinkommt.

Das ist die bekannte Fehlerquelle: IEEE-754 kann `0,1 + 0,2` nicht exakt, und
eine Finanz-App, die Aufteilungen cent-genau treffen muss („Summe der Splits =
Originalbetrag"), kann sich auf Float-Gleichheit nicht verlassen. Der Audit hat
das als DOM-4 aufgenommen: Invariante 5 war **Prosa** — der Text behauptete
cent-genaue Verarbeitung, der Code prüfte an der Schreibgrenze nichts.

Gleichzeitig sind Cent und Euro für den Compiler dasselbe: beides `number`. Eine
Faktor-100-Verwechslung kompiliert widerspruchslos (DOM-1).

Die naheliegende Antwort — alles auf Integer-Cent umstellen — trifft nicht nur
den Code, sondern jedes ausgelieferte Artefakt: Backups auf fremden Festplatten,
CSV-Exporte, den Cloud-Sync und alle Konsumenten.

## Entscheidung

**Das Persistenzformat bleibt Euro-Float. Die Korrektheit wird an zwei anderen
Stellen hergestellt.**

1. **Cent-genaue Validierung an der Schreibgrenze** (WP 2.5). `saveTransactions`
   prüft jeden Betrag per `toMinor`-Roundtrip: Betrag × 100 muss verlustfrei auf
   ganze Cent runden, sonst ist es ein **Validierungsfehler**, nie ein still
   gerundeter Wert (`src/services/transaction-service.ts:175-183`,
   `isCentPrecise` in `src/lib/money.ts`). Ein Betrag wie `0.005 €` kommt damit
   gar nicht erst in die Ablage.
2. **Cent-Euro-Verwechslung als Compile-Fehler** (WP 5.1). `Cents` und
   `EuroAmount` sind Branded Types (`number` ∩ Phantom-Feld) mit `toMinor` und
   `toMajor` als **einzigen** Konstruktoren. Der Brand existiert nur zur
   Compile-Zeit; zur Laufzeit ist der Wert ein gewöhnlicher `number`, und
   `JSON.stringify`, `===` und `toBe` verhalten sich unverändert.
3. **Gerechnet wird in Integer-Cent, nicht in Euro** (`AGENTS.md` §8): nie
   roher Float-Vergleich, nie `toFixed` für eine Berechnung, Aggregation nur
   über `@/lib/analysis-data`.

**An der Datengrenze wird der Brand bewusst nicht erzwungen.** Persistierte
Daten und zod-Schemata liefern einen rohen `number` (`transaction.schema.ts:31`:
`amount: z.number().optional()` — die `id` wird an dieser Lesegrenze gebrandet,
der Betrag bewusst nicht). Ein Pflicht-Cast an jeder Lesestelle würde den Brand zur
Dekoration machen — so steht es als Begründung im Kopf von `money.ts`.

Wo Cent bereits das persistierte Format ist, bleibt es das: die Split-Anteile
tragen `amount_minor` (`TransactionAllocation`, `special-category-service.ts`,
`contract-records/domain/warranty.ts`). Das Format ist also **nicht einheitlich**
— es ist entschieden je Entität, und die jüngeren Entitäten sind in Cent.

## Verworfene Alternativen

**Integer-Cent-Persistenz für `Transaction.amount` und die Altentitäten.**
Verworfen — ausdrücklich nicht auf Dauer, sondern **außerhalb dieses Programms**:
Es wäre eine Migration durch Backups, CSV, Sync und alle Konsumenten, und sie
bräuchte eine eigene ADR (`plan.md`, „Vorentschiedenes"; das Programm führt
„keine Integer-Cent-Persistenz-Migration" unter „Was dieses Programm bewusst
NICHT tut"). Der Grund, warum sie nicht nebenbei mitläuft: ein Backup, das ein
Nutzer vor der Migration exportiert hat, muss danach noch lesbar sein — ein
Formatwechsel ohne versionierten Leser macht aus 12,50 € entweder 1250 € oder
0,125 €, je nachdem, wer sich irrt.

**Eine Dezimal-Bibliothek (`decimal.js`, `dinero.js`).** *Rekonstruiert — im
Repo nirgends abgewogen.* Sie löst das Problem an derselben Stelle nicht: Der
persistierte Wert bliebe eine Zahl in JSON, der Wechsel auf einen Objekttyp wäre
dieselbe Migration wie oben, und dazu käme Bündelgewicht in einer App, deren
Startbündel schon auf 9 kB zusätzliches zod reagiert hat
(`nachpruefung.md` 2.a). `toMinor`/`sumMinor` leisten für den Bedarf dieser App
dasselbe zu null Bytes.

## Preis

1. **Die Rechenregel ist Disziplin, kein Typsystem.** Der Brand schützt die
   Rechenwege, nicht die Daten: An jeder Lesegrenze fällt er ab (bewusst, siehe
   oben), und `amount + amount` über zwei Euro-Floats kompiliert weiterhin. Was
   die Regel wirklich erzwingt, sind Wächter und Review — `check:money-parsing`
   verbietet den rohen `parseFloat`-Ersatz, `check:decimal-inputs` das
   `<input type="number">`; die „keine komponenten-lokale `reduce`-Kette über
   Beträge"-Regel hat gar keinen.
2. **Genau eine Rundungsunschärfe je Betrag ist toleriert — und das ist
   ausgerechnet.** `isCentPrecise` arbeitet mit einer Toleranz von `1e-6` Cent,
   weil die Float-Multiplikation auch bei fachlich exakten Beträgen streut
   (`19.99 × 100 = 1998.9999999999998`). Die Toleranz liegt bewusst rund fünf
   Größenordnungen über dieser Darstellungsstreuung und fünf Größenordnungen
   unter einem echten halben Cent (`0.005 €` weicht um 0,5 Cent ab) — die
   Begründung steht ausführlich in `money.ts`. Der Preis ist trotzdem real: es
   *gibt* eine Toleranz, und sie ist eine Zahl, die jemand richtig gewählt haben
   muss.
3. **Die Validierung gilt nur dort, wo sie steht.** `isCentPrecise` wird an
   genau **einer** Stelle im Produktivcode aufgerufen: der
   Transaktions-Schreibgrenze. `debt-service`/`receivable-service` schreiben
   ihre Beträge als Float ohne Cent-Prüfung — als offener Folgepunkt benannt in
   `docs/qualitaet-2026-08/nachpruefung.md` (Segment 2, Abschluss: „andere
   fachliche Grenze, eigener Folgepunkt — gefunden in WP 2.5").
4. **Zwei Formate im selben Bestand.** `Transaction.amount` in Euro,
   `TransactionAllocation.amount_minor` in Cent. Wer beide in einer Zeile
   anfasst, muss umrechnen und weiß es hoffentlich — die Aufrufstellen tragen
   deshalb Kommentare (`TransactionDayList.tsx:305`,
   `transaction-allocation-service.ts:47`).
5. **Der Aufschub wird mit jedem Tag teurer.** Jedes exportierte Backup, jede
   CSV und jeder Sync-Datensatz mehr ist ein weiterer Leser des Float-Formats.
   Das ist kein Argument gegen die Entscheidung — sie ist begründet —, aber es
   ist der Grund, warum „später mal umstellen" keine kostenlose Option ist.
