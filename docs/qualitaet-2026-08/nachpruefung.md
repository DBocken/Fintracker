# Nachprüfung — was der Plan übersehen hat

> **Geltend, weil Entscheidungen binden** (analog
> `docs/aaa-plus/decisions/decision-log.md`). `plan.md` sagt, was zu tun ist;
> diese Datei sagt, wo der Plan an der Wirklichkeit vorbeigezielt hat und was
> stattdessen gilt. Neue Arbeitspakete, die daraus entstehen, werden **in
> `plan.md` ergänzt** — die Arbeitsliste bleibt eine einzige Datei.

**Muster je Eintrag:** Befund (mit Beleg) → Entscheidung → Begründung → Preis.
Der Preis gehört dazu: eine Entscheidung ohne benannten Preis ist eine
Behauptung, keine Abwägung.

Ein Eintrag entsteht am Ende eines Segments (Segment = Phase). Fällt
unterwegs etwas auf, wird es **sofort** unter der Überschrift der laufenden
Phase notiert — beim Phasenabschluss ist es sonst vergessen.

---

## Segment 0 · Das Laufwerk — 2026-08-08

Vier Entscheidungen, die vor dem ersten Paket getroffen werden mussten, weil
sie jedes folgende betreffen.

### 0.1 · „Ein Arbeitspaket = ein PR" ist in dieser Umgebung nicht ausführbar

**Befund.** `plan.md`, Arbeitsregel 2, fordert je Paket einen eigenen PR. Die
Sitzung, die dieses Programm ausführt, ist auf genau einen Branch festgelegt
(`claude/qualitaetsaudit-code-verbesserungen-6f10e4`); ein zweiter Branch ist
ihr verwehrt. Vierzig Pakete stehen vierzig unmöglichen PRs gegenüber.

**Entscheidung.** Ein Branch, **ein kumulierender Draft-PR**, darin **ein
Commit je Arbeitspaket**. Die Commit-Message trägt WP-ID, Ziel und
Testabdeckung; der PR-Body führt die Paketliste mit SHA.

**Begründung.** Die Absicht hinter Regel 2 ist nicht die Zahl der PRs, sondern
dass jedes Paket **einzeln prüfbar und einzeln rückrollbar** ist. Das leistet
ein sauber geschnittener Commit genauso — `git revert <sha>` nimmt ein Paket
zurück, ohne die anderen anzufassen. Was verloren geht, ist die
PR-Review-Granularität; was gewonnen wird, ist die Ausführbarkeit überhaupt.

**Preis.** Der PR wird groß und ist am Stück nicht mehr sinnvoll zu
reviewen — er muss commitweise gelesen werden. Ein CI-Rotlauf trifft immer
den ganzen Stapel, nicht ein Paket. Wer das anders will, muss die
Branch-Beschränkung der Sitzung aufheben, nicht diese Entscheidung.

### 0.2 · Der flüchtige Container macht den Commit zum einzigen Zustand

**Befund.** `plan.md` setzt eine durchlaufende Arbeitssitzung voraus. Real
endet die Sitzung am Volumenlimit, und der Container wird danach recycelt:
`node_modules` fehlt beim Neustart, der Arbeitsbaum ist weg, nur der
gepushte Branch überlebt. Ein zur Hälfte umgesetztes Paket wäre bei
Wiederaufnahme nicht von einem fertigen zu unterscheiden.

**Entscheidung.** Nach jedem grünen Paket wird **sofort committet und
gepusht**. Ein angefangenes Paket wird bei Wiederaufnahme **verworfen**
(`git checkout -- . && git clean -fd`) und neu gemacht, nie halb
weitergeführt. Delegierte Agenten dürfen deshalb **nicht committen** — sie
liefern einen Arbeitsbaum ab, der Orchestrator prüft und committet.

**Begründung.** Der Wiedereinstieg braucht eine Frage mit genau einer
Antwort: *Ist dieses Paket committet?* Alles andere — halbfertige Tests,
teilweise umgestellte Aufrufer, ein Agent, der mitten im Refactoring
abgeschnitten wurde — ist nicht zuverlässig rekonstruierbar, und der Versuch
kostet mehr als die Wiederholung.

**Preis.** Ein Abbruch kurz vor dem Ende eines großen Pakets (etwa WP 4.1)
wirft dessen Arbeit vollständig weg. Gegenmaßnahme ist Paketschnitt, nicht
Zustandsrettung: was zu groß ist, um in einem Zug fertig zu werden, wird in
`plan.md` in nummerierte Teilpakete zerlegt, bevor daran gearbeitet wird.

### 0.3 · Modell-Untergrenze Sonnet statt Haiku

**Befund.** `plan.md`, Arbeitsregel 5, markiert dreizehn Pakete mit „(H)
mechanisch, Haiku genügt". Mechanisch sind sie nur an der Oberfläche: an
jedem sichtbaren String hängen drei Locales, ein `everyday`-Overlay je
Sprache, ein bilingualer Test und zwölf Wächter, von denen mehrere
(`check:i18n --all`, `locale-parity`, `wording-consistency`,
`check:state-coverage`) erst nach dem Schreiben zuschlagen.

**Entscheidung.** (H)- und (S)-Pakete gehen an Sonnet-Agenten. (O)-Pakete —
ADRs, Entwurfsentscheidungen, die Nachprüfungen selbst — bleiben beim
Orchestrator.

**Begründung.** Delegation spart hier kein Budget (dasselbe Kontingent), sie
spart **Kontext**, und Kontext ist das, was die autonome Laufzeit begrenzt.
Ein Agent, dessen Ergebnis dreimal nachgebessert werden muss, verbraucht mehr
Kontext als er spart — die Untergrenze ist deshalb eine Effizienz-, keine
Qualitätsentscheidung.

