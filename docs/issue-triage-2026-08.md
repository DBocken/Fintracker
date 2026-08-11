# Issue-Sichtung 2026-08-11 — Bestandsprüfung und Abarbeitungsreihenfolge

> **Protokoll.** Stand `main@60d98bd`, Version `2026.8.0`, 44 offene Issues.
> Es entsteht hier **kein drittes Programm**: Der geltende Arbeitsplan bleibt
> [`betrieb-2026-08/plan.md`](betrieb-2026-08/plan.md). Diese Datei beantwortet
> nur zwei Fragen, die kein Plan beantwortet — *was ist inzwischen erledigt?*
> und *in welcher Reihenfolge wird der Rest angefasst?* Die Zahlen altern
> absichtlich; wer sie später liest, misst neu.
>
> **Nachtrag 2026-08-11:** Die vier Issues aus Abschnitt 1 sind geschlossen,
> ebenso #293, #294, #296, #297 und das dabei entstandene #311. Offen aus dem
> Livegang-Gate bleibt **#292** — Einzelheiten in Abschnitt 5.

## 1. Was jetzt geschlossen werden kann

Vier Issues sind gegen den heutigen Baum nachgemessen erledigt bzw. gegenstandslos.

| Issue | Befund | Beleg |
|---|---|---|
| **#234** Fundament: EntityRef + zod-Grundlage | `src/lib/entity-ref.ts` trägt die geschlossene Union `EntityKind`, `makeEntityRef`, den dangling-toleranten Resolver (`{ status: 'resolved' \| 'missing' }`, wirft nie); `src/lib/schemas/boundary.ts` hat `parseAtBoundary`/`safeParseAtBoundary`; die drei Scaffolding-Schemas existieren; der ADR liegt als `docs/architecture/entity-references.md`. Tests: `src/lib/__tests__/entity-ref.test.ts`, `schemas/__tests__/boundary.test.ts` | `bd615f5` |
| **#235** Fundament: Vault-/Backup-Abdeckung Haushaltsdaten | `VaultPayload` trägt alle vier geforderten Felder (`households`, `householdMembers`, `sharedExpenseSplits`, `householdSettlements`); `emptyVaultPayload`, `openVaultFile` und `mergeVaultPayloads` behandeln sie über das bestehende `mergeRecords` | `033e5a1`, `src/services/__tests__/vault-format.test.ts` |
| **#21** [Epic] Phase 1: Code-Hygiene & Qualität | Alle drei Unter-Issues geschlossen (3/3). Die drei namentlich genannten toten Dateien existieren nicht mehr (`AusgabentrackerPage.tsx`, `xs2a-service.ts`, `market-data-mock-service.ts`); aus „0 Tests bei ~185 Quelldateien" sind **580 Testdateien** plus 14 Wächterskripte geworden | Baumstand |
| **#52** Stripe-Integration + Entitlements | **Gegenstandslos, nicht erledigt.** #306 ersetzt den Stripe-Plan ausdrücklich durch Mollie; `docs/architecture/eu-souveraenitaet.md` schließt den Anbieter aus. Als *superseded by #306* schließen, damit die Anbieterfrage nur an einer Stelle steht | #306, #308 |

**#297** ist der Grenzfall und wird **nicht** geschlossen: `withErrorBoundary` ist
seit der AppShell-Absicherung wieder lebendig (`src/components/layout/AppShell.tsx:29`,
`SafeOutlet`) — genau der Fall, den das Issue vorsorglich ausgenommen hat. Die
Restliste schrumpft damit von fünf auf vier Symbole: `useSkin`, `BulkActions`,
`useErrorHandler`, `matchContractsToTransactions`. (`getMilestoneDefinitions` hat
einen Aufrufer in der eigenen Datei — die Frage dort ist nur, ob der *Export* nötig ist.)

## 2. Der größte Einzelbefund: sieben Issues sind zu ¾ fertig

