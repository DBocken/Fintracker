# Dokumentation — was gilt, was ist Protokoll

Diese Datei ist die Landkarte. Sie existiert, weil in `docs/` zwei Arten von
Dokumenten nebeneinander lagen, die man ihnen nicht ansieht:

- **Geltend (normativ):** sagt, was *jetzt* zu tun ist. Wer dagegen verstößt,
  macht einen Fehler. Diese Dokumente werden gepflegt.
- **Protokoll:** sagt, was zu einem *Zeitpunkt* gefunden oder entschieden
  wurde. Es wird nicht nachgeführt — die Zahlen darin altern absichtlich.

Ein Audit von Juli, das nicht als Protokoll erkennbar ist, liest sich wie eine
Regel. Genau so ist ein Test-Inventar mit 783 Tests im Wurzelverzeichnis stehen
geblieben, während der Baum damals schon 4634 hatte — heute ein Mehrfaches.

**Faustregel für neue Dokumente:** Trägt der Titel ein Datum oder beschreibt er
einen Lauf („Audit", „Bericht", „Ergebnisse", „Fortschritt"), gehört er nach
`docs/archive/` — spätestens, sobald die daraus folgende Arbeit erledigt ist.
Regeln, die aus einem Lauf entstehen, wandern in die geltenden Dokumente; der
Bericht bleibt als Beleg.

---

## Die oberste Ebene

| Datei | Rolle |
|---|---|
| [`AGENTS.md`](../AGENTS.md) | **Die kanonische Regelquelle** für alle Agenten und Menschen. Bei Widerspruch zu jedem anderen Dokument gilt diese Datei |
| [`CLAUDE.md`](../CLAUDE.md) | Nur die Claude-Code-spezifische Mechanik (Hooks, `.claude/`). Keine inhaltlichen Regeln |
| [`AI_RULES.md`](../AI_RULES.md) | Wegweiser auf `AGENTS.md`, für Werkzeuge, die genau diesen Dateinamen erwarten |
| [`README.md`](../README.md) | Einstieg: Stack, Setup, Kommandos |
| [`CHANGELOG.md`](../CHANGELOG.md) | Was sich je Version geändert hat (CalVer `JJJJ.M.n`). Menschenlesbare Fassung, kein Protokoll — Ablauf in `AGENTS.md` §11 |

## Geltend — Architektur & Handwerk

| Datei | Inhalt |
|---|---|
| [`coding-guide.md`](coding-guide.md) | Entwickler-Leitfaden, Schichten im Detail |
| [`architecture/feature-structure.md`](architecture/feature-structure.md) | Kochrezept für Feature-Slices, Entscheidungsbaum Desktop/Mobile |
| [`architecture/abfrage-register.md`](architecture/abfrage-register.md) | Wie eine getippte Frage zu einer Antwort kommt: Router-Stufen, Datenkanäle, Slots, Ratschen, benannte Grenzen |
| [`domain-invariants.md`](domain-invariants.md) | Fachliche Invarianten, auf die sich Tests berufen |
| [`design-principles.md`](design-principles.md) | 7 Kernprinzipien + Karten- und Animationsregel |
| [`performance.md`](performance.md) | Performance-Ist-Zustand und geplante Phase B |

### Architektur-Entscheidungen (ADR)

Datiert, in ADR-Form: Kontext · Entscheidung · verworfene Alternative · Preis.
Sie sind **geltend** — wer abweichen will, braucht neue Fakten, nicht neuen
Geschmack. Der Preis-Abschnitt sagt, was die Entscheidung heute wirklich kostet;
wo eine Begründung nicht belegbar war, steht sie ausdrücklich als
„rekonstruiert" da.