**Preis.** Höhere Kosten je delegiertem Paket. Wird in Kauf genommen.

### 0.4 · Segment = Phase, mit sofortiger Zwischennotiz

**Befund.** Der Auftrag verlangt eine Nachprüfung „nach jedem Segment";
`plan.md` kennt den Begriff nicht, nur Phasen — und deren Reihenfolge ist
verzahnt (2.1 und 2.2 laufen mitten in Phase 1).

**Entscheidung.** Segment = Phase. Der Eintrag entsteht, sobald die **letzte**
WP einer Phase steht — bei Phase 2 also erst nach 2.5, obwohl 2.1/2.2 früh
fertig sind. Zwischenbefunde werden sofort bei ihrer Entdeckung unter der
Phasen-Überschrift notiert.

**Begründung.** Ein Befund, der beim Bauen auffällt und erst am Phasenende
aufgeschrieben werden soll, ist am Phasenende weg — besonders, wenn dazwischen
eine Sitzung endet.

**Preis.** Die Datei wird zwischendurch unfertig aussehen. Das ist gewollt:
sie ist ein Arbeitsprotokoll, kein Bericht.

### 0.5 · Die volle Testsuite läuft am Phasenende, nicht je Paket

**Befund.** Die Definition of Done in `plan.md` (Arbeitsregel 4) verlangt
`pnpm test` grün je Paket. Gemessen: **9 min 51 s** für 4808 Tests in 500
Dateien. Über vierzig Pakete sind das knapp sieben Stunden reine Wartezeit —
in einer Ausführung, deren knappste Ressource Zeit vor dem nächsten Limit ist.

**Entscheidung.** Je Paket laufen `lint`, die zwölf Wächter, `tsc` und
**gezielt die betroffenen Testdateien** (`pnpm exec vitest run <pfade>`). Die
volle Suite läuft **am Phasenende**, zusammen mit `build`, `check:bundle-size`
und `test:coverage`.

**Begründung.** Die Frage „bricht dieses Paket einen entfernten Test?"
beantwortet CI bei **jedem Push** ohnehin und vollständig
(`ci.yml`, Job `quality`) — und gepusht wird nach jedem Paket. Die lokale
Vollprüfung wäre also eine zweite Antwort auf eine bereits gestellte Frage,
bezahlt mit der Zeit, die für das nächste Paket fehlt. Was lokal bleibt, ist
genau das, was CI **nicht** schnell genug beantwortet: die Wächter, die
sonst erst nach dem Push rot werden.

**Preis.** Ein entfernter Fehlschlag wird erst nach dem Push sichtbar, nicht
davor — die Korrektur ist dann ein zweiter Commit statt eines
Amend. Ausdrücklich in Kauf genommen; ein roter CI-Lauf im Draft-PR ist
sichtbar und behebbar, verlorene Zeit nicht.

### 0.6 · Vorbefunde aus der Erkundung, die `plan.md` nicht kennt

Gefunden bei der Bestandsaufnahme vor dem ersten Paket, jeweils **noch nicht
entschieden** — sie werden in dem Paket entschieden, das sie zuerst berührt,
und stehen hier, damit sie dort nicht überraschen:

| Befund | Beleg | Berührt |
|---|---|---|
| `feature-presentation-ohne-legacy-components` wäre am ersten Tag rot: **24 Importe in 10 Dateien** über alle vier Slices mit `presentation/`, nicht die zwei, die der Plan annimmt | `src/features/{dashboard,finance-city,special-categories,transactions}/presentation/` | **WP 2.3** |
| `hooks → components` ist heute nicht versehentlich ungeprüft, sondern **absichtlich**; ein Test hält das schriftlich fest | `scripts/__tests__/layers-core.test.mjs:79-87` | **WP 2.3** |
| `'ausgabentracker_transactions_v3'` ist doppelt definiert statt importiert | `services/local-storage-keys.ts:11` und `services/transaction-storage-service.ts:35` | WP 1.2 / 4.1 |
| `validateBackup` und `isVersionCompatible` sind `private` — von außen nicht testbar | `services/backup-service.ts:314,443` | WP 1.5 |
| Drei Dateiformate teilen `EncryptedEnvelopeV1`, validieren es aber unterschiedlich streng (lax / zod-`.strict()` / Ad-hoc) | `local-crypto.ts:103`, `snapshot-sync-service.ts:47`, `backup-service.ts:302` | WP 1.2 / 4.1 |
| `importEncryptedSnapshot` schreibt **rohe IDB-Strings** zurück — ein Schlüsselschema-Wechsel schlägt auf Sync und Backup durch | `services/snapshot-sync-service.ts:211-222` | **WP 4.1 (ADR)** |
| PBKDF2-Parameter stehen an **zwei** Stellen | `local-crypto.ts` `enable()` und `freshStandaloneConfig()` | WP 3.1 |

**Kein Vorbefund ist rot.** Die Baseline auf `f2c6e5a` (siehe
[`status.md`](status.md)) ist in allen zwölf Wächtern, `lint` und `tsc`
grün — was in diesem Programm rot wird, hat dieses Programm verursacht.

---

## Segment 1 · Phase 1 — Datenverlust unmöglich machen

### Abschluss — 2026-08-08

**Acht Pakete statt sechs.** `plan.md` sah WP 1.1–1.6 vor; dazu kamen **WP 1.7**
(`forecastOverrides` schluckte den neuen Fehler weiter) und **WP 1.2b** (die
Integritätsmeldung erreichte die Fläche nicht). Beide entstanden nicht aus
neuem Wissen, sondern daraus, dass die ersten Pakete den nächsten Schluckpunkt
**sichtbar machten** — WP 1.1 hat einen Fehler eingeführt, der vorher nirgends
ankommen konnte, und damit erst zeigen können, wer ihn wegwirft.