Die Roadmap-Epics B/C und die Ersatzplanung (#239–#245, #247, #248) sind **gemergt** —
aber nur bis zur Domänen- und Datenschicht. Es fehlt bei allen dasselbe: die Fläche.

| Slice | Bestand | Konsument heute |
|---|---|---|
| `replacement-planning` | `domain/` vollständig (Plan, Forecast-Erweiterung, Rücklagen-Suffizienz, Zyklus-Neustart) + Service + zod-Schema + Storage-Key | **produktiv** über `services/forecast-data.ts` bis in die Liquiditätsansicht — nur *anlegen* kann niemand einen Plan |
| `contract-records` | `domain/` (Fristen, Garantie, Preisverlauf) + Service + Schema | **keiner** außer den eigenen Tests |
| `household-settlement` | `domain/` (Salden, Netting, Ausgleichsfortschritt) + Service + Schema; `splitWeighted`/`paid_by_member_id` im `household-service` | **keiner** — die Daten dagegen entstehen bereits im laufenden `HouseholdSplitPanel` |

Das ist in WP 6.1 (ARCH-2) erhoben und in den drei `README.md` der Slices
festgehalten. Für die Issues heißt es: **offen bleiben sie, aber ihr Restumfang
ist ausschließlich `data`/`application`/`presentation` + Route + i18n.** Wer eines
anfasst, fängt nicht bei null an — und sollte das Issue nicht so lesen, als müsste
er die Domänenlogik erst schreiben.

Der Slice mit dem besten Verhältnis ist `household-settlement`: die Datenhälfte
läuft bereits in der Oberfläche, es fehlt allein die Salden-Ansicht.

## 3. Reihenfolge

Sie folgt einer Kante, die im Epic #308 steht und hier nur ausbuchstabiert wird:
**Das Livegang-Gate (#292, #293, #296, #298) wird vom Betriebsprogramm nicht
geplant, aber verlangt.** Es ist damit weder Teil einer Phase noch verschiebbar —
es läuft daneben und muss vor dem öffentlichen Betrieb fertig sein.

### Stufe 1 — Falsche Zahlen zuerst (Livegang-Gate, ohne Reihenfolge untereinander)

Nachgemessen am heutigen Baum, alle vier Befunde bestehen unverändert:

1. **#292 Fremdwährung** — `grep -c currency` in `analysis-data.ts`, `budget-logic.ts`,
   `forecast.ts` ergibt weiterhin **je 0**; `account-service.ts:97` schreibt
   unverändert `currency: account.currency || 'EUR'`. Der schwerste Typ: das
   Ergebnis sieht aus wie ein Ergebnis. Empfohlener Weg ist Option B des Issues
   (markieren statt abweisen), konsistent zu WP 7.7 für Depots.
2. **#296 Sanfter Modus** — **20** rohe `new Intl.NumberFormat('de-DE'` außerhalb
   von Tests, unverändert gegenüber der Erhebung. Betrifft ein
   Barrierefreiheits-Versprechen, nicht nur Duplizierung.
3. **#293 `updateUserSettings`** — lesen/mergen/zurückschreiben ohne Serialisierung,
   25 Aufrufstellen. Klein und abgeschlossen; guter erster Griff.
4. **#298 RLS gegen echte Instanz** — braucht als Einziges Infrastruktur
   (Testprojekt oder CI-Container) und sollte deshalb früh *entschieden*, nicht
   früh *gebaut* werden.

**#294** (Kurs 0) gehört sachlich dazu, steht aber nicht im Gate: Er braucht zuerst
die Feststellung, was Yahoo/Stooq/eToro bei fehlendem Kurs liefern — sechs
Fundstellen (`portfolio-service.ts:169`, `PositionTable.tsx:84,203`,
`use-etoro-account.ts:393`, `position-metrics.ts:16,21`), aber eine Entscheidung.

### Stufe 2 — Betriebsprogramm Phase 0 (#300)

40 Pakete, 0 abgeschlossen. Die Reihenfolge steht in `betrieb-2026-08/status.md`;
drei Punkte sind heute nachgeprüft und unverändert offen:

- **kein einziger Git-Tag** (`git tag` ist leer), obwohl `package.json` auf
  `2026.8.0` steht und AGENTS.md §11 den Tag verlangt → WP 0.1.
- **`vercel.json` ohne `regions`**, `netlify.toml` liegt weiter im Baum → WP 0.2.
- **`chart.googleapis.com`** erhält die Bank-Requisition-URL
  (`GoCardlessConnect.tsx:205`) → WP 0.4.

WP 0.10 löst dabei die beiden Deployment-Issues **#226** und **#282** ein. #282 ist
die dringlichere Hälfte: bis zum Deploy läuft die wirkungslose Kontingent-Prüfung
in Produktion.

### Stufe 3 — Technische Schulden (#295)

Sammel-Issue, keine falschen Zahlen. Zwei Punkte sind heute belegt und billig:

- `commandPalette.quickActionsHeading` steht im deutschen Baum als `'Quick Actions'`
  (`translations/de.ts:1886`) — englischer Text in der deutschen Oberfläche.
- Coverage-Schwellen `52/52/47/44` gegen gemessene ~77/67/69: sie halten nichts auf.

i18n-Backlog aktuell: **35 offene Fundstellen in 23 Dateien** (dazu 54 entschiedene).
Ratschen: `check:view-data` **220**, `check:slice-presentation` **12 / 0**.
Jede Slice-Migration aus Stufe 4 senkt beide.

### Stufe 4 — Die fertigen Slices sichtbar machen

#247/#248 (Salden-Ansicht), dann #239 (Ersatzplan anlegen), dann #244/#245
(Vertragsakte). Kein neues Feature, sondern das Freilegen von bereits bezahlter
Arbeit — und zugleich die einzige Bewegung, die `check:view-data` Richtung 0 bringt.
**#246** (verschlüsselter Blobstore) bleibt bewusst hinten: entscheidungsgebunden,
und die Akte funktioniert ohne ihn.

### Daneben, dauerhaft

**Zehn offene Pull Requests**, davon acht Dependabot. AGENTS.md §10.7 macht den
Patchstand zur Regel, nicht zur Kür — die acht gehören durchgesehen und
zusammengefasst, nicht liegengelassen. Die zwei inhaltlichen (#299, #289) brauchen
eine Entscheidung: mergen oder schließen.

## 4. Was ohne Betreiberzugriff nicht entscheidbar ist

**#175**, **#229** und Teile von **#298** hängen alle am selben Nadelöhr: sie
verlangen Zugriff auf das laufende Supabase-Projekt (Ist-Schema, RLS-Status,
Deploy-Stand der Edge Functions). Das sind [OPS]-Punkte im Sinne von
`betrieb-2026-08/plan.md` Regel 7 — sie werden nicht „irgendwann" erledigt, sondern
brauchen einen Termin mit dem Betreiber. Sinnvoll ist **ein** Termin für alle drei,
zusammen mit WP 0.3 (Supabase-Region) und WP 0.10 (die ausstehenden Deployments).

## 5. Nachtrag: Stand nach der Abarbeitung (2026-08-11)

**Geschlossen:** #21, #52 (gegenstandslos, ersetzt durch #306), #234, #235 —
die vier aus Abschnitt 1. Dazu abgearbeitet: **#293** und **#296** (je mit
neuem Wächter), **#294**, **#297**. Neu entstanden und sofort geschlossen:
**#311**, die Ursachenklasse hinter #293.

**Was das über die Issue-Liste sagt:** Drei der vier abgearbeiteten Issues
beschrieben den Befund enger, als er war.

| Issue | im Issue | nachgemessen |
|---|---|---|
| #293 | ein Rennen in `updateUserSettings` | dieselbe Bauform an **27 Stellen in 12 Dateien** (#311) — dort verliert sie eine Buchung, keine Einstellung |
| #296 | 20 rohe `Intl.NumberFormat` = 20 Fehler | 38 rohe Formatierer, aber nur **18 echte** Fundstellen: die meisten maskieren bereits |
| #297 | fünf tote Symbole | eines lebt wieder, eines fehlte in der Liste |

Die Lehre ist in beide Richtungen dieselbe: **Ein Issue ist eine Momentaufnahme,
kein Messwert.** Vor der Behebung wird neu gezählt — sonst repariert man bei #296
korrekten Code und übersieht bei #293 die elf anderen Dateien.

### Offen: #292 (Fremdwährung)

Der letzte Punkt des Livegang-Gates und bewusst **nicht** angefangen. Das Issue
warnt selbst davor, ihn halb zu erledigen: Nähme man den Saldo aus `cash`
heraus, während dieselben Buchungen weiter als Einnahme und Ausgabe zählen,
widersprächen sich zwei Flächen über dieselben Daten — schlimmer als der heutige
Zustand. Er braucht einen Durchgang über alle sechs Flächen (Analyse, Budgets,
Prognose, EÜR, Finanzgesundheit, Nettovermögen) plus die zweite Eintrittspforte
in `account-service.ts:97`.

Der Weg ist vorgezeichnet: `getPortfolioSummary` macht für Depots seit WP 7.7
genau das Richtige (nur Gleichwährendes summieren, den Rest über
`UnconvertedCurrencyNotice` ausweisen). Die Buchungsseite braucht dieselbe
Bewegung — eine Funktion, die Buchungen anhand der Kontowährung in
„verrechenbar" und „nicht verrechnet" trennt, und sechs Flächen, die sie
benutzen.

### Neue Wächter aus dieser Runde

| Wächter | Was er verhindert |
|---|---|
| `pnpm check:store-serialization` | die 28. Stelle mit unserialisiertem Lesen-Ändern-Schreiben |
| `pnpm check:money-format` | den nächsten Betrag, der am Sanften Modus vorbei gerendert wird |

Beide **ohne Ausnahmeliste** — bei beiden hiesse ein begründeter Einzelfall
„hier darf gelegentlich etwas kaputtgehen".