| Datei | Entscheidung |
|---|---|
| [`architecture/entity-references.md`](architecture/entity-references.md) | `EntityRef` für generische Verweise, typisierte FK-Felder sonst; Entitäten immer über die stabile ID adressieren (2026-07-19) |
| [`architecture/transaction-storage-chunks.md`](architecture/transaction-storage-chunks.md) | Transaktionsablage als Quartals-Chunks statt einem Blob (2026-08-09) |
| [`architecture/currency-eur-only.md`](architecture/currency-eur-only.md) | EUR-only, keine Multi-Currency-Vorbereitung (2026-07-02) |
| [`architecture/storage-indexeddb-kv.md`](architecture/storage-indexeddb-kv.md) | IndexedDB als Key-Value-Ablage, keine relationale Datenbank (ca. Juni 2026) |
| [`architecture/dual-layering.md`](architecture/dual-layering.md) | Klassische Schichten und Feature-Slices dauerhaft nebeneinander (2026-07-12) |
| [`architecture/guard-system.md`](architecture/guard-system.md) | Wächter-Skripte in Pre-Commit + CI als Durchsetzungsstrategie (2026-07-12) |
| [`architecture/money-euro-float.md`](architecture/money-euro-float.md) | Euro-Float in der Persistenz, Cent in der Rechnung (2026-08-08) |
| [`architecture/eu-souveraenitaet.md`](architecture/eu-souveraenitaet.md) | Anbieter und Subdienstleister EU-only; Software self-hosted statt SaaS; Rollen-Taxonomie, Push-/Telemetrie-Prinzipien (2026-08-10) |
| [`architecture/supabase-abloesung.md`](architecture/supabase-abloesung.md) | Supabase: Naht jetzt, Ablösung mittelfristig, Neubau-Stopp ab sofort (2026-08-10) |
| [`architecture/darstellungsdichte.md`](architecture/darstellungsdichte.md) | Zwei Darstellungsdichten (kompakt/fokussiert), Zuordnung ohne Schalter über App-Kontext und 768-CSS-Pixel-Schwelle (2026-08-30) |

## Geltend — Sicherheit & Datenschutz

| Datei | Inhalt |
|---|---|
| [`security-guidelines.md`](security-guidelines.md) | Regeln je Schwachstellenklasse, mit ❌/✅-Beispielen |
| [`security-boundaries.md`](security-boundaries.md) | Wo Daten das Gerät verlassen dürfen — und wo nicht |
| [`security/threat-model.md`](security/threat-model.md) | Bedrohungsmodell |
| [`security/security-inventory.md`](security/security-inventory.md) | Stand der Schutzmaßnahmen |
| [`security/pentest-scope.md`](security/pentest-scope.md) | Geltender Prüfumfang für Pentests |
| [`security/security-headers.md`](security/security-headers.md) | Header-Konfiguration der Deployments + die entschiedenen Punkte dazu (`style-src 'unsafe-inline'`, Pre-Commit-Bypass) |
| [`security/anbieter-register.md`](security/anbieter-register.md) | **Lebendes Register:** Anbieter, Subdienstleister, externe Endpunkte — Rollen, AVV-Stand, Prüfdaten; Faktenbasis für Subprozessoren-Verzeichnis und VVT |

## Geltend — Fachdomäne & Produkt

| Datei | Inhalt |
|---|---|
| [`FEATURES.md`](FEATURES.md) | Steckbriefe versteckter und experimenteller Features |
| [`RDG_TEXTREGELN.md`](RDG_TEXTREGELN.md) | Formulierungsdisziplin im Schulden-Modul (Rechtsdienstleistungsgesetz) |
| [`tax-year-update.md`](tax-year-update.md) | Checkliste für einen neuen Veranlagungszeitraum |
| [`mcp-poc.md`](mcp-poc.md) | MCP-Zugriff als Proof of Concept samt seiner Grenzen |
| [`competitive-analysis.md`](competitive-analysis.md) | Wettbewerbsvergleich — Momentaufnahme Juni 2026, bewusst nicht nachgeführt |

## Geltend — Vorentschiedenes (vor der Arbeit daran lesen)

`AGENTS.md` §3 verweist auf diese Dokumente, damit getroffene Entscheidungen
nicht versehentlich untergraben werden:

| Datei | Thema |
|---|---|
| [`onboarding-life-situations.md`](onboarding-life-situations.md) | Onboarding, Lebenssituationen, Einzelunternehmer-Modus |
| [`tutorial-progressive-disclosure.md`](tutorial-progressive-disclosure.md) | Behutsame Heranführung, Freischaltung von Funktionen |
| [`tutorial-sequence.md`](tutorial-sequence.md) | Reihenfolge der Kapitel, Datenquellen-Weiche |
| [`tutorial-script-transactions.md`](tutorial-script-transactions.md) | Skript des Transaktions-Kapitels |
| [`debt-avoidance-recovery.md`](debt-avoidance-recovery.md) | Sanfter Modus, Vermeidungsverhalten, Grenzen für Umfrage und Werbung |
| [`feature-strategy-budgeting.md`](feature-strategy-budgeting.md) | Budget-Strategie |
| [`feature-strategy-sonderkategorien.md`](feature-strategy-sonderkategorien.md) | Sonderkategorien |
| [`product/roadmap-new-capabilities-2026-07.md`](product/roadmap-new-capabilities-2026-07.md) | Geplante Fähigkeiten — plant Arbeit, implementiert nichts |

## Programm AAA+ (abgeschlossen, Regeln gelten weiter)