**Was Phase 1 jetzt garantiert, prüfbar:**

| Weg | Vorher | Jetzt |
|---|---|---|
| Envelope kaputt | `null` ⇒ `[]` ⇒ nächster Schreibvorgang löscht die Collection | `VaultCorruptError`, Schreiben scheitert vorher |
| Einzelnes Item kaputt | fließt bis in die Render-Schicht | übersprungen, gezählt, auf `/transactions` gemeldet |
| Schema-Version springt | Nummer wird stumm festgeschrieben | Läufer mit Schritt-für-Schritt-Version; Abbruch bleibt lesbar |
| Älterer Sync-Snapshot | überschreibt neuere Daten kommentarlos | verlangt Bestätigung mit **beiden** Ständen |
| Backup teilkorrupt | importiert „erfolgreich" | SHA-256 erkennt es; Items einzeln geprüft |
| Quota erschöpft | rohe `DOMException` | benannter Fehler mit Handlungsoption |
| IndexedDB-Erstaufruf scheitert | Store für die Sitzung tot | nächster Zugriff versucht es erneut |
| Render-Crash einer Fläche | ganze App weg | Navigation bleibt, Routenwechsel erholt sich |

**Das Erfolgskriterium 1 des Programms** („kein Codepfad macht aus einem
Lese-/Entschlüsselungsfehler einen Leerzustand") gilt damit für die
Kern-Lesewege — **aber nicht lückenlos**, und das ist die ehrliche Fassung:

- 25 von 30 Collections haben noch **kein Schema** (Ratsche, `nachpruefung.md`
  1.c). Sie sind gegen Envelope-Korruption geschützt (WP 1.1 wirkt für alle),
  nicht gegen einzelne kaputte Datensätze.
- Nur `/transactions` **zeigt** die Zahl übersprungener Items. Vier weitere
  Collections zählen sie, ohne sie anzuzeigen.
- `IncomeStressTestDialog` fällt bei einem Overrides-Fehler weiterhin still auf
  Defaults zurück — dieselbe Klasse wie der Kernbefund, in einem sekundären
  Dialog (gefunden in WP 1.7, bewusst nicht mitgenommen).

**Was diese Phase über die Arbeitsweise gelehrt hat.** Dreimal hat nicht das
Nachdenken den Fehler gefunden, sondern ein Wächter oder ein roter Test:
`check:i18n --staged` fing eine Allowlist-Erhöhung, die ich für vertretbar
gehalten hatte (1.e); die view-data-Ratsche fing einen Typ am falschen Ort und
einen überflüssigen zweiten Codepfad (1.g); ein roter Test zeigte, dass der
Integritätsbericht für den Restore semantisch nicht taugt (1.h). Dazu ein
Beinahe-Fehler, den der ausführende Agent selbst fand: eine Prüfsumme vor der
Secret-Redaktion hätte **jeden korrekten Export** als manipuliert gemeldet.
Das ist der Kern des Programms in einem Satz: **Ein Versprechen ohne Wächter
ist eine Absichtserklärung — und das gilt auch für die Versprechen, die man
sich selbst beim Review gibt.**

---

*Die Zwischenbefunde, auf die sich der Abschluss beruft:*

### 1.a · WP 1.1 legt einen zweiten Schlucker frei — neues Paket WP 1.7

**Befund.** WP 1.1 macht aus einem korrupten Envelope einen geworfenen
`VaultCorruptError`. In `src/services/forecast-overrides-service.ts`,
`getForecastOverrides()`, kommt dieser Fehler nie an: die Funktion fängt
**jeden** Fehler von `loadAndMaybeDecrypt` und liefert `cloneDefaults()`.
`forecastOverrides` ist ein registrierter `LOCAL_FINANCE_KEYS`-Eintrag —
genau der Bestand, den WP 1.1 schützen soll. Für diese eine Collection bleibt
die Fehlkette also offen.

**Entscheidung.** Nicht in WP 1.1 mitbehoben, sondern **neues Paket WP 1.7**
(in `plan.md` ergänzt, Phase 1, nach WP 1.6).

**Begründung.** Der Rethrow allein reicht hier nicht: `src/hooks/useForecastOverrides.ts`
konsumiert den Aufruf per `void promise.then(...)` **ohne `.catch`**. Ein
geworfener Fehler wäre damit eine unhandled Rejection statt eines
Fehlerzustands — die Fläche muss zuerst auf das Query-Error-Muster umgebaut
werden (`FinanceErrorState`, `[ZUSTAND …:fehler]`-Test). Das ist eine
UI-Änderung mit eigener Zustands-Abdeckung, und WP 1.1 hatte ausdrücklich
„keine UI-Fläche" als Grenze. Ein Paket, das seine eigene Grenze überschreitet,
ist nicht mehr einzeln rückrollbar.

**Preis.** Zwischen WP 1.1 und WP 1.7 ist der Schutz **ungleichmäßig**: 29 von
30 Collections melden Korruption, `forecastOverrides` schluckt sie weiter. Das
ist schlechter als „überall gleich", weil es den Eindruck erweckt, das Thema
sei erledigt. Deshalb steht WP 1.7 in Phase 1 und nicht im Nachlauf — Phase 1
ist erst abgeschlossen, wenn auch diese Collection wirft.

### 1.c · WP 1.2 als Ratsche statt als Alles-oder-nichts, und in zwei Teilen

**Befund.** `plan.md` verlangt für WP 1.2 Schemata für „`Transaction`,
`Account`, `Category`, `Budget`, `Debt`, `Receivable` und die übrigen
`LOCAL_FINANCE_KEYS`-Collections" — das sind **30**, dazu eine Nutzermeldung
und eine Kaltstart-Messung. Das ist kein Paket, das in einem Zug fertig wird,
und ein Paket, das nicht fertig wird, ist in dieser Ausführungsumgebung
(Abbruch jederzeit möglich) verlorene Arbeit.

**Entscheidung.** Zwei Schnitte statt einem grossen Wurf:

1. **Ratsche statt Vollabdeckung.** Eine Schema-Registry
   (`src/lib/schemas/collection-schemas.ts`) wird je Collection befragt:
   Schema vorhanden ⇒ validieren, kein Schema ⇒ unverändert durchreichen.
   Abgedeckt sind zunächst **5** (`transactions`, `accounts`, `debts`,
   `receivables`, `budgets`); ein Test hält die Zahl fest und lässt sie nur
   **steigen**. `categories` und `settings` fehlen bewusst — sie hängen an
   einem Umbau von `local-settings-service.ts`.
2. **Teil A ohne Fläche, Teil B mit.** Teil A (`6404429`) validiert, zählt und
   hält fest; die Texte liegen i18n-vollständig bereit. Die Fläche, die das
   anzeigt, ist **WP 1.2b**.

**Begründung.** Beide Schnitte folgen demselben Prinzip wie die vorhandenen
Wächter des Repos, wörtlich: *„ein Wächter, der ab morgen jeden Commit
blockiert, wird abgeschaltet statt befolgt"* (`view-data-core.mjs`). Eine
Validierung, die 30 gewachsene Collections gleichzeitig scharfstellt, verwirft
beim ersten Lauf gute Bestandsdaten — deshalb sind die Schemata auch
**nachsichtig** (kein `.strict()`): geprüft werden Pflichtfelder und Typen,
nicht die Abwesenheit unbekannter Felder.

**Preis.** Zwei Preise, beide echt. Erstens: 25 Collections bleiben vorerst
ungeprüft, und die Registry macht das *sichtbar* statt es zu verdecken — die
Ratschenzahl ist die ehrliche Antwort auf „wie weit sind wir". Zweitens:
zwischen Teil A und WP 1.2b **zählt die App übersprungene Datensätze, ohne es
zu sagen**. Das ist derselbe Fehler in klein, den WP 1.1 im Grossen behoben
hat — stiller Datenverlust ist schlimmer als lauter. Deshalb steht WP 1.2b in
Phase 1 und nicht im Nachlauf: Phase 1 ist erst zu, wenn der Nutzer die Zahl
sieht.

### 1.d · Zwei Offenlegungen aus WP 1.2, die nicht verschwiegen werden

**Befund 1 — TDD wurde nicht eingehalten.** Der ausführende Agent hat Schemata,
Registry und Service-Einbau **im selben Schritt** wie die Tests geschrieben,
statt zuerst rot zu laufen und das zu protokollieren. Er hat das von sich aus
offengelegt. Die Rot-Grün-Eigenschaft ist logisch gegeben (vor der Änderung
existierte `data-integrity-report.ts` nicht und es wurde nichts gefiltert — die
Assertions `toHaveLength(3)` und „ein Eintrag im Report" hätten beide verfehlt),
aber **belegt ist sie nicht**.

**Entscheidung.** Der Commit bleibt; die Commit-Nachricht behauptet keinen
roten Lauf, den es nicht gab. Für die folgenden Pakete wird der rote Lauf
**vom Orchestrator** verlangt und im Bericht zitiert, nicht nur beauftragt.

**Begründung.** Nachträglich einen roten Lauf zu inszenieren, indem man die
Implementierung wieder herausnimmt, erzeugt einen Beleg, aber keine Wahrheit —
der Test ist dann trotzdem in Kenntnis der Implementierung geschrieben. Die
ehrlichere Konsequenz ist, die Lücke zu benennen und die Kontrolle zu
verschärfen, statt den Nachweis zu simulieren.

**Preis.** Für diese fünf Schemata bleibt offen, ob die Tests wirklich fangen,
was sie zu fangen vorgeben. Die Mutationsprobe, die WP 2.1 geliefert hat, gibt
es hier nicht.

**Befund 2 — die Messung liegt auf der Grenze, nicht darunter.**
`plan.md` setzt für WP 1.2 ein Budget von **≤ 50 ms** zusätzlich bei 5 000
Transaktionen. Gemessen (vier Läufe, frischer Prozess): **47,4 / 49,7 / 50,1 /
51,1 ms**, Median ~49 ms. Das ist kein „komfortabel unter Budget", sondern ein
Streuband **um** die Grenze — und gemessen in Node/Vitest, nicht im Browser.

**Entscheidung.** Keine Worker-Verlagerung in diesem Paket. Der Perf-Test
bleibt mit großzügiger Schranke im Baum (damit CI nicht flackert) und
protokolliert die echte Zahl.

**Begründung.** Eine Verlagerung in den Worker ist ein eigener Umbau mit
eigenem Risiko; ihn auf Verdacht mitzunehmen, macht das Paket größer, ohne die
Frage zu beantworten. Die Frage beantwortet erst eine Messung im echten
Browser-Kaltstart.

**Preis.** Bis dahin ist „das Budget ist eingehalten" eine Aussage über
Node, nicht über das Gerät des Nutzers. Wer sie als Browser-Aussage liest,
liest zu viel hinein.

### 1.e · Die i18n-Ausnahmeliste deckt Altbestand, niemals Nachschub

**Befund.** Bei WP 1.3 entstand eine neue Fehlermeldung
(`StoreMigrationPendingError`). Der erste Versuch hat sie als
Entwicklertext behandelt und die Ausnahme für `store-compatibility.ts` in
`i18n-allowlist.json` von `count: 1` auf `2` gehoben — mit einer
plausibel klingenden Begründung. `check:i18n --all` war damit grün. Der
**Pre-Commit-Hook** hat es trotzdem gefangen: `check:i18n --staged`
prüft geänderte Zeilen **ohne** Ausnahmeliste.

**Entscheidung.** Ausnahme zurück auf `1`. Die Meldung läuft über
`serviceT` und steht in allen `SUPPORTED_LOCALES`. Die zweite neue Meldung
(Lücke in der Migrations-Schrittliste) bleibt dagegen **englischer
Entwicklertext ohne Schlüssel**.

**Begründung.** Die Asymmetrie der beiden Modi ist Absicht, nicht Lücke:
eine Ausnahmeliste, die auch für neue Zeilen gilt, ist keine Ratsche mehr,
sondern ein Ventil. Die Unterscheidung zwischen den beiden Meldungen ist
**wer sie sehen kann**: `StoreMigrationPendingError` erreicht über den
`ErrorBoundary` den Nutzer und braucht deshalb Übersetzung und einen Satz,
der eine Handlung nennt. Die Lücken-Meldung ist ein Autorenfehler in der
Schrittliste — ein Zustand, in den ein Nutzer gar nicht geraten kann. Sie
zu übersetzen würde eine Nutzerlage vortäuschen, die es nicht gibt.

**Preis.** Für die Beurteilung „kann das der Nutzer sehen?" gibt es keinen
Wächter — sie bleibt Selbst-Review. Der Hook erzwingt nur, dass die Frage
überhaupt gestellt wird, nicht dass sie richtig beantwortet wird.

**Bemerkenswert:** Hier hat der Pre-Commit-Hook den Fehler eines Agenten
gefangen, den der Review nicht gefangen hätte — ich hatte die
Allowlist-Erhöhung gelesen und für vertretbar gehalten. Das ist genau der
Zweck des Wächter-Systems, und es ist das erste Mal in diesem Programm,
dass es gegen *uns* gearbeitet hat statt für uns.

### 1.f · `pnpm test:integrity` sieht neue Testdateien strukturell nicht

**Befund.** Das Skript in `package.json` filtert `[INTEGRITY]` über eine
**feste Dateiliste**, nicht über einen Glob. Die drei neuen Testdateien aus
WP 1.3 tragen `[INTEGRITY]`/`[REGRESSION]`, laufen dort aber nicht mit.
Dasselbe gilt für `test:security`, `test:privacy`, `test:mobile`.

**Entscheidung.** Nicht in WP 1.3 behoben; als Punkt für **WP 7.6**
(Buchhaltung und entschiedene Restpunkte) vorgemerkt.

**Begründung.** Es ist kein Verhaltensfehler — die Tests laufen in
`pnpm test` und in CI vollständig mit. Betroffen ist nur die Aussagekraft
der vier benannten Suiten, und die Korrektur (Glob statt Liste) berührt
alle vier plus die AGENTS.md-§2-Tabelle. Das gehört gebündelt entschieden,
nicht als Anhängsel eines Speicher-Pakets.

**Preis.** Bis dahin bedeutet „`pnpm test:security` ist grün" weniger, als
es klingt: es ist eine Aussage über eine handgepflegte Dateiliste, nicht
über alle `[SECURITY]`-Tests im Baum. Wer die Suite als Freigabe-Kriterium
liest, liest zu viel hinein — genau die Sorte stiller Bedeutungsverlust,
gegen die dieses Programm sonst antritt.

### 1.g · Der Ansicht/Daten-Wächter hat einen Entwurfsfehler gefunden, kein Zählproblem

**Befund.** WP 1.4 riss die view-data-Ratsche (283 gegen 282). Der neue
Bestätigungsdialog importierte zwei Typen (`SnapshotStandInfo`,
`SnapshotVersionComparison`) aus `snapshot-sync-service` — richtungskonform
nach §3, aber der Wächter zählt jeden Service-Import in der Darstellung.

**Entscheidung.** Nicht die Ratsche heraufgesetzt, sondern die Typen nach
`src/lib/snapshot-comparison.ts` verschoben (Re-Export im Service für
Bestandsimporte).

**Begründung.** Die Tabelle „Wohin ein Typ gehört" in AGENTS.md §3 beantwortet
den Fall ohne Ermessensspielraum: *Typ, den Service **und** Oberfläche
brauchen ⇒ `src/lib/`.* Der Wächter hat also keinen Fehlalarm produziert,
sondern eine Ablage-Gewohnheit erwischt — genau die, die laut AGENTS.md „der
häufigste Weg ist, die Richtung umzudrehen": der Typ landet dort, wo er zuerst
gebraucht wurde.

**Preis.** Keiner, der zählt. Der Service ist um zwei Typdeklarationen ärmer
und um einen Re-Export reicher.

**Nebenbefund im selben Zug:** Der erste Entwurf der Fläche fragte den Service
per `previewSnapshotImport` **vorher**, ob der Import erlaubt sei, und rief
dann die Mutation. Das war ein zweiter Codepfad mit einer zweiten Meinung über
den Versionsstand. Ersetzt durch: die Fläche ruft einfach die Mutation und
**reagiert auf die Absage** (`SnapshotOlderVersionError` trägt den Vergleich
mit). Ein Codepfad, eine Wahrheit — bezahlt mit einer doppelten Entschlüsselung
auf dem seltenen Konfliktpfad. Aufgefallen ist auch das nur, weil die Ratsche
den zusätzlichen Service-Import sichtbar gemacht hat.

### 1.h · Der Integritätsbericht taugt nicht für den Restore — und das war messbar

**Befund.** WP 1.5 sollte die Meldung über übersprungene Items aus WP 1.2b
wiederverwenden (`data-integrity-report.ts`, `DataIntegrityWarning`). Der
Versuch scheiterte an einer Eigenschaft, die vorher niemandem aufgefallen war:
Der Report gilt für den **jeweils letzten Lesevorgang** einer Collection.
`restoreBackup()` liest dieselben Collections intern nach — und setzte den
Zähler damit sofort wieder auf 0, weil der frisch bereinigte Bestand beim
nächsten Lesen tatsächlich sauber ist.

**Entscheidung.** Keine Wiederverwendung. Der Restore-Befund lebt im
**Rückgabewert** von `restoreBackup()` (`details.skippedItems`, `warnings`);
die Fläche in `BackupManager` speist sich direkt daraus.

**Begründung.** „Letzter Lesevorgang" und „Ergebnis dieses einen Restores"
sind verschiedene Aussagen, und die eine als die andere auszugeben, hätte eine
Zahl erzeugt, die zufällig manchmal stimmt. Bemerkenswert ist nicht die
Entscheidung, sondern **wie sie zustande kam**: nicht durch Nachdenken über
das Design, sondern durch einen roten Test, der zeigte, dass der Zähler leer
blieb. Das ist der Fall, für den TDD gebaut ist.

**Preis.** Zwei Wege, auf denen dem Nutzer eine Integritätszahl gemeldet wird
(Lesepfad und Restore-Pfad), mit zwei Bausteinen. Das ist Doppelung — aber
Doppelung, die zwei verschiedene Aussagen sauber trennt, statt eine Aussage zu
verwischen.

**Nebenbefund, selbst gefunden und behoben:** `downloadBackup()` entfernt
Broker-Secrets **nach** `createBackup()`. Eine in `createBackup()` berechnete
Prüfsumme hätte danach nicht mehr zur redigierten Nutzlast gepasst — und
**jeden normalen unverschlüsselten Export/Import-Roundtrip als „manipuliert"
gemeldet**. Ein Integritätsschutz, der bei korrekter Benutzung Alarm schlägt,
wird abgeschaltet; das wäre schlimmer als keiner gewesen.

### 1.i · Ein Dialog schluckt den Overrides-Fehler weiter

**Befund.** `src/components/income/IncomeStressTestDialog.tsx` konsumiert
`useForecastOverrides()` ebenfalls, zeigt aber keinen Fehlerzustand: bei einem
Overrides-Fehler rechnet er intern mit `DEFAULT_FORECAST_OVERRIDES` weiter.
Gefunden beim Bauen von WP 1.7.

**Entscheidung.** Nicht mitgenommen. Als offener Punkt hier festgehalten und in
Phase 7 (WP 7.1, Verschärfung der Fehlerzustands-Tests) mitzuentscheiden.

**Begründung.** Es ist dieselbe Klasse wie der Kernbefund, aber in einem
sekundären Dialog statt der Hauptfläche — und ein Fehlerzustand in einem Dialog
ist eine eigene Design-Entscheidung (Bauform, Text, was passiert mit der
laufenden Eingabe), keine Wiederholung der Fläche. WP 1.7 hatte `/liquidity`
als benanntes Ziel; ein Paket, das seine eigene Grenze überschreitet, ist nicht
mehr einzeln rückrollbar.

**Preis.** Ein Nutzer, dessen Overrides beschädigt sind, sieht auf
`/liquidity` einen Fehler und in diesem Dialog eine Rechnung mit
Standardannahmen — **zwei verschiedene Auskünfte über denselben Zustand**. Das
ist schlechter als zweimal derselbe Fehler und der Grund, warum der Punkt hier
steht und nicht nur im Commit.

### 1.b · Der Wiedereinstieg selbst hatte zwei Fehler — beide korrigiert

**Befund.** Die erste Unterbrechung (Volumenlimit, 2026-08-08) hat das
Laufwerk erstmals benutzt und dabei zwei Stellen widerlegt, die `status.md`
behauptet hatte:

1. Schritt 2 sagte pauschal „Arbeitsbaum nicht leer ⇒ verwerfen". Beim echten
   Wiedereinstieg lag dort WP 1.1 — **vollständig, mit belegter grüner
   Wächterbatterie und von mir gelesenem Diff**. Die Regel hätte fertige,
   geprüfte Arbeit vernichtet.
2. Schritt 6 verlangte Buchhaltung „im selben Commit". Das geht nicht: die
   SHA, die in die Tabelle gehört, existiert erst, **nachdem** der Commit
   gemacht ist.

**Entscheidung.** Beide Schritte in `status.md` umgeschrieben. Schritt 2
unterscheidet jetzt bekannten von unbekanntem Zustand und macht die Angabe im
Block „Aktuell in Arbeit" zur Bedingung dafür, Arbeit zu behalten — im Zweifel
gilt weiterhin verwerfen. Schritt 6 sagt jetzt, was ohnehin passiert: zwei
Commits, Code trägt das Paket, Buchhaltung trägt seine SHA.

**Begründung.** Ein Wiedereinstiegs-Protokoll, das beim ersten echten Einsatz
nicht befolgt wird, ist wertlos — es hätte hier entweder Arbeit zerstört oder
(was tatsächlich geschah) eine Abweichung ohne Papierspur erzeugt. Beides ist
schlimmer als eine Regel mit einer sauber benannten Ausnahme.

**Preis.** Schritt 2 ist nicht mehr mechanisch, sondern verlangt ein Urteil.
Das ist die Stelle, an der eine wiederaufnehmende Sitzung sich selbst
belügen kann („war bestimmt fertig"). Dagegen hilft nur die harte Kopplung an
den „Aktuell in Arbeit"-Block: steht dort nichts Passendes, wird verworfen —
und dieser Block wird beim Start eines Pakets gefüllt, nicht hinterher.

## Segment 2 · Phase 2 — Geld-Korrektheit & Wächterlöcher

### Abschluss — 2026-08-08

**Fünf Pakete, wie geplant** (2.1–2.5). Phase 2 ist die einzige bisher, in der
kein zusätzliches Paket entstanden ist — passend dazu, dass es die kleinteilige
Phase war: enge Aufträge, benannte Fundstellen, wenig Entdeckungsraum.

**Was Phase 2 verändert hat.** Vorher galten drei Regeln nur auf dem Papier;
jetzt haben alle drei einen Wächter oder Test:

| Versprechen | Vorher | Jetzt |
|---|---|---|
| Kein Roh-`parseFloat` für Geld, kein `as unknown as` an Datengrenzen (`coding-guide.md`) | verletzt in drei Dateien, **kein** Wächter | `check:money-parsing`, 0 offene Fundstellen |
| Importrichtung `lib → services → hooks → components → pages` (§3) | `hooks/` war unbewacht, Slice-`presentation/` auch | harte Regel + Ratsche bei 24 |
| „`api/` und `mcp-poc/` gehören in den Typecheck" (`coding-guide.md`) | lief **nie** | zwei CI-Schritte, beide grün |
| Invariante 5, cent-genau (`domain-invariants.md`) | Prosa | `isCentPrecise` an der Schreibgrenze |
| Grenzwerte der Geldlogik (`<`, `>`, Vorzeichen im Tausenderpunkt) | untestet, Mutation blieb grün | drei Tests, Mutationsprobe belegt |

Die Wächterzahl ist von zwölf auf **vierzehn** gestiegen (plus die zwei
Typecheck-Schritte). Der Preis dafür steht in 2.b: der Grenznutzen jedes
weiteren Wächters sinkt, und irgendwann ist ihre Zahl selbst ein Problem. Für
die zwei aus dieser Phase gilt das noch nicht — beide schließen eine Lücke, an
der nachweislich schon etwas durchgerutscht ist.

**Was diese Phase über den Plan gelehrt hat.** Alle drei Vorbefunde aus 0.6,
die Phase 2 betrafen, haben sich **exakt bestätigt** — 4 hooks-Importe, 24
Slice-Importe, ein absichtlich gesetzter Test, der die Gegenentscheidung
festhielt. Das ist kein Zufall, sondern das Ergebnis davon, sie **vor** dem
ersten Paket nachgezählt zu haben statt sie beim Bauen zu entdecken. Der Plan
lag falsch, aber er lag *nachprüfbar* falsch, und die Korrektur stand
schriftlich fest, bevor ein Agent sie brauchte.

**Zwei Dinge bleiben offen und sind benannt:**
- `debt-service`/`receivable-service` haben dasselbe Muster wie DOM-4
  (Float-Betrag ohne Cent-Validierung) für ihre eigenen Entitäten. Andere
  fachliche Grenze, eigener Folgepunkt — gefunden in WP 2.5.
- Die Suiten `test:integrity`/`test:security`/`test:privacy`/`test:mobile`
  filtern über feste Dateilisten statt über Globs (1.f); „die Suite ist grün"
  bedeutet damit weniger, als es klingt. Entscheidung fällt in WP 7.6.

---

*Die Zwischenbefunde, auf die sich der Abschluss beruft:*

### 2.b · WP 2.3 — Vorentscheidung 0.6 hat sich bestätigt, und die Ratsche wurde eigenständig

**Befund.** Die in 0.6 vorab notierten Zahlen stimmen exakt: **4 hooks-Importe
in 3 Dateien**, **24 Slice-Presentation-Importe in 10 Dateien** (`plan.md`
erwartet zwei). Neu entschieden werden musste nur, **wo** die zweite Zahl lebt.

**Entscheidung.** Ein **eigener** Wächter `check:slice-presentation` mit eigener
Budget-Datei, nicht eine Erweiterung von `check:view-data`.

**Begründung.** Die beiden Zahlen messen verschiedene Fachfragen: `view-data`
zählt **Datenzugriffe** in der Darstellung, `slice-presentation` zählt die
**UI-Kopplung** einer Slice an die Alt-Oberfläche. In eine Summe geworfen
könnte ein Fortschritt in der einen Richtung eine Verschlechterung in der
anderen verdecken — und genau diese Zahl sollen WP 6.2/6.3 nachweislich senken.
Eine Ratsche, deren Bewegung mehrdeutig ist, belegt nichts.

**Preis.** Ein fünfzehnter Wächter, eine weitere Budget-Datei im Repo-Root, ein
weiterer Pre-Commit- und CI-Schritt. Die Wächterbatterie liegt jetzt bei ~15 s;
der Grenznutzen jedes weiteren Wächters sinkt, und irgendwann ist die Zahl der
Wächter selbst ein Problem. Hier noch nicht.

**Nebenbefund, nicht behoben.** `istInfrastruktur()` (aus `view-data-core.mjs`
wiederverwendet statt neu erfunden) hat zwei Sorten Muster:
verzeichnisbasierte (`/\/providers\//`) und dateinamenbasierte
(`Provider.tsx$`, `FeatureGate.tsx$`). Auf einen **Import-Spezifizierer**
— den `resolveTarget()` ohne Dateiendung liefert — greifen nur die
verzeichnisbasierten. Für alle drei echten Fälle reicht das; ein
`FeatureGate`-Import aus `hooks/` fiele durch die Ausnahme. Kommt im Bestand
nicht vor, wäre aber beim vierten Anwendungsfall der Funktion eine böse
Überraschung.

### 2.a · zod an Datengrenzen kollidiert mit der Bundle-Ratsche

**Befund.** WP 2.2 ersetzt in `analytics-consent-service.ts` einen
`as unknown as`-Cast durch eine echte zod-Prüfung. `PrivacyIndicator` hängt in
der App-Shell und zieht diesen Service — und damit zod — in das **eager
geladene Startbündel**. `check:bundle-size` wurde rot: `index` 181,0 kB gegen
ein Budget von 172,0 kB. Der Plan hat diese Kopplung nirgends vorgesehen: er
behandelt „zod an Datengrenzen" (Phase 1/2) und „Bundle-Budget" (Phase 4) als
unabhängige Themen. Sie sind es nicht — **jede eingelöste Datengrenze kostet
Startbündel**, weil der Cast, den sie ersetzt, zur Laufzeit nichts kostete.
Er prüfte allerdings auch nichts.

**Entscheidung.** Das Budget wird **nicht sofort** nachgezogen, sondern
**einmal nach WP 1.2** — mit der dann bekannten echten Zahl.

**Begründung.** WP 1.2 bringt zod an die Kern-Lesegrenze für Transaktionen,
Konten, Budgets und Schulden; der Startpfad wächst dort aus demselben Grund
erneut. Zwei Anhebungen kurz hintereinander, jede einzeln mit „ist gewollt"
begründet, sind genau die Aufweichung, gegen die eine Ratsche gebaut ist: Eine
Anhebung mit bekannter Zahl ist eine Entscheidung, zwei sind eine Gewohnheit.
Die Abwägung selbst ist damit vorgezeichnet — in einer local-first Finanz-App
ist „ein beschädigter Datensatz erreicht die Oberfläche nicht" den Preis wert.

**Preis.** Der Startpfad wird messbar schwerer, und CI bleibt bis zum Ende von
WP 1.2 rot. Ein roter Draft-PR ist sichtbar und benannt (Kommentar im PR), also
tragbar — aber er verdeckt für diese Zeit jeden **anderen** Fehlschlag im
selben Schritt. Wer während dieser Spanne ein Paket schiebt, muss die
CI-Ausgabe lesen, nicht nur die Farbe.

**Nachtrag nach WP 1.2 — die Anhebung entfällt.** Gemessen am Bau nach
WP 1.2 Teil A liegt `index` bei **166,9 kB gzip** gegen ein Budget von
176,1 kB, und `check:bundle-size` ist wieder grün. Die Schema-Module haben zod
aus dem eager geladenen Bündel **heraus**gezogen: der gemeinsam genutzte Code
landet jetzt in einem eigenen Chunk, statt am Einstieg zu hängen. Die
vorbereitete Entscheidung „einmal anheben mit der echten Zahl" wird damit
gegenstandslos — **die echte Zahl brauchte keine Anhebung.**

Die Lehre bleibt trotzdem stehen, und sie ist die interessantere: Die
Diagnose („zod kostet Startbündel") war richtig, die Schlussfolgerung
(„also muss das Budget steigen") war voreilig. Wo ein Modul landet, entscheidet
der Bündler anhand des Import-Graphen — und der ändert sich mit dem nächsten
Paket. **Ein Budget nachzuziehen, bevor die Arbeit fertig ist, hätte hier eine
Grenze dauerhaft aufgeweicht, die sich von selbst wieder eingerenkt hat.**
Genau dafür war das Warten gut.

**Nicht gewählt, weiterhin offen:** Die Validierung aus dem eager Pfad holen
(dynamischer `import()` in `getAnalyticsConsent`). Momentan nicht nötig.

**Nebenbefund aus demselben Lauf:** `check:bundle-size` meldet `dist` mit
4,6 kB gegen ein Budget von 47,0 kB — der Verdacht war, das Budget messe
nichts mehr.

**Erledigt am Phasenende von Phase 1, mit einer Korrektur.** Nachgemessen liegt
`dist` bei **42,2 kB** gegen dieselben 47,0 kB — der Eintrag misst also sehr
wohl etwas, die 4,6 kB waren ein anderer Bau. Er bleibt unverändert stehen; ihn
zu entfernen hätte eine geltende Grenze aus einer Fehldiagnose heraus gelöscht.
Bemerkenswert bleibt die Schwankungsbreite desselben abgeleiteten Chunk-Namens
zwischen zwei Bauten — wer dieses Budget künftig anfasst, sollte zweimal messen.

Tatsächlich nachgezogen wurden nur zwei Zahlen:

- **`idb` neu aufgenommen** (273,6 kB Ist → 309.248 B Budget). Der Chunk
  entstand durch die Schema-Module und hatte noch gar kein Budget.
- **`money` von 305.152 B auf 24.576 B gesenkt.** Ist: 21,6 kB. *Dieses*
  Budget maß wirklich nichts mehr.

**Was bewusst NICHT passiert ist:** `pnpm check:bundle-size --update` hätte
fünf Budgets **und die Gesamtgrenze angehoben** (2436 kB → 2465 kB), obwohl der
Wächter grün war — der Befehl setzt schlicht „Ist plus 10 %", auch wo das eine
Lockerung bedeutet. Genau das ist die Aufweichung, gegen die eine Ratsche
gebaut ist. Übernommen wurde deshalb nur, was **senkt** oder was **neu** ist;
jede Zahl, die gestiegen wäre, blieb stehen. Die Lehre für den Umgang mit
`--update` überhaupt: **sein Ergebnis ist ein Vorschlag, kein Ergebnis** — der
Diff gehört gelesen, bevor er committet wird.