`docs/aaa-plus/` ist **kein Archiv**, obwohl alle Arbeitspakete (Phasen 0–11)
abgeschlossen sind: Spezifikation, Entscheidungsprotokoll und Zustandsmatrix
gelten weiter. Offen sind nur das Deployment aus
[#282](https://github.com/DBocken/Fintracker/issues/282) und die in
`offene-punkte.md` bewusst offen markierten Punkte. Innerhalb gilt dieselbe
Trennung.

| Datei | Rolle |
|---|---|
| [`aaa-plus/implementation-plan.md`](aaa-plus/implementation-plan.md) | Geltende Spezifikation der Arbeitspakete |
| [`aaa-plus/tdd-specs.md`](aaa-plus/tdd-specs.md) | Geltende Testspezifikationen je Paket |
| [`aaa-plus/decisions/decision-log.md`](aaa-plus/decisions/decision-log.md) | Getroffene Entscheidungen — geltend, weil sie binden |
| [`aaa-plus/offene-punkte.md`](aaa-plus/offene-punkte.md) | Was noch aussteht |
| [`aaa-plus/agent-graph.md`](aaa-plus/agent-graph.md) | Rollen im agentischen Programm |
| [`aaa-plus/test-architect-prompt.md`](aaa-plus/test-architect-prompt.md) | Prompt-Vorlage |
| [`aaa-plus/audits/state-coverage-matrix.md`](aaa-plus/audits/state-coverage-matrix.md) | Zustandsmatrix je Fläche — geltende Zielsetzung von `pnpm check:state-coverage` |
| `aaa-plus/progress.md` | **Protokoll.** Fortschrittsprotokoll, neueste Einträge oben |
| `aaa-plus/audits/2026-08-05-*.md` | **Protokoll.** Ist-Aufnahme zu einem Datum |
| `aaa-plus/evidence/2026-08-05-*.md` | **Protokoll.** Nachweise zu einem Lauf |
| `aaa-plus/critic-reports/*.md` | **Protokoll.** Bewertung eines Arbeitspakets |

## Laufendes Programm: Qualität 10/10 (2026-08)

`docs/qualitaet-2026-08/` ist **noch kein Archiv**, obwohl das Programm
abgeschlossen ist: Zwei übersehene Pakete wurden als Issues ausgelagert
([#296](https://github.com/DBocken/Fintracker/issues/296),
[#297](https://github.com/DBocken/Fintracker/issues/297)), die Korrektur des
Abschlussberichts läuft als PR #299. Die Archivierung erledigt WP 0.11 des
Betriebsprogramms.

| Datei | Rolle |
|---|---|
| [`qualitaet-2026-08/plan.md`](qualitaet-2026-08/plan.md) | Geltender Arbeitsplan: 7 Phasen, Arbeitspakete mit Akzeptanzkriterien, Vorentschiedenes |
| [`qualitaet-2026-08/nachpruefung.md`](qualitaet-2026-08/nachpruefung.md) | Getroffene Entscheidungen — geltend, weil sie binden. Wo der Plan an der Wirklichkeit vorbeizielte und was stattdessen gilt |
| [`qualitaet-2026-08/status.md`](qualitaet-2026-08/status.md) | **Protokoll.** Paketstand, Baseline und der Wiedereinstieg für eine neue Sitzung |
| [`qualitaet-2026-08/audit.md`](qualitaet-2026-08/audit.md) | **Protokoll.** Qualitäts-Audit vom 2026-08-08 (`main@067244f`) — die Belege zum Plan |

## Laufendes Programm: Kritische Design-Schwächen (2026-09)

| Datei | Rolle |
|---|---|
| [`qualitaet-2026-09/plan.md`](qualitaet-2026-09/plan.md) | Geltender Arbeitsplan: sieben Arbeitspakete gegen drei verifizierte Funde (unserialisierte Chunk-Schreibpfade, stilles Abschneiden durch Aufrufer-Limits, nicht idempotenter Import), je mit Tests-zuerst-Titeln und Wächter-Änderungen. Der Audit-Kontext steht im Kopf der Datei |

## Laufendes Programm: Betrieb & EU-Souveränität (2026-08)

`docs/betrieb-2026-08/` ist **kein Archiv**: das Programm hat offene
Arbeitspakete. Nach Abschluss wandert das Verzeichnis nach `docs/archive/` —
die beiden ADRs und das Anbieter-Register bleiben als geltende Dokumente.

| Datei | Rolle |
|---|---|
| [`betrieb-2026-08/plan.md`](betrieb-2026-08/plan.md) | Geltender Arbeitsplan: Phasen 0–7, 40 Arbeitspakete, [OPS]-Form mit `Wächter:`-Pflichtfeld, Livegang-Gate (#292/#293/#296/#298) |
| [`betrieb-2026-08/audit.md`](betrieb-2026-08/audit.md) | **Protokoll.** Prüfung der zehn Betriebsvorschläge + Sofortbefunde (BTR-*), 2026-08-10, `main@b2513b7` |
| [`betrieb-2026-08/status.md`](betrieb-2026-08/status.md) | **Protokoll.** Paketstand und Wiedereinstieg |
| `betrieb-2026-08/belege/` | **Protokoll.** Nachweise der [OPS]-Pakete (entsteht mit dem ersten Beleg) |

## Protokoll: Mobiler Umbau 2026-09

Der **geltende** Teil steht in
[`architecture/darstellungsdichte.md`](architecture/darstellungsdichte.md)
(Regel 1–10). Die beiden Dateien hier sind Momentaufnahme: Sie halten fest,
was am 2026-09-04 an zwölf Flächen **gemessen** wurde und in welcher
Reihenfolge daraus gebaut wird. Ihre Zahlen altern absichtlich — sobald eine
Fläche umgebaut ist, stimmt ihr Eintrag nicht mehr, und das ist richtig so.

| Datei | Rolle |
|---|---|
| [`mobil-2026-09/flaechen.md`](mobil-2026-09/flaechen.md) | **Protokoll.** Zwölf Flächen-Entwürfe gegen Regel 9, je mit Ist-Zustand (Slice, Kartenrahmen, Abfragen in der Darstellung), den höchstens drei Aussagen samt Datenquelle, dem Detailschritt, den benötigten Texten (134 Schlüssel) und den gemeinsamen Dateien |
| [`mobil-2026-09/reihenfolge.md`](mobil-2026-09/reihenfolge.md) | **Protokoll.** Was gefahrlos gleichzeitig gebaut werden darf, was in einer Hand bleiben muss (Sprachbäume, Ratschen, geteilte Bausteine, Gerätelauf) und die Reihenfolge der Sperren S1–S8 davor |

## Protokoll: Issue-Sichtung

| Datei | Rolle |
|---|---|
| [`issue-triage-2026-08.md`](issue-triage-2026-08.md) | **Protokoll.** Bestandsprüfung der 44 offenen Issues gegen `main@60d98bd` (2026-08-11): was nachgemessen erledigt ist, welche Roadmap-Issues nur noch ihre Oberfläche brauchen, und die Reihenfolge daneben. **Kein Arbeitsplan** — der bleibt `betrieb-2026-08/plan.md` |

## Protokoll: `docs/archive/`

Nichts hier ist eine geltende Regel. Jedes Dokument trägt oben einen Hinweis,
wofür es steht und wo die heutige Antwort steht.

| Datei | Was es festhält |
|---|---|
| `archive/claude-anweisung-und-produkt-audit-2026-06-21.md` | Produkt-Audit, 21.06.2026 |
| `archive/red-team-und-tokenstrategie-2026-06-21.md` | Plan des Red-Team-Laufs |
| `archive/red-team-ergebnisse-2026-06-21.md` | Befunde RT-01 bis RT-08, behoben |
| `archive/codequalitaet-audit-2026-07-02.md` | Repo-weiter Audit, 02.07.2026 |
| `archive/umsetzungsleitfaden-2026-07-02.md` | Task-Cards dazu, abgearbeitet |
| `archive/pentest-report-2026-07-18.md` | Pentest-Bericht |
| `archive/remediation-plan-2026-07-18.md` | Behebungsplan dazu, abgearbeitet |
| `archive/pentest-after-report-2026-07-18.md` | Nachbericht |
| `archive/technical-improvements-2026-06.md` | Sammelbericht bis Juni 2026, noch im Cloud-first-Rahmen |
| `archive/test-categories-2026-06.md` | Test-Inventar mit 783 Tests (heute ein Mehrfaches — die aktuelle Zahl liefert `pnpm test`) |
| `archive/modul-2-ausgabentracker-spec.md` | Ehemalige Top-README |

## Nachschlagewerke der Werkzeuge

| Datei | Inhalt |
|---|---|
| [`../.claude/i18n-workflow.md`](../.claude/i18n-workflow.md) | i18n-Workflow Schritt für Schritt, neue Sprache hinzufügen |
| [`../src/features/*/README.md`](../src/features/) | Slice-eigene Kurzbeschreibungen |
| [`../research/forecasting/`](../research/forecasting/) | Vorarbeiten zur Prognose |
